import { useState } from 'react';
import { AttendanceStatus, Employee, ScheduleShift, TimeEntry } from '@/types/workforce';
import { useEmployees } from '@/hooks/useEmployees';
import { useAttendance } from '@/hooks/useAttendance';
import { useSchedule } from '@/hooks/useSchedule';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatTime12, formatTimestamp12 } from '@/lib/time';

// Order matters — first option in the picker. "—" means "no entry yet".
const STATUS_OPTIONS: { value: AttendanceStatus; label: string; tone: string }[] = [
  { value: 'working', label: 'Working', tone: 'bg-success/15 text-success border-success/20' },
  { value: 'working-remotely', label: 'Working Remotely', tone: 'bg-info/15 text-info border-info/20' },
  { value: 'called-in', label: 'Called In', tone: 'bg-info/15 text-info border-info/20' },
  { value: 'late', label: 'Late', tone: 'bg-warning/15 text-warning border-warning/20' },
  { value: 'sick', label: 'Out Sick', tone: 'bg-warning/15 text-warning border-warning/20' },
  { value: 'pto', label: 'PTO', tone: 'bg-info/15 text-info border-info/20' },
  {
    value: 'no-call-no-show',
    label: 'No Call No Show',
    tone: 'bg-destructive/15 text-destructive border-destructive/20',
  },
  { value: 'other', label: 'Other', tone: 'bg-muted text-muted-foreground border-border' },
];

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export const AdminAttendance = () => {
  const employees = useEmployees();
  const { timeEntries } = useTimeEntries();
  const { setStatus, noteFor, clear } = useAttendance();
  const schedule = useSchedule();

  // Sort by first name for a stable visible order.
  const activeEmployees = [...employees]
    .filter((e) => e.isActive)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  const todaysShifts = schedule.todayShifts;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <Button variant="outline" size="sm" onClick={schedule.refresh} disabled={schedule.loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${schedule.loading ? 'animate-spin' : ''}`} />
          Refresh schedule
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{todayLabel}</p>

      <ScheduleStatusBanner schedule={schedule} />

      {schedule.incompleteWeeks.length > 0 && (
        <Card className="mb-6 border-info/40 bg-info/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground">
              {schedule.incompleteWeeks.length === 1
                ? '1 schedule tab is marked Incomplete'
                : `${schedule.incompleteWeeks.length} schedule tabs are marked Incomplete`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Shifts from {schedule.incompleteWeeks.length === 1 ? 'that week' : 'those weeks'} are
              hidden until the manager changes the dropdown to "Complete":
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {schedule.incompleteWeeks.map((wk) => (
                <Badge key={wk} variant="outline" className="text-xs">
                  Week of {wk}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {schedule.unmatchedNames.length > 0 && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground">
              {schedule.unmatchedNames.length} name{schedule.unmatchedNames.length === 1 ? '' : 's'} on the schedule didn't match any employee
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              These shifts won't show up below until you add the employees in Admin → Employees
              (or rename them in your sheet to match):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {schedule.unmatchedNames.map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Expected Shift</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeEmployees.map((emp) => (
                <EmployeeRow
                  key={emp.id}
                  employee={emp}
                  shift={findShiftForEmployee(todaysShifts, emp)}
                  timeEntry={timeEntries.find((t) => t.employeeId === emp.id && !t.clockOut) ?? timeEntries.find((t) => t.employeeId === emp.id)}
                  attendanceNote={noteFor(emp.id)}
                  onSetStatus={(status, note) => setStatus(emp.id, status, note)}
                  onClear={(id) => clear(id)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// Per-employee row with status dropdown + note editor
// ============================================================
interface RowProps {
  employee: Employee;
  shift: ScheduleShift | null;
  timeEntry: TimeEntry | undefined;
  attendanceNote: ReturnType<ReturnType<typeof useAttendance>['noteFor']>;
  onSetStatus: (status: AttendanceStatus, note: string) => Promise<boolean>;
  onClear: (id: string) => Promise<boolean>;
}

const EmployeeRow = ({
  employee,
  shift,
  timeEntry,
  attendanceNote,
  onSetStatus,
  onClear,
}: RowProps) => {
  const [draftNote, setDraftNote] = useState(attendanceNote?.note ?? '');
  const currentStatus = attendanceNote?.status;

  const handleStatusChange = async (value: string) => {
    if (value === 'clear') {
      if (attendanceNote) {
        const ok = await onClear(attendanceNote.id);
        if (ok) {
          toast.success('Status cleared');
          setDraftNote('');
        }
      }
      return;
    }
    const status = value as AttendanceStatus;
    const ok = await onSetStatus(status, draftNote);
    if (ok) toast.success(`${employee.firstName}: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`);
  };

  const handleNoteBlur = async () => {
    if (!currentStatus) return; // need a status first
    if (draftNote === (attendanceNote?.note ?? '')) return; // no change
    const ok = await onSetStatus(currentStatus, draftNote);
    if (ok) toast.success('Note saved');
  };

  const statusOption = currentStatus
    ? STATUS_OPTIONS.find((s) => s.value === currentStatus)
    : null;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
            {employee.initials}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground">
              {employee.firstName} {employee.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{employee.department}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {shift ? (
          <span className="tabular-nums">
            {formatTime12(shift.startTime)} – {formatTime12(shift.endTime)}
          </span>
        ) : (
          <span className="text-xs italic">No shift on schedule</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        <ActualStatusCell entry={timeEntry} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select value={currentStatus ?? ''} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
              {attendanceNote && (
                <SelectItem value="clear" className="text-muted-foreground">
                  Clear status
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {statusOption && (
            <Badge variant="outline" className={`text-xs ${statusOption.tone}`}>
              {statusOption.label}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder={
            currentStatus
              ? 'Optional note (saves on tab out)…'
              : 'Set a status first to add notes'
          }
          disabled={!currentStatus}
          className="text-sm"
        />
      </TableCell>
    </TableRow>
  );
};

// ============================================================
// Right-side status cell — shows clock-in/out reality vs schedule
// ============================================================
const ActualStatusCell = ({ entry }: { entry: TimeEntry | undefined }) => {
  if (!entry) {
    return <span className="text-xs italic text-muted-foreground">Not clocked in</span>;
  }
  const inT = formatTimestamp12(entry.clockIn);
  if (!entry.clockOut) {
    return (
      <span className="tabular-nums">
        <span className="text-success">●</span> In at {inT}
      </span>
    );
  }
  const outT = formatTimestamp12(entry.clockOut);
  return (
    <span className="tabular-nums text-muted-foreground">
      {inT} – {outT}
    </span>
  );
};

// ============================================================
// Schedule status banner — shows whether Google Sheet is connected,
// and how many shifts loaded for today
// ============================================================
const ScheduleStatusBanner = ({ schedule }: { schedule: ReturnType<typeof useSchedule> }) => {
  if (!schedule.configured) {
    return (
      <Card className="mb-6 border-dashed">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">No schedule connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a Google Sheets CSV URL in{' '}
              <a href="/admin" className="underline">
                Company Settings → Schedule Integration
              </a>{' '}
              to see expected shifts here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (schedule.error) {
    return (
      <Card className="mb-6 border-destructive/40 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-destructive">Schedule failed to load</p>
          <p className="text-xs text-muted-foreground mt-1">{schedule.error}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="mb-6">
      <CardContent className="p-3 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Schedule connected · <strong className="text-foreground">{schedule.todayShifts.length}</strong>{' '}
          shift{schedule.todayShifts.length === 1 ? '' : 's'} on today
          {schedule.lastFetched && (
            <span className="ml-2 text-xs">
              · refreshed {schedule.lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <a
          href="/admin"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Edit URL <ExternalLink className="w-3 h-3" />
        </a>
      </CardContent>
    </Card>
  );
};

// ============================================================
// Helper: pick the best schedule shift to display for an employee
// ============================================================
function findShiftForEmployee(shifts: ScheduleShift[], emp: Employee): ScheduleShift | null {
  // Prefer an employeeId-matched shift, fall back to name fuzz.
  const byId = shifts.find((s) => s.employeeId === emp.id);
  if (byId) return byId;
  const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
  const byName = shifts.find((s) => s.employeeName.toLowerCase() === fullName);
  return byName ?? null;
}
