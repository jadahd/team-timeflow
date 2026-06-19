// Database access layer for Team TimeFlow.
//
// Wraps Supabase queries with typed functions and converts between the
// database's snake_case columns and the app's camelCase TypeScript types.

import { supabase } from '@/lib/supabase';
import {
  Employee,
  TimeEntry,
  TimeEntryType,
  BreakEntry,
  Announcement,
  AttendanceNote,
  AttendanceStatus,
  AuditAction,
  AuditLogEntry,
  ActorTier,
  PayPeriod,
} from '@/types/workforce';
import { Company } from '@/types/company';

/**
 * The company's local timezone, used when deriving `entry_date` from a
 * timestamp. We intentionally don't use `Date.toISOString().split('T')[0]`
 * for `entry_date` because that gives the UTC date — a clock-in at 7:30 PM
 * Chicago time (00:30 UTC next day) would otherwise get filed under the
 * wrong day, throwing off the date picker, pay-period boundaries, and
 * "today's shifts" queries.
 *
 * Hardcoded here for now because the business is single-tenant. If the
 * app ever goes multi-tenant, accept a timezone argument and pass the
 * value from company_settings instead.
 */
const COMPANY_TIMEZONE = 'America/Chicago';

/**
 * Returns a YYYY-MM-DD string representing `date` in the company timezone.
 * Uses the en-CA locale because its short-date format is already YYYY-MM-DD,
 * sidestepping the need for manual padding.
 */
function localDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// ============================================================
// Row shapes — what comes back from Supabase
// ============================================================
interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  initials: string;
  pin: string;
  department: string;
  role: string;
  employment_status: Employee['employmentStatus'];
  pay_type: Employee['payType'];
  hourly_rate: number | null;
  salary: number | null;
  is_full_time_eligible: boolean;
  full_time_override: boolean | null;
  user_role: Employee['userRole'];
  is_active: boolean;
  hire_date: string | null;
  end_date: string | null;
  end_reason: string;
  deleted_at: string | null;
  created_at: string;
}

interface TimeEntryRow {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  department: string;
  is_scheduled: boolean;
  notes: string[];
  entry_date: string;
  entry_type: TimeEntryType;
  created_at: string;
}

interface BreakRow {
  id: string;
  time_entry_id: string;
  break_type: 'break' | 'lunch';
  start_time: string;
  end_time: string | null;
  expected_return: string | null;
  created_at: string;
}

interface AnnouncementRow {
  id: string;
  text: string;
  priority: 'normal' | 'urgent';
  expires_at: string;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Row → app type converters
// ============================================================
function rowToEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    initials: r.initials,
    pin: r.pin,
    department: r.department,
    role: r.role,
    employmentStatus: r.employment_status,
    payType: r.pay_type,
    hourlyRate: r.hourly_rate ?? undefined,
    salary: r.salary ?? undefined,
    isFullTimeEligible: r.is_full_time_eligible,
    fullTimeOverride: r.full_time_override ?? undefined,
    userRole: r.user_role,
    locationId: '1',
    companyId: '1',
    isActive: r.is_active,
    hireDate: r.hire_date ?? undefined,
    endDate: r.end_date ?? undefined,
    endReason: r.end_reason || undefined,
    deletedAt: r.deleted_at ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToBreak(r: BreakRow): BreakEntry {
  return {
    id: r.id,
    type: r.break_type,
    startTime: r.start_time,
    endTime: r.end_time ?? undefined,
    expectedReturn: r.expected_return ?? undefined,
  };
}

function rowToTimeEntry(r: TimeEntryRow, breaks: BreakEntry[] = []): TimeEntry {
  return {
    id: r.id,
    employeeId: r.employee_id,
    clockIn: r.clock_in,
    clockOut: r.clock_out ?? undefined,
    department: r.department,
    isScheduled: r.is_scheduled,
    notes: r.notes,
    date: r.entry_date,
    entryType: r.entry_type ?? 'work',
    breaks,
  };
}

function rowToAnnouncement(r: AnnouncementRow): Announcement {
  return {
    id: r.id,
    text: r.text,
    priority: r.priority,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    createdBy: r.created_by ?? '',
  };
}

// ============================================================
// EMPLOYEES
// ============================================================
export async function fetchEmployees(): Promise<Employee[]> {
  // Excludes soft-deleted rows so the kiosk, admin tables, and payroll
  // never see them. Use fetchDeletedEmployees() for the Recently Deleted view.
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .is('deleted_at', null)
    .order('first_name', { ascending: true });
  if (error) {
    console.error('[db] fetchEmployees failed', error);
    return [];
  }
  return (data as EmployeeRow[]).map(rowToEmployee);
}

/** Soft-deleted employees only — for the Recently Deleted view. */
export async function fetchDeletedEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) {
    console.error('[db] fetchDeletedEmployees failed', error);
    return [];
  }
  return (data as EmployeeRow[]).map(rowToEmployee);
}

/** Returns how many time_entries exist for the given employee. Used by
 *  AdminEmployees to gate the Trash icon — employees with history can't
 *  be soft-deleted accidentally. */
export async function countTimeEntriesForEmployee(employeeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('time_entries')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId);
  if (error) {
    console.error('[db] countTimeEntriesForEmployee failed', error);
    return 0;
  }
  return count ?? 0;
}

/** Returns a Map<employeeId, count> for every employee — batched single
 *  query so AdminEmployees doesn't have to fan out one per row. */
export async function fetchTimeEntryCountsForAllEmployees(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('employee_id');
  if (error) {
    console.error('[db] fetchTimeEntryCountsForAllEmployees failed', error);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of (data as { employee_id: string }[]) ?? []) {
    counts.set(row.employee_id, (counts.get(row.employee_id) ?? 0) + 1);
  }
  return counts;
}

export async function createEmployee(
  emp: Omit<Employee, 'id' | 'createdAt'>,
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      first_name: emp.firstName,
      last_name: emp.lastName,
      initials: emp.initials,
      pin: emp.pin,
      department: emp.department,
      role: emp.role,
      employment_status: emp.employmentStatus,
      pay_type: emp.payType,
      hourly_rate: emp.hourlyRate ?? null,
      salary: emp.salary ?? null,
      is_full_time_eligible: emp.isFullTimeEligible,
      full_time_override: emp.fullTimeOverride ?? null,
      user_role: emp.userRole,
      is_active: emp.isActive,
      hire_date: emp.hireDate ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error('[db] createEmployee failed', error);
    return null;
  }
  return rowToEmployee(data as EmployeeRow);
}

export async function updateEmployee(
  id: string,
  patch: Partial<Omit<Employee, 'id' | 'createdAt'>>,
): Promise<Employee | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.firstName !== undefined) dbPatch.first_name = patch.firstName;
  if (patch.lastName !== undefined) dbPatch.last_name = patch.lastName;
  if (patch.initials !== undefined) dbPatch.initials = patch.initials;
  if (patch.pin !== undefined) dbPatch.pin = patch.pin;
  if (patch.department !== undefined) dbPatch.department = patch.department;
  if (patch.role !== undefined) dbPatch.role = patch.role;
  if (patch.employmentStatus !== undefined) dbPatch.employment_status = patch.employmentStatus;
  if (patch.payType !== undefined) dbPatch.pay_type = patch.payType;
  // Use `in` (not `!== undefined`) so that explicitly passing the key with
  // an undefined / null value CLEARS the column in the database. Otherwise
  // clearing the rate field in EmployeeDialog silently no-ops.
  if ('hourlyRate' in patch) dbPatch.hourly_rate = patch.hourlyRate ?? null;
  if ('salary' in patch) dbPatch.salary = patch.salary ?? null;
  if (patch.isFullTimeEligible !== undefined) dbPatch.is_full_time_eligible = patch.isFullTimeEligible;
  if (patch.fullTimeOverride !== undefined) dbPatch.full_time_override = patch.fullTimeOverride ?? null;
  if (patch.userRole !== undefined) dbPatch.user_role = patch.userRole;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  // Hire date — same `in` pattern so clearing it works.
  if ('hireDate' in patch) dbPatch.hire_date = patch.hireDate ?? null;
  // Offboarding fields — same `in` pattern so clearing them works.
  if ('endDate' in patch) dbPatch.end_date = patch.endDate ?? null;
  if ('endReason' in patch) dbPatch.end_reason = patch.endReason ?? '';

  const { data, error } = await supabase
    .from('employees')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[db] updateEmployee failed', error);
    return null;
  }
  return rowToEmployee(data as EmployeeRow);
}

/**
 * SOFT delete — sets deleted_at instead of actually removing the row.
 * This preserves time_entries and the foreign-key chain so payroll
 * history is never destroyed. Recover with restoreEmployee(); permanently
 * remove with purgeEmployee().
 */
export async function deleteEmployee(
  id: string,
  audit?: MutationAudit,
): Promise<boolean> {
  const { error } = await supabase
    .from('employees')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[db] deleteEmployee (soft) failed', error);
    return false;
  }
  await writeAuditLog({
    tableName: 'employees',
    recordId: id,
    action: 'delete',
    changes: { soft_delete: true },
    reason: audit?.reason ?? '',
    actorTier: audit?.actorTier,
    actorLabel: audit?.actorLabel,
  });
  return true;
}

/** Undo a soft-delete — clears deleted_at so the employee reappears
 *  in normal lists. */
export async function restoreEmployee(
  id: string,
  audit?: MutationAudit,
): Promise<boolean> {
  const { error } = await supabase
    .from('employees')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) {
    console.error('[db] restoreEmployee failed', error);
    return false;
  }
  await writeAuditLog({
    tableName: 'employees',
    recordId: id,
    action: 'update',
    changes: { restored_from_soft_delete: true },
    reason: audit?.reason ?? '',
    actorTier: audit?.actorTier,
    actorLabel: audit?.actorLabel,
  });
  return true;
}

/** PERMANENTLY removes the row — cascades to time_entries. Used by the
 *  Recently Deleted view's "Permanently delete" action. */
export async function purgeEmployee(
  id: string,
  audit?: MutationAudit,
): Promise<boolean> {
  await writeAuditLog({
    tableName: 'employees',
    recordId: id,
    action: 'delete',
    changes: { hard_delete: true, cascade: 'time_entries + breaks' },
    reason: audit?.reason ?? '',
    actorTier: audit?.actorTier,
    actorLabel: audit?.actorLabel,
  });
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) {
    console.error('[db] purgeEmployee failed', error);
    return false;
  }
  return true;
}

// ============================================================
// TIME ENTRIES (with breaks joined)
// ============================================================
export async function fetchTimeEntriesForDate(date: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, breaks(*)')
    .eq('entry_date', date)
    .order('clock_in', { ascending: true });
  if (error) {
    console.error('[db] fetchTimeEntriesForDate failed', error);
    return [];
  }
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  return (data as Joined[]).map(row =>
    rowToTimeEntry(row, (row.breaks ?? []).map(rowToBreak)),
  );
}

/**
 * Range fetch — inclusive on both ends. Used by Payroll Export to pull
 * all entries in a pay period.
 */
export async function fetchTimeEntriesInRange(
  startDate: string,
  endDate: string,
): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, breaks(*)')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('clock_in', { ascending: true });
  if (error) {
    console.error('[db] fetchTimeEntriesInRange failed', error);
    return [];
  }
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  return (data as Joined[]).map((row) =>
    rowToTimeEntry(row, (row.breaks ?? []).map(rowToBreak)),
  );
}

export async function createTimeEntry(
  employeeId: string,
  department: string,
): Promise<TimeEntry | null> {
  const now = new Date();
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      employee_id: employeeId,
      clock_in: now.toISOString(),
      department,
      is_scheduled: true,
      entry_date: localDateString(now),
    })
    .select()
    .single();
  if (error) {
    console.error('[db] createTimeEntry failed', error);
    return null;
  }
  return rowToTimeEntry(data as TimeEntryRow, []);
}

export async function clockOutTimeEntry(timeEntryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', timeEntryId);
  if (error) {
    console.error('[db] clockOutTimeEntry failed', error);
    return false;
  }
  return true;
}

/**
 * Admin manual create — used by Admin → Time Tracking → "Add Entry" for
 * scenarios where someone forgot to clock in. Differs from `createTimeEntry`
 * (used by the kiosk) by taking explicit timestamps.
 */
export async function createManualTimeEntry(input: {
  employeeId: string;
  clockIn: string; // ISO
  clockOut?: string | null; // ISO or null
  department: string;
  notes?: string[];
  entryType?: TimeEntryType;
}): Promise<TimeEntry | null> {
  const entryDate = localDateString(new Date(input.clockIn));
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      employee_id: input.employeeId,
      clock_in: input.clockIn,
      clock_out: input.clockOut ?? null,
      department: input.department,
      is_scheduled: false,
      notes: input.notes ?? [],
      entry_date: entryDate,
      entry_type: input.entryType ?? 'work',
    })
    .select()
    .single();
  if (error) {
    console.error('[db] createManualTimeEntry failed', error);
    return null;
  }
  return rowToTimeEntry(data as TimeEntryRow, []);
}

/**
 * Audit/lock-aware patch options for time-entry mutations.
 * Pass `reason` whenever an admin edits a past entry — it becomes
 * the audit log row's reason and shows up in the history view.
 */
export interface MutationAudit {
  reason: string;
  /** Defaults to the current admin tier read from useAdminAuth's store. */
  actorTier?: ActorTier;
  /** Optional short label — usually the company shortName + tier. */
  actorLabel?: string;
}

export async function updateTimeEntry(
  id: string,
  patch: {
    clockIn?: string;
    clockOut?: string | null;
    department?: string;
    notes?: string[];
    entryType?: TimeEntryType;
  },
  audit?: MutationAudit,
): Promise<TimeEntry | null> {
  // Fetch the existing row so we can (a) check the pay-period lock and
  // (b) capture before-values for the audit log.
  const before = await fetchTimeEntryById(id);
  if (!before) {
    console.error('[db] updateTimeEntry: entry not found', id);
    return null;
  }

  // Pay-period lock check (client-side; mirrored in pay_periods table).
  // Use the OLD date — admins shouldn't be able to escape a lock by
  // shifting an entry forward.
  if (await isEntryDateLocked(before.date)) {
    console.warn('[db] updateTimeEntry blocked by closed pay period', before.date);
    return null;
  }
  // Also block moving an entry INTO a locked period.
  if (patch.clockIn) {
    const newDate = new Date(patch.clockIn).toISOString().split('T')[0];
    if (await isEntryDateLocked(newDate)) {
      console.warn(
        '[db] updateTimeEntry blocked: target date is in closed period',
        newDate,
      );
      return null;
    }
  }

  const dbPatch: Record<string, unknown> = {};
  if (patch.clockIn !== undefined) {
    dbPatch.clock_in = patch.clockIn;
    dbPatch.entry_date = localDateString(new Date(patch.clockIn));
  }
  if (patch.clockOut !== undefined) dbPatch.clock_out = patch.clockOut;
  if (patch.department !== undefined) dbPatch.department = patch.department;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.entryType !== undefined) dbPatch.entry_type = patch.entryType;

  const { data, error } = await supabase
    .from('time_entries')
    .update(dbPatch)
    .eq('id', id)
    .select('*, breaks(*)')
    .single();
  if (error) {
    console.error('[db] updateTimeEntry failed', error);
    return null;
  }
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  const joined = data as Joined;
  const updated = rowToTimeEntry(joined, (joined.breaks ?? []).map(rowToBreak));

  // Record a diff in the audit log (don't fail the update if logging fails).
  const diff = diffFields(before, updated, [
    'clockIn',
    'clockOut',
    'department',
    'notes',
    'entryType',
  ]);
  await writeAuditLog({
    tableName: 'time_entries',
    recordId: id,
    action: 'update',
    changes: diff,
    reason: audit?.reason ?? '',
    actorTier: audit?.actorTier,
    actorLabel: audit?.actorLabel,
  });

  return updated;
}

export async function deleteTimeEntry(
  id: string,
  audit?: MutationAudit,
): Promise<boolean> {
  // Capture the row before deletion so the audit log shows what was lost.
  const before = await fetchTimeEntryById(id);
  if (!before) {
    console.error('[db] deleteTimeEntry: entry not found', id);
    return false;
  }
  if (await isEntryDateLocked(before.date)) {
    console.warn('[db] deleteTimeEntry blocked by closed pay period', before.date);
    return false;
  }

  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) {
    console.error('[db] deleteTimeEntry failed', error);
    return false;
  }

  await writeAuditLog({
    tableName: 'time_entries',
    recordId: id,
    action: 'delete',
    changes: {
      employeeId: { from: before.employeeId },
      clockIn: { from: before.clockIn },
      clockOut: { from: before.clockOut },
      department: { from: before.department },
      entryType: { from: before.entryType },
      breaks: { from: before.breaks.length },
    },
    reason: audit?.reason ?? '',
    actorTier: audit?.actorTier,
    actorLabel: audit?.actorLabel,
  });

  return true;
}

/**
 * Returns the most recent OPEN (no clock_out) time entry for an employee,
 * across ALL dates — not just today. Used by the kiosk to:
 *   - block double clock-ins (someone tries to clock in while already in)
 *   - detect "you forgot to clock out yesterday" before letting them clock
 *     in again, so we don't end up with phantom multi-day shifts.
 *
 * Returns null when the employee is properly clocked out.
 */
export async function fetchOpenEntryForEmployee(
  employeeId: string,
): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, breaks(*)')
    .eq('employee_id', employeeId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[db] fetchOpenEntryForEmployee failed', error);
    return null;
  }
  if (!data) return null;
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  const joined = data as Joined;
  return rowToTimeEntry(joined, (joined.breaks ?? []).map(rowToBreak));
}

/** Fetch a single time entry by id, with its breaks. Returns null on miss. */
export async function fetchTimeEntryById(id: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, breaks(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[db] fetchTimeEntryById failed', error);
    return null;
  }
  if (!data) return null;
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  const joined = data as Joined;
  return rowToTimeEntry(joined, (joined.breaks ?? []).map(rowToBreak));
}

/**
 * Returns every time_entry where clock_out is NULL and entry_date is
 * STRICTLY BEFORE today (local timezone) — i.e. someone forgot to clock
 * out on a prior day. Today's open shifts are excluded because those
 * are still valid (people are actively working).
 *
 * Used by the dashboard banner, sidebar badge, and Forgotten Punches view.
 */
export async function fetchForgottenClockOuts(): Promise<TimeEntry[]> {
  // Build "today" as a YYYY-MM-DD in the browser's local timezone so we
  // don't accidentally hide a same-day-but-still-open shift due to UTC drift.
  const today = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const { data, error } = await supabase
    .from('time_entries')
    .select('*, breaks(*)')
    .is('clock_out', null)
    .lt('entry_date', todayIso)
    .order('clock_in', { ascending: true });
  if (error) {
    console.error('[db] fetchForgottenClockOuts failed', error);
    return [];
  }
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  return (data as Joined[]).map((row) =>
    rowToTimeEntry(row, (row.breaks ?? []).map(rowToBreak)),
  );
}

/** Range fetch for one employee — used by the per-employee time card view. */
export async function fetchTimeEntriesForEmployeeInRange(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, breaks(*)')
    .eq('employee_id', employeeId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('clock_in', { ascending: true });
  if (error) {
    console.error('[db] fetchTimeEntriesForEmployeeInRange failed', error);
    return [];
  }
  type Joined = TimeEntryRow & { breaks: BreakRow[] };
  return (data as Joined[]).map((row) =>
    rowToTimeEntry(row, (row.breaks ?? []).map(rowToBreak)),
  );
}

export async function deleteBreak(id: string): Promise<boolean> {
  const { error } = await supabase.from('breaks').delete().eq('id', id);
  if (error) {
    console.error('[db] deleteBreak failed', error);
    return false;
  }
  return true;
}

/**
 * Update a break/lunch row — used by the admin Time Entry dialog when an
 * employee forgot to clock back in from lunch (etc.), so an admin needs
 * to set a realistic end time. Writes to the audit log on success.
 *
 * Returns the updated BreakEntry or null if the update failed.
 */
export async function updateBreak(
  id: string,
  patch: {
    startTime?: string;          // ISO
    endTime?: string | null;     // ISO or null to clear
    type?: 'break' | 'lunch';
  },
  audit?: MutationAudit,
): Promise<BreakEntry | null> {
  // Capture before-values for the audit diff.
  const beforeRes = await supabase
    .from('breaks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (beforeRes.error || !beforeRes.data) {
    console.error('[db] updateBreak: row not found', id);
    return null;
  }
  const before = rowToBreak(beforeRes.data as BreakRow);

  const dbPatch: Record<string, unknown> = {};
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime;
  if (patch.type !== undefined) dbPatch.break_type = patch.type;

  const { data, error } = await supabase
    .from('breaks')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[db] updateBreak failed', error);
    return null;
  }
  const updated = rowToBreak(data as BreakRow);

  // Diff against before for the audit log, only including changed fields.
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (before.startTime !== updated.startTime)
    diff.startTime = { from: before.startTime, to: updated.startTime };
  if (before.endTime !== updated.endTime)
    diff.endTime = { from: before.endTime ?? null, to: updated.endTime ?? null };
  if (before.type !== updated.type)
    diff.type = { from: before.type, to: updated.type };
  if (Object.keys(diff).length > 0) {
    await writeAuditLog({
      tableName: 'breaks',
      recordId: id,
      action: 'update',
      changes: diff,
      reason: audit?.reason ?? '',
      actorTier: audit?.actorTier,
      actorLabel: audit?.actorLabel,
    });
  }
  return updated;
}

/**
 * Admin manual create — used when an employee took a lunch (or break) but
 * forgot to tap the kiosk button. Differs from `startBreak` (used by the
 * kiosk) by taking explicit start/end timestamps. Audit-logged.
 */
export async function createBreak(
  timeEntryId: string,
  input: {
    startTime: string;        // ISO
    endTime?: string | null;  // ISO or null (e.g. still on break)
    type: 'break' | 'lunch';
  },
  audit?: MutationAudit,
): Promise<BreakEntry | null> {
  const { data, error } = await supabase
    .from('breaks')
    .insert({
      time_entry_id: timeEntryId,
      break_type: input.type,
      start_time: input.startTime,
      end_time: input.endTime ?? null,
      expected_return: null,
    })
    .select()
    .single();
  if (error) {
    console.error('[db] createBreak failed', error);
    return null;
  }
  const created = rowToBreak(data as BreakRow);
  await writeAuditLog({
    tableName: 'breaks',
    recordId: created.id,
    action: 'create',
    changes: {
      time_entry_id: timeEntryId,
      break_type: input.type,
      start_time: input.startTime,
      end_time: input.endTime ?? null,
    },
    reason: audit?.reason ?? '',
    actorTier: audit?.actorTier,
    actorLabel: audit?.actorLabel,
  });
  return created;
}

export async function startBreak(
  timeEntryId: string,
  type: 'break' | 'lunch',
): Promise<BreakEntry | null> {
  const now = new Date();
  const expectedReturn = new Date(now.getTime() + (type === 'lunch' ? 30 : 15) * 60000);
  const { data, error } = await supabase
    .from('breaks')
    .insert({
      time_entry_id: timeEntryId,
      break_type: type,
      start_time: now.toISOString(),
      expected_return: expectedReturn.toISOString(),
    })
    .select()
    .single();
  if (error) {
    console.error('[db] startBreak failed', error);
    return null;
  }
  return rowToBreak(data as BreakRow);
}

export async function endBreak(breakId: string): Promise<boolean> {
  const { error } = await supabase
    .from('breaks')
    .update({ end_time: new Date().toISOString() })
    .eq('id', breakId);
  if (error) {
    console.error('[db] endBreak failed', error);
    return false;
  }
  return true;
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[db] fetchActiveAnnouncements failed', error);
    return [];
  }
  return (data as AnnouncementRow[]).map(rowToAnnouncement);
}

export async function createAnnouncement(input: {
  text: string;
  priority: 'normal' | 'urgent';
  expiresAt: string;
  createdBy?: string;
}): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      text: input.text,
      priority: input.priority,
      expires_at: input.expiresAt,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error('[db] createAnnouncement failed', error);
    return null;
  }
  return rowToAnnouncement(data as AnnouncementRow);
}

export async function updateAnnouncement(
  id: string,
  patch: { text?: string; priority?: 'normal' | 'urgent'; expiresAt?: string },
): Promise<Announcement | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.text !== undefined) dbPatch.text = patch.text;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt;
  const { data, error } = await supabase
    .from('announcements')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[db] updateAnnouncement failed', error);
    return null;
  }
  return rowToAnnouncement(data as AnnouncementRow);
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    console.error('[db] deleteAnnouncement failed', error);
    return false;
  }
  return true;
}

// ============================================================
// ATTENDANCE NOTES
// ============================================================
interface AttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  note: string;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToAttendance(r: AttendanceRow): AttendanceNote {
  return {
    id: r.id,
    employeeId: r.employee_id,
    date: r.date,
    status: r.status,
    note: r.note,
    recordedBy: r.recorded_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchAttendanceForDate(date: string): Promise<AttendanceNote[]> {
  const { data, error } = await supabase
    .from('attendance_notes')
    .select('*')
    .eq('date', date);
  if (error) {
    console.error('[db] fetchAttendanceForDate failed', error);
    return [];
  }
  return (data as AttendanceRow[]).map(rowToAttendance);
}

/**
 * Insert or update the attendance row for (employee_id, date).
 * Uses Postgres ON CONFLICT (via Supabase upsert) on the unique index.
 */
export async function upsertAttendance(input: {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  recordedBy?: string;
}): Promise<AttendanceNote | null> {
  const { data, error } = await supabase
    .from('attendance_notes')
    .upsert(
      {
        employee_id: input.employeeId,
        date: input.date,
        status: input.status,
        note: input.note ?? '',
        recorded_by: input.recordedBy ?? null,
      },
      { onConflict: 'employee_id,date' },
    )
    .select()
    .single();
  if (error) {
    console.error('[db] upsertAttendance failed', error);
    return null;
  }
  return rowToAttendance(data as AttendanceRow);
}

export async function deleteAttendance(id: string): Promise<boolean> {
  const { error } = await supabase.from('attendance_notes').delete().eq('id', id);
  if (error) {
    console.error('[db] deleteAttendance failed', error);
    return false;
  }
  return true;
}

// ============================================================
// COMPANY SETTINGS (singleton row, id = 1)
// ============================================================
interface CompanySettingsRow {
  id: number;
  name: string;
  short_name: string;
  logo_letter: string;
  logo_url: string | null;
  tagline: string;
  primary_color: string;
  accent_color: string;
  timezone: string;
  currency: string;
  schedule_csv_url: string | null;
  departments: string[];
  roles: string[];
  updated_at: string;
}

function rowToCompany(r: CompanySettingsRow): Company {
  return {
    name: r.name,
    shortName: r.short_name,
    logoLetter: r.logo_letter,
    logoUrl: r.logo_url ?? undefined,
    tagline: r.tagline,
    primaryColor: r.primary_color,
    accentColor: r.accent_color,
    timezone: r.timezone,
    currency: r.currency,
    scheduleCsvUrl: r.schedule_csv_url ?? undefined,
    departments: r.departments,
    roles: r.roles,
  };
}

export async function fetchCompanySettings(): Promise<Company | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('[db] fetchCompanySettings failed', error);
    return null;
  }
  if (!data) return null;
  return rowToCompany(data as CompanySettingsRow);
}

// ============================================================
// AUDIT LOG
// ============================================================
interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  changes: Record<string, unknown>;
  reason: string;
  actor_tier: ActorTier;
  actor_label: string;
  created_at: string;
}

function rowToAuditLog(r: AuditLogRow): AuditLogEntry {
  return {
    id: r.id,
    tableName: r.table_name,
    recordId: r.record_id,
    action: r.action,
    changes: r.changes,
    reason: r.reason,
    actorTier: r.actor_tier,
    actorLabel: r.actor_label,
    createdAt: r.created_at,
  };
}

/**
 * Read the actor tier from the same localStorage key that useAdminAuth
 * persists to. Lets db.ts log audits without taking a hook dependency.
 * Falls back to 'manager' (the weaker tier) when nothing is set.
 */
function readActorTierFromStorage(): ActorTier {
  try {
    const v =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('team-timeflow.admin-auth')
        : null;
    if (v === 'owner' || v === 'manager') return v;
  } catch {
    // ignore
  }
  return 'manager';
}

interface WriteAuditOptions {
  tableName: string;
  recordId: string;
  action: AuditAction;
  changes: Record<string, unknown>;
  reason: string;
  actorTier?: ActorTier;
  actorLabel?: string;
}

/** Insert one audit_log row. Never throws — logging failures shouldn't
 * block the actual mutation that called us. */
export async function writeAuditLog(opts: WriteAuditOptions): Promise<boolean> {
  const tier = opts.actorTier ?? readActorTierFromStorage();
  const { error } = await supabase.from('audit_log').insert({
    table_name: opts.tableName,
    record_id: opts.recordId,
    action: opts.action,
    changes: opts.changes,
    reason: opts.reason,
    actor_tier: tier,
    actor_label: opts.actorLabel ?? '',
  });
  if (error) {
    console.error('[db] writeAuditLog failed', error);
    return false;
  }
  return true;
}

/**
 * Returns audit rows, optionally filtered by table+record. Pass nothing
 * to get the most recent N rows across everything.
 */
export async function fetchAuditLog(opts?: {
  tableName?: string;
  recordId?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let q = supabase.from('audit_log').select('*');
  if (opts?.tableName) q = q.eq('table_name', opts.tableName);
  if (opts?.recordId) q = q.eq('record_id', opts.recordId);
  q = q.order('created_at', { ascending: false }).limit(opts?.limit ?? 100);

  const { data, error } = await q;
  if (error) {
    console.error('[db] fetchAuditLog failed', error);
    return [];
  }
  return (data as AuditLogRow[]).map(rowToAuditLog);
}

// ============================================================
// PAY PERIODS
// ============================================================
interface PayPeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  label: string;
  is_closed: boolean;
  closed_at: string | null;
  closed_by_tier: ActorTier | null;
  closed_reason: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function rowToPayPeriod(r: PayPeriodRow): PayPeriod {
  return {
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    label: r.label,
    isClosed: r.is_closed,
    closedAt: r.closed_at ?? undefined,
    closedByTier: r.closed_by_tier ?? undefined,
    closedReason: r.closed_reason,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchPayPeriods(): Promise<PayPeriod[]> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) {
    console.error('[db] fetchPayPeriods failed', error);
    return [];
  }
  return (data as PayPeriodRow[]).map(rowToPayPeriod);
}

/** Returns the pay period (if any) that contains the given YYYY-MM-DD. */
export async function fetchPayPeriodForDate(
  date: string,
): Promise<PayPeriod | null> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('*')
    .lte('start_date', date)
    .gte('end_date', date)
    .maybeSingle();
  if (error) {
    console.error('[db] fetchPayPeriodForDate failed', error);
    return null;
  }
  return data ? rowToPayPeriod(data as PayPeriodRow) : null;
}

export async function createPayPeriod(input: {
  startDate: string;
  endDate: string;
  label?: string;
  notes?: string;
}): Promise<PayPeriod | null> {
  const { data, error } = await supabase
    .from('pay_periods')
    .insert({
      start_date: input.startDate,
      end_date: input.endDate,
      label: input.label ?? '',
      notes: input.notes ?? '',
    })
    .select()
    .single();
  if (error) {
    console.error('[db] createPayPeriod failed', error);
    return null;
  }
  return rowToPayPeriod(data as PayPeriodRow);
}

export async function closePayPeriod(
  id: string,
  opts: { reason: string; actorTier?: ActorTier },
): Promise<PayPeriod | null> {
  const tier = opts.actorTier ?? readActorTierFromStorage();
  const { data, error } = await supabase
    .from('pay_periods')
    .update({
      is_closed: true,
      closed_at: new Date().toISOString(),
      closed_by_tier: tier,
      closed_reason: opts.reason,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[db] closePayPeriod failed', error);
    return null;
  }
  await writeAuditLog({
    tableName: 'pay_periods',
    recordId: id,
    action: 'update',
    changes: { isClosed: { from: false, to: true } },
    reason: opts.reason,
    actorTier: tier,
  });
  return rowToPayPeriod(data as PayPeriodRow);
}

export async function reopenPayPeriod(
  id: string,
  opts: { reason: string; actorTier?: ActorTier },
): Promise<PayPeriod | null> {
  const tier = opts.actorTier ?? readActorTierFromStorage();
  const { data, error } = await supabase
    .from('pay_periods')
    .update({
      is_closed: false,
      closed_at: null,
      closed_by_tier: null,
      closed_reason: '',
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[db] reopenPayPeriod failed', error);
    return null;
  }
  await writeAuditLog({
    tableName: 'pay_periods',
    recordId: id,
    action: 'update',
    changes: { isClosed: { from: true, to: false } },
    reason: opts.reason,
    actorTier: tier,
  });
  return rowToPayPeriod(data as PayPeriodRow);
}

export async function deletePayPeriod(id: string): Promise<boolean> {
  const { error } = await supabase.from('pay_periods').delete().eq('id', id);
  if (error) {
    console.error('[db] deletePayPeriod failed', error);
    return false;
  }
  return true;
}

/** Returns true if the given YYYY-MM-DD falls inside a closed pay period. */
export async function isEntryDateLocked(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('id')
    .eq('is_closed', true)
    .lte('start_date', date)
    .gte('end_date', date)
    .limit(1);
  if (error) {
    console.error('[db] isEntryDateLocked failed', error);
    return false; // fail-open: don't block mutations on a metadata query failure
  }
  return (data?.length ?? 0) > 0;
}

/** Build a `{ field: { from, to } }` diff object for the audit log,
 *  including only fields whose value actually changed. */
function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: (keyof T)[],
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    const a = before[f];
    const b = after[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[f as string] = { from: a, to: b };
    }
  }
  return diff;
}

// ============================================================
// COMPANY SETTINGS (continued)
// ============================================================
export async function updateCompanySettings(patch: Partial<Company>): Promise<Company | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.shortName !== undefined) dbPatch.short_name = patch.shortName;
  if (patch.logoLetter !== undefined) dbPatch.logo_letter = patch.logoLetter;
  if (patch.logoUrl !== undefined) dbPatch.logo_url = patch.logoUrl ?? null;
  if (patch.tagline !== undefined) dbPatch.tagline = patch.tagline;
  if (patch.primaryColor !== undefined) dbPatch.primary_color = patch.primaryColor;
  if (patch.accentColor !== undefined) dbPatch.accent_color = patch.accentColor;
  if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.scheduleCsvUrl !== undefined) dbPatch.schedule_csv_url = patch.scheduleCsvUrl ?? null;
  if (patch.departments !== undefined) dbPatch.departments = patch.departments;
  if (patch.roles !== undefined) dbPatch.roles = patch.roles;

  const { data, error } = await supabase
    .from('company_settings')
    .update(dbPatch)
    .eq('id', 1)
    .select()
    .single();
  if (error) {
    console.error('[db] updateCompanySettings failed', error);
    return null;
  }
  return rowToCompany(data as CompanySettingsRow);
}
