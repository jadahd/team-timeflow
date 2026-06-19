// Core types for the Team TimeFlow Workforce Management System
// Built by JD Marketing & Consulting LLC.

export type EmployeeStatus = 'clocked-in' | 'on-break' | 'on-lunch' | 'clocked-out';
export type PayType = 'hourly' | 'salary';
export type EmploymentStatus = 'full-time' | 'part-time' | 'seasonal' | 'contractor';
export type UserRole = 'employee' | 'manager' | 'admin';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  pin: string;
  department: string;
  role: string;
  employmentStatus: EmploymentStatus;
  payType: PayType;
  hourlyRate?: number; // admin-only
  salary?: number; // admin-only
  isFullTimeEligible: boolean;
  fullTimeOverride?: boolean;
  userRole: UserRole;
  locationId: string;
  companyId: string;
  isActive: boolean;
  /** First day of employment (YYYY-MM-DD). Powers work-anniversary
   *  announcements on the kiosk and the admin dashboard. */
  hireDate?: string;
  /** Last day of employment (YYYY-MM-DD). Undefined while currently employed.
   *  Used so past pay periods still calculate paychecks correctly after
   *  an employee is marked inactive. */
  endDate?: string;
  /** Optional reason recorded when the employee was offboarded. */
  endReason?: string;
  /** Soft-delete timestamp. Non-empty means the row is hidden everywhere
   *  except the Recently Deleted view. Restore clears this. */
  deletedAt?: string;
  createdAt: string;
}

/**
 * Categorizes a time entry. 'work' is the default for regular clock-ins
 * from the kiosk. The other types are for admin-created entries that
 * represent paid-but-not-worked time (vacation, sick, etc.). When
 * payroll calculations get smarter, this is the field that segregates
 * regular hours from PTO hours.
 */
export type TimeEntryType =
  | 'work'
  | 'vacation'
  | 'sick'
  | 'pto'
  | 'holiday'
  | 'bereavement'
  | 'jury-duty'
  | 'other';

export interface TimeEntry {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut?: string;
  breaks: BreakEntry[];
  notes: string[];
  isScheduled: boolean;
  department: string;
  date: string;
  entryType: TimeEntryType;
}

export interface BreakEntry {
  id: string;
  type: 'break' | 'lunch';
  startTime: string;
  endTime?: string;
  expectedReturn?: string;
}

export interface Announcement {
  id: string;
  text: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
  expiresAt: string;
  createdBy: string;
}

export interface OvertimeConfig {
  payPeriodStart: 'friday'; // Friday–Thursday
  otThresholdHours: number; // 40
  otMultiplier: number; // 1.5
  excludeSalaried: boolean;
  excludeRoles: string[];
}

export interface PayrollSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  /** Hours actually worked (entry_type='work'). Counts toward the 40h OT threshold. */
  workedHours: number;
  /** Worked hours up to 40 — straight time. */
  regularHours: number;
  /** Worked hours over 40 — paid at OT multiplier. */
  overtimeHours: number;
  /** Hours from PTO/sick/holiday/bereavement/jury-duty/other.
   *  Paid at straight time but EXCLUDED from the OT threshold. */
  paidLeaveHours: number;
  /** workedHours + paidLeaveHours. Display only. */
  totalHours: number;
  hourlyRate: number;
  regularPay: number;
  overtimePay: number;
  paidLeavePay: number;
  grossPay: number;
  notes: string[];
}

// Attendance tracking — what management records when employees call in,
// are late, sick, etc. One row per employee per day.
export type AttendanceStatus =
  | 'working'
  | 'working-remotely'
  | 'called-in'
  | 'late'
  | 'sick'
  | 'pto'
  | 'no-call-no-show'
  | 'other';

export interface AttendanceNote {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note: string;
  recordedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Schedule shift parsed from a Google Sheet CSV.
export interface ScheduleShift {
  date: string; // YYYY-MM-DD
  employeeName: string; // raw value from sheet
  /** Matched employee id when name resolves to a known employee, else null. */
  employeeId: string | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  department?: string;
  notes?: string;
}

// Kiosk display types (customer-safe, no pay info)
export interface KioskEmployeeStatus {
  initials: string;
  firstName: string;
  role: string;
  department: string;
  status: EmployeeStatus;
  breakReturnTime?: string;
  /** ISO timestamp when the current break/lunch started.
   *  Used to compute overdue indicators when someone has been on lunch
   *  past the LONG_LUNCH_MINUTES threshold. */
  breakStartTime?: string;
}

/** Threshold in minutes — a lunch this long or longer triggers the overdue
 *  alert on the kiosk staff board and the admin dashboard banner. */
export const LONG_LUNCH_MINUTES = 60;

// ============================================================
// Audit log — every meaningful admin change to time data is
// recorded so payroll edits stay traceable.
// ============================================================
export type AuditAction = 'create' | 'update' | 'delete';
export type ActorTier = 'owner' | 'manager';

export interface AuditLogEntry {
  id: string;
  tableName: string;            // 'time_entries', 'breaks', etc.
  recordId: string;             // PK of the affected row
  action: AuditAction;
  changes: Record<string, { from?: unknown; to?: unknown }> | Record<string, unknown>;
  reason: string;               // free-text reason supplied by admin
  actorTier: ActorTier;
  actorLabel: string;           // short label, e.g. company name + tier
  createdAt: string;
}

// ============================================================
// Pay periods — named date ranges that can be marked closed.
// When closed, the app refuses to update/delete time_entries
// whose entry_date falls inside the range.
// ============================================================
export interface PayPeriod {
  id: string;
  startDate: string;            // YYYY-MM-DD inclusive
  endDate: string;              // YYYY-MM-DD inclusive
  label: string;                // optional human label
  isClosed: boolean;
  closedAt?: string;
  closedByTier?: ActorTier;
  closedReason: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
