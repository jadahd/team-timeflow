import { KioskEmployeeStatus } from '@/types/workforce';
import { ScrollArea } from '@/components/ui/scroll-area';

const statusConfig = {
  'clocked-in': { label: 'Working', dot: 'bg-status-clocked-in', textClass: 'text-kiosk-success' },
  'on-break': { label: 'Break', dot: 'bg-status-on-break', textClass: 'text-kiosk-warning' },
  'on-lunch': { label: 'Lunch', dot: 'bg-status-on-lunch', textClass: 'text-status-on-lunch' },
  'clocked-out': { label: 'Off', dot: 'bg-kiosk-muted', textClass: 'text-kiosk-muted-foreground' },
};

interface Props {
  statuses: KioskEmployeeStatus[];
}

export const KioskStaffBoard = ({ statuses }: Props) => {
  const active = statuses.filter(s => s.status !== 'clocked-out');
  const inactive = statuses.filter(s => s.status === 'clocked-out');

  return (
    <div className="kiosk-card rounded-xl border border-kiosk-muted flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-kiosk-muted">
        <h3 className="text-sm font-semibold text-kiosk-foreground">Staff On Duty</h3>
        <p className="text-xs text-kiosk-muted-foreground">{active.length} active</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {active.map((s, i) => (
            <StaffRow key={i} staff={s} />
          ))}
          {inactive.length > 0 && (
            <div className="pt-2 mt-2 border-t border-kiosk-muted">
              <p className="text-[10px] text-kiosk-muted-foreground uppercase tracking-wider mb-1 px-2">Not on duty</p>
              {inactive.map((s, i) => (
                <StaffRow key={i} staff={s} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const StaffRow = ({ staff }: { staff: KioskEmployeeStatus }) => {
  const config = statusConfig[staff.status];
  const returnTime = staff.breakReturnTime
    ? new Date(staff.breakReturnTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-kiosk-muted/30 transition-colors">
      <div className={`w-2.5 h-2.5 rounded-full ${config.dot} ${staff.status === 'clocked-in' ? 'animate-pulse-soft' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-kiosk-foreground">{staff.initials}</span>
          <span className="text-xs text-kiosk-muted-foreground truncate">{staff.firstName}</span>
        </div>
        <span className="text-[10px] text-kiosk-muted-foreground">{staff.role}</span>
      </div>
      <div className="text-right">
        <span className={`text-xs font-medium ${config.textClass}`}>{config.label}</span>
        {returnTime && (
          <p className="text-[10px] text-kiosk-muted-foreground">Back {returnTime}</p>
        )}
      </div>
    </div>
  );
};
