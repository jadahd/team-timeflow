import { useEffect, useState } from 'react';
import { KioskEmployeeStatus, LONG_LUNCH_MINUTES } from '@/types/workforce';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const statusConfig = {
  'clocked-in': { label: 'Working', dot: 'bg-status-clocked-in', textClass: 'text-kiosk-success' },
  'on-break': { label: 'Break', dot: 'bg-status-on-break', textClass: 'text-kiosk-warning' },
  'on-lunch': { label: 'Lunch', dot: 'bg-status-on-lunch', textClass: 'text-status-on-lunch' },
  'clocked-out': { label: 'Off', dot: 'bg-kiosk-muted', textClass: 'text-kiosk-muted-foreground' },
};

/** Hook: returns `Date.now()` and re-renders every `intervalMs` so any
 *  components doing time-since calculations stay current without
 *  another network round-trip. */
function useTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function elapsedMinutes(startIso: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(startIso).getTime()) / 60_000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  statuses: KioskEmployeeStatus[];
}

export const KioskStaffBoard = ({ statuses }: Props) => {
  const active = statuses.filter((s) => s.status !== 'clocked-out');
  const inactive = statuses.filter((s) => s.status === 'clocked-out');
  // Off-duty staff are collapsed by default to keep the kiosk focused.
  const [offDutyExpanded, setOffDutyExpanded] = useState(false);
  // Tick every 30 seconds so "X min on lunch" labels stay current and the
  // overdue banner appears the moment threshold is crossed.
  const now = useTick(30_000);

  // Who's been on lunch past the threshold? Surfaces as a banner at the
  // top of the board so anyone walking by can see and remind them.
  const overdueLunches = active
    .filter((s) => s.status === 'on-lunch' && s.breakStartTime)
    .map((s) => ({
      staff: s,
      minutes: elapsedMinutes(s.breakStartTime!, now),
    }))
    .filter((x) => x.minutes >= LONG_LUNCH_MINUTES)
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="kiosk-card rounded-xl border border-kiosk-muted flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-kiosk-muted">
        <h3 className="text-sm font-semibold text-kiosk-foreground">Staff On Duty</h3>
        <p className="text-xs text-kiosk-muted-foreground">{active.length} active</p>
      </div>

      {/* Overdue-lunch banner — only shows when someone is past threshold */}
      {overdueLunches.length > 0 && (
        <div className="px-3 py-2 bg-kiosk-warning/15 border-b border-kiosk-warning/40">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-kiosk-warning flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-kiosk-foreground">
                {overdueLunches.length === 1
                  ? `${overdueLunches[0].staff.firstName} has been on lunch for ${formatElapsed(overdueLunches[0].minutes)}`
                  : `${overdueLunches.length} people are over ${LONG_LUNCH_MINUTES} min on lunch`}
              </p>
              {overdueLunches.length > 1 && (
                <p className="text-[10px] text-kiosk-muted-foreground mt-0.5 truncate">
                  {overdueLunches
                    .map((o) => `${o.staff.firstName} (${formatElapsed(o.minutes)})`)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {active.length === 0 && (
            <p className="px-2 py-3 text-xs italic text-kiosk-muted-foreground">
              Nobody on duty right now.
            </p>
          )}
          {active.map((s, i) => (
            <StaffRow key={`active-${i}`} staff={s} now={now} />
          ))}

          {inactive.length > 0 && (
            <div className="pt-2 mt-2 border-t border-kiosk-muted">
              <button
                onClick={() => setOffDutyExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-kiosk-muted/30 transition-colors"
                aria-expanded={offDutyExpanded}
              >
                <span className="flex items-center gap-1.5">
                  {offDutyExpanded ? (
                    <ChevronDown className="w-3 h-3 text-kiosk-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-kiosk-muted-foreground" />
                  )}
                  <span className="text-[10px] text-kiosk-muted-foreground uppercase tracking-wider">
                    Not on duty
                  </span>
                </span>
                <span className="text-[10px] text-kiosk-muted-foreground">{inactive.length}</span>
              </button>
              {offDutyExpanded &&
                inactive.map((s, i) => (
                  <StaffRow key={`inactive-${i}`} staff={s} now={now} />
                ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const StaffRow = ({
  staff,
  now,
}: {
  staff: KioskEmployeeStatus;
  now: number;
}) => {
  const config = statusConfig[staff.status];
  const returnTime = staff.breakReturnTime
    ? new Date(staff.breakReturnTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;
  const onLunchMinutes =
    staff.status === 'on-lunch' && staff.breakStartTime
      ? elapsedMinutes(staff.breakStartTime, now)
      : null;
  const isOverdueLunch =
    onLunchMinutes !== null && onLunchMinutes >= LONG_LUNCH_MINUTES;

  return (
    <div
      className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
        isOverdueLunch
          ? 'bg-kiosk-warning/15 ring-1 ring-kiosk-warning/40 hover:bg-kiosk-warning/20'
          : 'hover:bg-kiosk-muted/30'
      }`}
    >
      <div
        className={`w-2.5 h-2.5 rounded-full ${config.dot} ${
          staff.status === 'clocked-in' ? 'animate-pulse-soft' : ''
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-kiosk-foreground">{staff.initials}</span>
          <span className="text-xs text-kiosk-muted-foreground truncate">{staff.firstName}</span>
        </div>
        <span className="text-[10px] text-kiosk-muted-foreground">{staff.role}</span>
      </div>
      <div className="text-right">
        <span
          className={`text-xs font-medium ${
            isOverdueLunch ? 'text-kiosk-warning' : config.textClass
          }`}
        >
          {isOverdueLunch
            ? `Lunch ${formatElapsed(onLunchMinutes!)}`
            : onLunchMinutes !== null
            ? `${config.label} ${formatElapsed(onLunchMinutes)}`
            : config.label}
        </span>
        {returnTime && !isOverdueLunch && (
          <p className="text-[10px] text-kiosk-muted-foreground">Back {returnTime}</p>
        )}
        {isOverdueLunch && (
          <p className="text-[10px] text-kiosk-warning font-semibold">Overdue</p>
        )}
      </div>
    </div>
  );
};
