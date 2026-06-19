// Shown on the kiosk when an employee's PIN is accepted but they have
// an open shift older than ~12 hours — i.e. they forgot to clock out
// on a previous day. Rather than silently letting the kiosk close the
// shift at "now" (which inflates payroll by hours), we block the flow
// and tell them to find a manager. The manager can then fix the shift
// via /admin → Forgotten Punches with the real clock-out time.

import { Employee, TimeEntry } from '@/types/workforce';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface Props {
  employee: Employee;
  openEntry: TimeEntry;
  onAcknowledge: () => void;
}

export const KioskStaleShiftWarning = ({
  employee,
  openEntry,
  onAcknowledge,
}: Props) => {
  const clockInDate = new Date(openEntry.clockIn);
  const niceDate = clockInDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const niceTime = clockInDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const hoursAgo = Math.floor(
    (Date.now() - clockInDate.getTime()) / 3_600_000,
  );

  return (
    <div className="animate-slide-in flex flex-col items-center gap-6 w-full max-w-md text-center">
      <div className="w-20 h-20 rounded-2xl bg-kiosk-warning/15 border-2 border-kiosk-warning/40 flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-kiosk-warning" />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-kiosk-foreground">
          Hi {employee.firstName} — please see a manager
        </h2>
        <p className="text-kiosk-muted-foreground text-sm mt-2">
          You have an open shift from{' '}
          <span className="font-medium text-kiosk-foreground">{niceDate}</span>{' '}
          at{' '}
          <span className="font-medium text-kiosk-foreground tabular-nums">
            {niceTime}
          </span>{' '}
          that was never clocked out.
        </p>
        <p className="text-kiosk-muted-foreground text-xs mt-3">
          That was about{' '}
          <span className="font-medium text-kiosk-foreground">
            {hoursAgo}{' '}
            {hoursAgo === 1 ? 'hour' : 'hours'} ago
          </span>{' '}
          — too far back for the kiosk to fix safely.
        </p>
      </div>

      <div className="kiosk-card border border-kiosk-warning/30 rounded-xl p-4 w-full text-sm text-kiosk-foreground">
        Ask a manager to open <span className="font-semibold">Admin → Forgotten
        Punches</span> and set your real clock-out time for that shift. After
        they fix it, scan your PIN again to start today's work.
      </div>

      <button
        onClick={onAcknowledge}
        className="flex items-center gap-2 text-kiosk-muted-foreground hover:text-kiosk-foreground text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Got it
      </button>
    </div>
  );
};
