import { Employee, EmployeeStatus } from '@/types/workforce';
import { Clock, Coffee, UtensilsCrossed, LogOut } from 'lucide-react';

interface Props {
  employee: Employee;
  status: EmployeeStatus;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartBreak: (type: 'break' | 'lunch') => void;
  onEndBreak: () => void;
  onCancel: () => void;
}

export const KioskClockActions = ({ employee, status, onClockIn, onClockOut, onStartBreak, onEndBreak, onCancel }: Props) => {
  return (
    <div className="animate-slide-in flex flex-col items-center gap-6 w-full max-w-md">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center mx-auto mb-3">
          <span className="text-accent-foreground text-2xl font-bold">{employee.initials}</span>
        </div>
        <h2 className="text-lg font-semibold text-kiosk-foreground">{employee.firstName}</h2>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {status === 'clocked-out' && (
          <button onClick={onClockIn} className="col-span-2 flex items-center justify-center gap-3 h-20 rounded-xl bg-kiosk-success text-accent-foreground font-semibold text-lg transition-all active:scale-95 hover:opacity-90">
            <Clock className="w-6 h-6" />
            Clock In
          </button>
        )}

        {status === 'clocked-in' && (
          <>
            <button onClick={() => onStartBreak('break')} className="flex flex-col items-center justify-center gap-2 h-20 rounded-xl bg-kiosk-card border border-kiosk-muted text-kiosk-foreground font-medium transition-all active:scale-95 hover:border-accent">
              <Coffee className="w-5 h-5 text-kiosk-warning" />
              Break
            </button>
            <button onClick={() => onStartBreak('lunch')} className="flex flex-col items-center justify-center gap-2 h-20 rounded-xl bg-kiosk-card border border-kiosk-muted text-kiosk-foreground font-medium transition-all active:scale-95 hover:border-accent">
              <UtensilsCrossed className="w-5 h-5 text-status-on-lunch" />
              Lunch
            </button>
            <button onClick={onClockOut} className="col-span-2 flex items-center justify-center gap-3 h-16 rounded-xl bg-kiosk-danger text-accent-foreground font-semibold transition-all active:scale-95 hover:opacity-90">
              <LogOut className="w-5 h-5" />
              Clock Out
            </button>
          </>
        )}

        {(status === 'on-break' || status === 'on-lunch') && (
          <button onClick={onEndBreak} className="col-span-2 flex items-center justify-center gap-3 h-20 rounded-xl bg-kiosk-success text-accent-foreground font-semibold text-lg transition-all active:scale-95 hover:opacity-90">
            <Clock className="w-6 h-6" />
            End {status === 'on-lunch' ? 'Lunch' : 'Break'} — Back to Work
          </button>
        )}
      </div>

      <button onClick={onCancel} className="text-kiosk-muted-foreground hover:text-kiosk-foreground text-sm transition-colors">
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
