import { useCallback, useEffect, useState } from 'react';
import { Employee, ScheduleShift } from '@/types/workforce';
import { useCompany } from '@/hooks/useCompany';
import { useEmployees } from '@/hooks/useEmployees';

/**
 * Fetches the company's published Google Sheets CSV and parses it
 * into typed ScheduleShift rows.
 *
 * Supports two formats, auto-detected:
 *
 * FLAT — one row per shift (recommended for new sheets):
 *   Date,Employee,Start,End,Department,Notes
 *   2026-05-15,Marcus Johnson,08:00,17:00,Retail,
 *
 * GRID — one row per employee, day-of-week columns (matches existing
 * SACS-style sheets):
 *
 *   SACS SCHEDULE
 *   For the Week of: 05/15/26 - 05/21/26
 *   Employee, FRIDAY, SATURDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, Total Hours
 *   Mr. Joey, OFF, 8:00AM - 4:00PM, 8:00AM - 6:00PM, ...
 *
 * Returns the list, a `refresh` callback, and a `status` string for the UI.
 */
export function useSchedule() {
  const { company } = useCompany();
  const employees = useEmployees();
  // Accept one or more URLs, split on newlines. Manager pastes multiple tabs
  // (e.g. "this week" + "next week"), one per line.
  const urls = (company.scheduleCsvUrl ?? '')
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [incompleteWeeks, setIncompleteWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (urls.length === 0) {
      setShifts([]);
      setIncompleteWeeks([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch every URL in parallel. One failed sheet shouldn't blank the rest.
      const results = await Promise.allSettled(
        urls.map(async (url) => {
          const resp = await fetch(url, { cache: 'no-store' });
          if (!resp.ok) throw new Error(`Sheet returned ${resp.status}`);
          const text = await resp.text();
          return parseScheduleCsv(text, employees);
        }),
      );
      const allShifts: ScheduleShift[] = [];
      const incomplete: string[] = [];
      const failures: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.status === 'incomplete') {
            // Hide shifts from tabs marked Incomplete; surface in a banner.
            incomplete.push(r.value.weekStart ?? `Tab ${i + 1}`);
          } else {
            allShifts.push(...r.value.shifts);
          }
        } else {
          failures.push(`Tab ${i + 1}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`);
        }
      });
      setShifts(allShifts);
      setIncompleteWeeks(incomplete);
      if (failures.length === urls.length) {
        setError(failures.join(' · '));
      } else if (failures.length > 0) {
        // Partial success — log but don't block the UI.
        console.warn('[useSchedule] some tabs failed', failures);
      }
      setLastFetched(new Date());
    } catch (err) {
      console.error('[useSchedule] fetch failed', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load schedule. Check the URLs in Company Settings.',
      );
      setShifts([]);
      setIncompleteWeeks([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.scheduleCsvUrl, employees]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Convenience: just today's shifts. */
  const todayShifts = shifts.filter(
    (s) => s.date === new Date().toISOString().split('T')[0],
  );

  /** Schedule names that didn't match any employee in the database. */
  const unmatchedNames = Array.from(
    new Set(shifts.filter((s) => !s.employeeId).map((s) => s.employeeName)),
  );

  return {
    shifts,
    todayShifts,
    unmatchedNames,
    incompleteWeeks,
    loading,
    error,
    refresh,
    lastFetched,
    configured: urls.length > 0,
    urlCount: urls.length,
  };
}

// ============================================================
// CSV parsing — entry point + format detection
// ============================================================

/** Maps a lowercase day name (or abbreviation) to JS day-of-week index (0=Sun). */
const DAY_NAME_TO_IDX: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/** Status of a parsed schedule tab. 'unknown' means no Complete/Incomplete
 *  indicator was found, in which case we treat the tab as complete (most
 *  sheets won't have this dropdown). */
export type ScheduleTabStatus = 'complete' | 'incomplete' | 'unknown';

export interface ScheduleParseResult {
  shifts: ScheduleShift[];
  status: ScheduleTabStatus;
  /** YYYY-MM-DD of the first day this tab covers, for UI messages. */
  weekStart: string | null;
}

export function parseScheduleCsv(text: string, employees: Employee[]): ScheduleParseResult {
  const rows = parseCsvText(text);
  const empty: ScheduleParseResult = { shifts: [], status: 'unknown', weekStart: null };
  if (rows.length === 0) return empty;

  const status = detectScheduleStatus(rows);

  // Look for the header row — for FLAT it has "Date" + "Employee";
  // for GRID it has "Employee" + at least one day-name column.
  let headerIdx = -1;
  let headerKind: 'flat' | 'grid' | null = null;
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map((c) => c.toLowerCase().trim());
    const hasEmployee = lower.some((c) => c === 'employee' || c === 'name');
    if (!hasEmployee) continue;
    if (lower.includes('date')) {
      headerIdx = i;
      headerKind = 'flat';
      break;
    }
    const hasDayCols = lower.some((c) => DAY_NAME_TO_IDX[c] !== undefined);
    if (hasDayCols) {
      headerIdx = i;
      headerKind = 'grid';
      break;
    }
  }
  if (headerIdx === -1 || !headerKind) {
    console.warn('[useSchedule] Could not find a valid header row.');
    return { ...empty, status };
  }

  let shifts: ScheduleShift[];
  let weekStart: string | null = null;
  if (headerKind === 'flat') {
    shifts = parseFlatRows(rows, headerIdx, employees);
    if (shifts.length > 0) weekStart = shifts[0].date;
  } else {
    weekStart = findWeekStart(rows, headerIdx);
    shifts = parseGridRows(rows, headerIdx, employees);
  }

  return { shifts, status, weekStart };
}

/** Looks for a cell containing exactly "complete" or "incomplete" (case
 *  insensitive) — typically a Google Sheets dropdown the manager uses to
 *  flag whether the week's schedule is finalized. */
function detectScheduleStatus(rows: string[][]): ScheduleTabStatus {
  // Incomplete wins ties — safer to hide than to show partial data.
  let sawComplete = false;
  for (const row of rows) {
    for (const cell of row) {
      const lower = cell.trim().toLowerCase();
      if (lower === 'incomplete') return 'incomplete';
      if (lower === 'complete') sawComplete = true;
    }
  }
  return sawComplete ? 'complete' : 'unknown';
}

// ============================================================
// FLAT format: Date,Employee,Start,End,Department,Notes
// ============================================================
function parseFlatRows(
  rows: string[][],
  headerIdx: number,
  employees: Employee[],
): ScheduleShift[] {
  const headers = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const idx = (name: string) => headers.indexOf(name);
  const dateCol = idx('date');
  const empCol = headers.findIndex((h) => h === 'employee' || h === 'name');
  const startCol = idx('start');
  const endCol = idx('end');
  const deptCol = idx('department');
  const notesCol = idx('notes');

  const out: ScheduleShift[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const fields = rows[i];
    if (fields.length === 0 || fields.every((f) => !f.trim())) continue;
    const date = normalizeDate(fields[dateCol] ?? '');
    const employeeName = (fields[empCol] ?? '').trim();
    const start = normalizeTime(fields[startCol] ?? '');
    const end = normalizeTime(fields[endCol] ?? '');
    if (!date || !employeeName) continue;
    out.push({
      date,
      employeeName,
      employeeId: matchEmployee(employeeName, employees),
      startTime: start,
      endTime: end,
      department: deptCol !== -1 ? fields[deptCol] : undefined,
      notes: notesCol !== -1 ? fields[notesCol] : undefined,
    });
  }
  return out;
}

// ============================================================
// GRID format: rows are employees, columns are days of the week
// ============================================================
function parseGridRows(
  rows: string[][],
  headerIdx: number,
  employees: Employee[],
): ScheduleShift[] {
  const headers = rows[headerIdx];
  const headersLower = headers.map((h) => h.toLowerCase().trim());

  // Find which columns correspond to which day of the week.
  const dayColumns: { col: number; dayIdx: number }[] = [];
  let employeeCol = -1;
  for (let c = 0; c < headersLower.length; c++) {
    const h = headersLower[c];
    if (h === 'employee' || h === 'name') employeeCol = c;
    const dayIdx = DAY_NAME_TO_IDX[h];
    if (dayIdx !== undefined) dayColumns.push({ col: c, dayIdx });
  }
  if (employeeCol === -1 || dayColumns.length === 0) {
    console.warn('[useSchedule] Grid header missing Employee or day columns.');
    return [];
  }

  // Find the start date — scan rows above the header for "MM/DD/YY" patterns.
  const weekStart = findWeekStart(rows, headerIdx);
  if (!weekStart) {
    console.warn(
      '[useSchedule] Grid schedule has no recognisable week date. ' +
        'Add a row like "For the Week of: 05/15/26" above the header.',
    );
    return [];
  }
  // Map each day column to an actual YYYY-MM-DD date.
  const colDates = new Map<number, string>();
  for (const { col, dayIdx } of dayColumns) {
    colDates.set(col, dateForDayOfWeekOnOrAfter(weekStart, dayIdx));
  }

  const out: ScheduleShift[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;
    const employeeName = (row[employeeCol] ?? '').trim();
    if (!employeeName) continue;
    // Skip footer rows like "Daily Total"
    if (/^(daily\s+total|total|grand\s+total|notes?)/i.test(employeeName)) continue;

    const employeeId = matchEmployee(employeeName, employees);
    for (const { col } of dayColumns) {
      const cell = (row[col] ?? '').trim();
      if (!cell) continue;
      // Treat OFF / REQUESTED / TBD as no shift.
      if (/^(off|requested|tbd|n\/?a|—|-)$/i.test(cell)) continue;
      const range = parseTimeRange(cell);
      if (!range) continue;
      const date = colDates.get(col)!;
      out.push({
        date,
        employeeName,
        employeeId,
        startTime: range.start,
        endTime: range.end,
      });
    }
  }
  return out;
}

/** Find a date in the rows above the header. Returns YYYY-MM-DD. */
function findWeekStart(rows: string[][], headerIdx: number): string | null {
  for (let r = 0; r < headerIdx; r++) {
    for (const cell of rows[r]) {
      const m = cell.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (m) {
        const d = normalizeDate(m[1]);
        if (d) return d;
      }
      const iso = cell.match(/(\d{4}-\d{2}-\d{2})/);
      if (iso) return iso[1];
    }
  }
  return null;
}

/** Given a YYYY-MM-DD start date and a target day-of-week index,
 *  returns the first date on or after start that falls on that weekday. */
function dateForDayOfWeekOnOrAfter(startISO: string, targetDayIdx: number): string {
  const [y, m, d] = startISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  while (date.getDay() !== targetDayIdx) {
    date.setDate(date.getDate() + 1);
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse "8:00AM - 4:00PM" → { start: "08:00", end: "16:00" }. */
function parseTimeRange(raw: string): { start: string; end: string } | null {
  // Replace various dash characters with a normal hyphen.
  const cleaned = raw.replace(/[–—]/g, '-');
  const parts = cleaned.split('-').map((p) => p.trim());
  if (parts.length < 2) return null;
  const start = normalizeTime(parts[0]);
  const end = normalizeTime(parts.slice(1).join('-'));
  if (!start || !end) return null;
  return { start, end };
}

// ============================================================
// Shared helpers
// ============================================================

/** Parse a full CSV file into rows-of-cells. */
function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  return lines.map(splitCsvLine);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else if (c === '"') {
      inQuotes = true;
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeTime(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  // 24-hour first ("9:00", "09:00")
  let m = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  // 12-hour with AM/PM ("9:00AM", "9:00 AM", "5 PM")
  m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ?? '00';
    const isPm = m[3] === 'PM';
    if (h === 12 && !isPm) h = 0;
    else if (h !== 12 && isPm) h += 12;
    return `${h.toString().padStart(2, '0')}:${min}`;
  }
  return raw;
}

/** Strip honorifics like "Mr.", "Mrs.", "Ms." for fuzzier matching. */
function stripHonorifics(name: string): string {
  return name.replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '').trim();
}

/** Match a schedule's employee cell to a known employee.
 *  Tries: exact full name → bare first name (unique) → initials. */
function matchEmployee(rawName: string, employees: Employee[]): string | null {
  const normalized = stripHonorifics(rawName).toLowerCase();
  if (!normalized) return null;

  // Full "First Last" match
  let match = employees.find(
    (e) => `${e.firstName} ${e.lastName}`.toLowerCase() === normalized,
  );
  if (match) return match.id;

  // Initials
  match = employees.find((e) => e.initials.toLowerCase() === normalized);
  if (match) return match.id;

  // First name only — only if unique
  const firstNameMatches = employees.filter(
    (e) => e.firstName.toLowerCase() === normalized,
  );
  if (firstNameMatches.length === 1) return firstNameMatches[0].id;

  return null;
}
