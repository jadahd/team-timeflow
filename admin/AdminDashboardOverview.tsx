import { useEffect, useState } from 'react';
import { getEmployeeStatus } from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useForgottenClockOuts } from '@/hooks/useForgottenClockOuts';
import { useAnniversaries } from '@/hooks/useAnniversaries';
import { fetchTimeEntriesInRange } from '@/lib/db';
import { TimeEntry, LONG_LUNCH_MINUTES } from '@/types/workforce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, AlertTriangle, ArrowRight, UtensilsCrossed, PartyPopper } from 'lucide-react';
import { AdminView } from '@/pages/AdminPage';

// OT thresholds (matches AdminPayroll's overtime rules).
const OT_THRESHOLD_HOURS = 40;
const OT_NEAR_THRESHOLD_HOURS = 36; // "approaching OT" early warning

interface Props {
  /** Lets the banner jump straight to the Forgotten Punches view. */
  onNavigate?: (view: AdminView) => void;
}

/** Returns the Friday on or before `today` (start of the Fri–Thu pay week). */
function getPayPeriodStart(today: Date): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun ... 5=Fri ... 6=Sat
  const daysBack = (dow - 5 + 7) % 7;
  d.setDate(d.getDate() - daysBack);
  return d;
}

function isoDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const AdminDashboardOverview = ({ onNavigate }: Props = {}) => {
  const employees = useEmployees();
  const { timeEntries } = useTimeEntries();
  const { entries: forgotten, count: forgottenCount } = useForgottenClockOuts();
  const { list: anniversaries } = useAnniversaries();

  // Tick every 30s so the long-lunch banner stays current — appears the
  // moment an employee crosses the LONG_LUNCH_MINUTES threshold.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Find anyone currently on a lunch that's past the threshold.
  const longLunches = (() => {
    const list: Array<{ name: string; department: string; minutes: number }> = [];
    for (const entry of timeEntries) {
      if (entry.clockOut) continue;
      const lunch = entry.breaks.find((b) => b.type === 'lunch' && !b.endTime);
      if (!lunch) continue;
      const minutes = Math.floor((now - new Date(lunch.startTime).getTime()) / 60_000);
      if (minutes < LONG_LUNCH_MINUTES) continue;
      const emp = employees.find((e) => e.id === entry.employeeId);
      list.push({
        name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        department: emp?.department ?? entry.department,
        minutes,
      });
    }
    return list.sort((a, b) => b.minutes - a.minutes);
  })();
  const longLunchCount = longLunches.length;

  // Pull entries for the current Fri–Thu pay period so OT Risk is real.
  const [periodEntries, setPeriodEntries] = useState<TimeEntry[]>([]);
  useEffect(() => {
    const start = getPayPeriodStart(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    let cancelled = false;
    void fetchTimeEntriesInRange(isoDate(start), isoDate(end)).then((rows) => {
      if (!cancelled) setPeriodEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // For each hourly+active employee, sum their period WORKED hours minus
  // breaks. ONLY entry_type='work' counts toward OT — PTO/sick/holiday
  // don't push you over the 40-hour threshold.
  const hourlyEmployees = employees.filter(
    (e) => e.payType === 'hourly' && e.isActive,
  );
  const periodHoursByEmp = new Map<string, number>();
  for (const emp of hourlyEmployees) {
    const empEntries = periodEntries.filter(
      (e) => e.employeeId === emp.id && e.entryType === 'work',
    );
    const hours = empEntries.reduce((sum, entry) => {
      const start = new Date(entry.clockIn).getTime();
      const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
      const breakMs = entry.breaks.reduce((s, b) => {
        const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
        return s + (bEnd - new Date(b.startTime).getTime());
      }, 0);
      return sum + Math.max(0, (end - start - breakMs) / 3600000);
    }, 0);
    periodHoursByEmp.set(emp.id, hours);
  }

  // Who's actually at risk this period?
  const overOT = hourlyEmployees.filter(
    (e) => (periodHoursByEmp.get(e.id) ?? 0) >= OT_THRESHOLD_HOURS,
  );
  const nearOT = hourlyEmployees.filter((e) => {
    const h = periodHoursByEmp.get(e.id) ?? 0;
    return h >= OT_NEAR_THRESHOLD_HOURS && h < OT_THRESHOLD_HOURS;
  });
  const otRiskCount = overOT.length + nearOT.length;
  // Full list, sorted highest-hours first, so the detail panel can render
  // every at-risk person with their hours and an over/near badge.
  const atRiskList = [...overOT, ...nearOT]
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      department: e.department,
      hours: periodHoursByEmp.get(e.id) ?? 0,
    }))
    .sort((a, b) => b.hours - a.hours);
  const activeCount = employees.filter((e) => {
    const s = getEmployeeStatus(e.id, timeEntries);
    return s !== 'clocked-out';
  }).length;

  const totalHoursToday = timeEntries.reduce((sum, entry) => {
    const start = new Date(entry.clockIn).getTime();
    const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
    return sum + (end - start) / 3600000;
  }, 0);

  const stats: Array<{
    label: string;
    value: string | number;
    sub?: string;
    total?: number;
    icon: typeof Users;
    color: string;
  }> = [
    {
      label: 'Staff On Duty',
      value: activeCount,
      total: employees.filter((e) => e.isActive).length,
      icon: Users,
      color: 'text-success',
    },
    { label: 'Hours Today', value: totalHoursToday.toFixed(1), icon: Clock, color: 'text-info' },
    {
      label: 'OT Risk This Period',
      value: otRiskCount,
      sub:
        otRiskCount === 0
          ? `No one ≥ ${OT_NEAR_THRESHOLD_HOURS}h yet`
          : `${overOT.length} over 40h · ${nearOT.length} between ${OT_NEAR_THRESHOLD_HOURS}–40h`,
      icon: AlertTriangle,
      color: otRiskCount > 0 ? 'text-warning' : 'text-muted-foreground',
    },
  ];

  // Build a concise "who + how many days" summary for the banner so
  // owners see the scope at a glance without opening the full view.
  const offendersSummary = (() => {
    if (forgottenCount === 0) return null;
    const byEmp = new Map<string, number>();
    for (const e of forgotten) {
      const emp = employees.find((x) => x.id === e.employeeId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
      byEmp.set(name, (byEmp.get(name) ?? 0) + 1);
    }
    return Array.from(byEmp.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, c]) => (c > 1 ? `${name} (${c})` : name))
      .join(' · ');
  })();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      {/* Anniversary card — only renders when someone has one today */}
      {anniversaries.length > 0 && (
        <Card className="mb-4 border-status-on-lunch/40 bg-status-on-lunch/5">
          <CardContent className="p-4 flex items-start gap-3">
            <PartyPopper className="w-5 h-5 text-status-on-lunch flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {anniversaries.length === 1
                  ? `Work anniversary today`
                  : `${anniversaries.length} work anniversaries today`}
              </p>
              <div className="mt-2 space-y-1">
                {anniversaries.map((a) => (
                  <div key={a.employee.id} className="text-sm text-foreground">
                    🎉 <span className="font-medium">{a.employee.firstName} {a.employee.lastName}</span>{' '}
                    <span className="text-muted-foreground">— {a.years} {a.years === 1 ? 'year' : 'years'}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Also showing on the kiosk announcements ticker.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Long-lunch banner — only renders when someone's overdue */}
      {longLunchCount > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <UtensilsCrossed className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {longLunchCount === 1
                  ? `${longLunches[0].name} has been on lunch for ${formatLunchDuration(longLunches[0].minutes)}`
                  : `${longLunchCount} people are on lunch over ${LONG_LUNCH_MINUTES} minutes`}
              </p>
              {longLunchCount > 1 && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {longLunches
                    .map((l) => `${l.name} (${formatLunchDuration(l.minutes)})`)
                    .join(' · ')}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Updates live. Disappears when they tap End Lunch on the kiosk.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forgotten clock-outs banner — only renders when there's something to fix */}
      {forgottenCount > 0 && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {forgottenCount === 1
                  ? '1 forgotten clock-out is inflating payroll'
                  : `${forgottenCount} forgotten clock-outs are inflating payroll`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each open entry counts time as "still working" right up to now —
                fix them before exporting payroll.
              </p>
              {offendersSummary && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {offendersSummary}
                </p>
              )}
            </div>
            {onNavigate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate('forgotten-punches')}
                className="flex-shrink-0"
              >
                Review
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    {stat.total !== undefined && (
                      <p className="text-xs text-muted-foreground">of {stat.total}</p>
                    )}
                    {stat.sub && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {stat.sub}
                      </p>
                    )}
                  </div>
                  <Icon className={`w-5 h-5 ${stat.color} flex-shrink-0`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* OT-risk detail — every employee approaching or over the 40-hour
          threshold, sorted highest-hours first. Only renders when there's
          someone to show. */}
      {atRiskList.length > 0 && (
        <Card className="mb-6 border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              At risk of overtime this period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {atRiskList.map((e) => {
                const isOver = e.hours >= OT_THRESHOLD_HOURS;
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={
                          isOver
                            ? 'bg-destructive/15 text-destructive border-destructive/30 text-[10px]'
                            : 'bg-warning/15 text-warning border-warning/30 text-[10px]'
                        }
                      >
                        {isOver ? 'Over 40h' : 'Approaching'}
                      </Badge>
                      <span className="text-sm font-medium text-foreground truncate">
                        {e.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {e.department}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums flex-shrink-0">
                      {e.hours.toFixed(1)}h
                      {isOver && (
                        <span className="ml-1 text-xs text-destructive">
                          (+{(e.hours - OT_THRESHOLD_HOURS).toFixed(1)})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Based on work hours only (PTO/sick/holiday excluded). Pay period
              runs Friday–Thursday.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {employees
              .filter((e) => e.isActive)
              .map((emp) => {
                const status = getEmployeeStatus(emp.id, timeEntries);
                const statusColors = {
                  'clocked-in': 'bg-success',
                  'on-break': 'bg-warning',
                  'on-lunch': 'bg-info',
                  'clocked-out': 'bg-muted-foreground/30',
                };
                return (
                  <div key={emp.id} className="flex items-center gap-3 py-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
                    <span className="text-sm font-medium text-foreground w-8">{emp.initials}</span>
                    <span className="text-sm text-foreground flex-1">
                      {emp.firstName} {emp.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{emp.department}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {status.replace('-', ' ')}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** "1h 15m" / "75m" formatter for the long-lunch banner. */
function formatLunchDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
