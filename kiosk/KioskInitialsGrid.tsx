import { Employee, TimeEntry } from '@/types/workforce';
import { getEmployeeStatus } from '@/data/mockData';

const statusColors: Record<string, string> = {
  'clocked-in': 'bg-status-clocked-in',
  'on-break': 'bg-status-on-break',
  'on-lunch': 'bg-status-on-lunch',
  'clocked-out': 'bg-kiosk-muted',
};

interface Props {
  employees: Employee[];
  timeEntries: TimeEntry[];
  onSelect: (emp: Employee) => void;
}

export const KioskInitialsGrid = ({ employees, timeEntries, onSelect }: Props) => {
  return (
    <div className="animate-fade-in w-full max-w-2xl">
      <h2 className="text-kiosk-muted-foreground text-center text-lg mb-6 font-medium">
        Tap your initials to clock in or out
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {employees.map(emp => {
          const status = getEmployeeStatus(emp.id, timeEntries);
          return (
            <button
              key={emp.id}
              onClick={() => onSelect(emp)}
              className="group relative flex flex-col items-center justify-center p-6 rounded-xl kiosk-card border border-kiosk-muted hover:border-accent transition-all duration-200 active:scale-95 min-h-[120px]"
            >
              <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${statusColors[status]}`} />
              <span className="text-3xl font-bold text-kiosk-foreground group-hover:text-accent transition-colors">
                {emp.initials}
              </span>
              <span className="text-xs text-kiosk-muted-foreground mt-2">{emp.firstName}</span>
              <span className="text-[10px] text-kiosk-muted-foreground opacity-60">{emp.role}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
