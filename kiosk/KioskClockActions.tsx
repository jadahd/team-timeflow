import { Employee, EmployeeStatus } from '@/types/workforce';
import { Clock, UtensilsCrossed, LogOut, Loader2 } from 'lucide-react';

interface Props {
  employee: Employee;
  status: EmployeeStatus;
  /** When true, every action button is disabled and shows a spinner.
   *  Prevents rapid double-taps from creating duplicate clock-ins. */
  processing?: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartBreak: (type: 'break' | 'lunch') => void;
  onEndBreak: () => void;
  onCancel: () => void;
}

export const KioskClockActions = ({ employee, status, processing = false, onClockIn, onClockOut, onStartBreak, onEndBreak, onCancel }: Props) => {
  // Shared className for the disabled state — slight dim, no hover pop,
  // no scale-on-tap so it visibly looks "locked."
  const disabledFx = processing
    ? 'opacity-60 cursor-not-allowed pointer-events-none'
    : 'active:scale-95';

  return (
    <div className="animate-slide-in flex flex-col items-center gap-6 w-full max-w-md">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center mx-auto mb-3">
          <span className="text-accent-foreground text-2xl font-bold">{employee.initials}</span>
        </div>
        <h2 className="text-lg font-semibold text-kiosk-foreground">{employee.firstName}</h2>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-1 gap-4 w-full">
        {status === 'clocked-out' && (
          <button
            onClick={onClockIn}
            disabled={processing}
            className={`flex items-center justify-center gap-3 h-20 rounded-xl bg-kiosk-success text-accent-foreground font-semibold text-lg transition-all hover:opacity-90 ${disabledFx}`}
          >
            {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Clock className="w-6 h-6" />}
            {processing ? 'Working…' : 'Clock In'}
          </button>
        )}

        {status === 'clocked-in' && (
          <>
            <button
              onClick={() => onStartBreak('lunch')}
              disabled={processing}
              className={`flex items-center justify-center gap-3 h-20 rounded-xl bg-kiosk-card border border-kiosk-muted text-kiosk-foreground font-medium text-lg transition-all hover:border-accent ${disabledFx}`}
            >
              {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <UtensilsCrossed className="w-6 h-6 text-status-on-lunch" />}
              {processing ? 'Working…' : 'Lunch'}
            </button>
            <button
              onClick={onClockOut}
              disabled={processing}
              className={`flex items-center justify-center gap-3 h-16 rounded-xl bg-kiosk-danger text-accent-foreground font-semibold transition-all hover:opacity-90 ${disabledFx}`}
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              {processing ? 'Working…' : 'Clock Out'}
            </button>
          </>
        )}

        {(status === 'on-break' || status === 'on-lunch') && (
          <button
            onClick={onEndBreak}
            disabled={processing}
            className={`flex items-center justify-center gap-3 h-20 rounded-xl bg-kiosk-success text-accent-foreground font-semibold text-lg transition-all hover:opacity-90 ${disabledFx}`}
          >
            {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Clock className="w-6 h-6" />}
            {processing
              ? 'Working…'
              : `End ${status === 'on-lunch' ? 'Lunch' : 'Break'} — Back to Work`}
          </button>
        )}
      </div>

      <button
        onClick={onCancel}
        disabled={processing}
        className={`text-kiosk-muted-foreground hover:text-kiosk-foreground text-sm transition-colors ${processing ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        ← Cancel
      </button>
    </div>
  );
};

const StatusBadge = ({ status }: { status: EmployeeStatus }) => {
  const config: Record<EmployeeStatus, { label: string; className: string }> = {
    'clocked-in': { label: 'Clocked In', className: 'bg-status-clocked-in/20 text-kiosk-success' },
    'on-break': { label: 'On Break', className: 'bg-status-on-break/20 text-kiosk-warning' },
    'on-lunch': { label: 'On Lunch', className: 'bg-status-on-lunch/20 text-status-on-lunch' },
    'clocked-out': { label: 'Not Clocked In', className: 'bg-kiosk-muted text-kiosk-muted-foreground' },
  };
  const c = config[status];
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${c.className}`}>{c.label}</span>;
};
