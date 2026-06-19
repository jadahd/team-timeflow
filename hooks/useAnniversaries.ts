// Work-anniversary detection.
//
// Reads every active employee's `hireDate`, compares their hire month+day
// to today, and returns a list of:
//   - synthetic Announcement objects ready to drop into the kiosk ticker
//   - employee+years pairs for the admin dashboard celebration card
//
// Detection runs in the browser — no scheduled task or daily cron required.
// Auto-recomputes if the local date rolls past midnight.

import { useEffect, useMemo, useState } from 'react';
import { Announcement, Employee } from '@/types/workforce';
import { useEmployees } from './useEmployees';

export interface AnniversaryInfo {
  employee: Employee;
  /** Years of service today, e.g. 1, 3, 10. Always >= 1 (today's hire isn't a milestone). */
  years: number;
}

/** Local "YYYY-MM-DD" string — used to know when the calendar day has rolled. */
function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Detect employees whose hire-date month+day matches today. */
function findTodayAnniversaries(
  employees: Employee[],
  today: Date,
): AnniversaryInfo[] {
  const todayMonth = today.getMonth(); // 0-indexed
  const todayDay = today.getDate();
  const list: AnniversaryInfo[] = [];
  for (const emp of employees) {
    if (!emp.isActive || !emp.hireDate) continue;
    // Hire-date stored as YYYY-MM-DD — parse in local timezone so the
    // month/day don't shift across the date boundary.
    const hire = new Date(emp.hireDate + 'T00:00:00');
    if (Number.isNaN(hire.getTime())) continue;
    if (hire.getMonth() !== todayMonth || hire.getDate() !== todayDay) continue;
    const years = today.getFullYear() - hire.getFullYear();
    if (years < 1) continue;
    list.push({ employee: emp, years });
  }
  return list;
}

/** Turn an AnniversaryInfo into an Announcement that can drop into the
 *  kiosk ticker alongside real announcements. */
function toAnnouncement(info: AnniversaryInfo, today: Date): Announcement {
  const { employee: emp, years } = info;
  const noun = years === 1 ? 'year' : 'years';
  const text = `🎉 Happy ${years}-${noun} work anniversary, ${emp.firstName} ${emp.lastName}!`;
  // End of today (midnight local) so the announcement auto-expires.
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  return {
    id: `anniversary-${emp.id}-${today.getFullYear()}`,
    text,
    priority: 'normal',
    createdAt: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).toISOString(),
    expiresAt: endOfDay.toISOString(),
    createdBy: 'system',
  };
}

/** Hook: returns today's anniversaries in two shapes — the structured
 *  list (for the admin dashboard) and synthetic Announcement objects
 *  (for the kiosk ticker). */
export function useAnniversaries() {
  const employees = useEmployees();
  // Re-evaluate when the local date changes so an open kiosk picks up
  // anniversaries as soon as midnight rolls.
  const [today, setToday] = useState<Date>(() => new Date());

  useEffect(() => {
    const currentDate = localDateString(today);
    const id = setInterval(() => {
      const now = new Date();
      if (localDateString(now) !== currentDate) setToday(now);
    }, 60_000);
    return () => clearInterval(id);
  }, [today]);

  const list = useMemo(
    () => findTodayAnniversaries(employees, today),
    [employees, today],
  );
  const announcements = useMemo(
    () => list.map((info) => toAnnouncement(info, today)),
    [list, today],
  );

  return { list, announcements, count: list.length };
}
