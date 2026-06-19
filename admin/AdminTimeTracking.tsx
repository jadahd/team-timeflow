import { useState } from 'react';
import { TimeEntry, TimeEntryType } from '@/types/workforce';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { deleteTimeEntry } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Lock,
} from 'lucide-react';
import { TimeEntryDialog } from './TimeEntryDialog';
import { toast } from 'sonner';
import { formatTimestamp12, summarizeLunch } from '@/lib/time';
import { usePayPeriodLock } from '@/hooks/usePayPeriodLock';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Visual styling per entry type. 'work' renders nothing (it's the default
// and the table would feel busy if every row had a "Work" badge).
const ENTRY_TYPE_STYLES: Record<TimeEntryType, { label: string; tone: string } | null> = {
  work: null,
  vacation: { label: 'Vacation', tone: 'bg-info/15 text-info border-info/20' },
  sick: { label: 'Sick', tone: 'bg-warning/15 text-warning border-warning/20' },
  pto: { label: 'PTO', tone: 'bg-info/15 text-info border-info/20' },
  holiday: { label: 'Holiday', tone: 'bg-accent/15 text-accent border-accent/20' },
  bereavement: { label: 'Bereavement', tone: 'bg-muted text-muted-foreground border-border' },
  'jury-duty': { label: 'Jury Duty', tone: 'bg-muted text-muted-foreground border-border' },
  other: { label: 'Other', tone: 'bg-muted text-muted-foreground border-border' },
};

export const AdminTimeTracking = () => {
  const employees = useEmployees();
  const todayIso = isoDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const { timeEntries, refresh } = useTimeEntries(selectedDate);
  const { isLocked, lockingPeriod } = usePayPeriodLock(selectedDate);
  const [pendingDelete, setPendingDelete] = useState<TimeEntry | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isToday = selectedDate === todayIso;
  const headingDate = formatLongDate(selectedDate);

  const goPrev = () => setSelectedDate(addDays(selectedDate, -1));
  const goNext = () => setSelectedDate(addDays(selectedDate, 1));
  const goToday = () => setSelectedDate(todayIso);

  const entriesWithNames = timeEntries.map((entry) => {
    const emp = employees.find((e) => e.id === entry.employeeId);
    const start = new Date(entry.clockIn);
    const end = entry.clockOut ? new Date(entry.clockOut) : null;
    const totalMs = (end?.getTime() ?? Date.now()) - start.getTime();
    const breakMs = entry.breaks.reduce((sum, b) => {
      const bEnd = b.endTime
        ? new Date(b.endTime).getTime()
        : b.expectedReturn
        ? new Date(b.expectedReturn).getTime()
        : Date.now();
      return sum + (bEnd - new Date(b.startTime).getTime());
    }, 0);
    const workedHours = (totalMs - breakMs) / 3600000;
    // Flag rows where the employee clearly forgot to clock out: no
    // clock_out and we're viewing a past date.
    const isForgottenClockOut = !entry.clockOut && !isToday;

    return {
      raw: entry,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      initials: emp?.initials ?? '??',
      clockInTime: formatTimestamp12(entry.clockIn),
      clockOutTime: entry.clockOut ? formatTimestamp12(entry.clockOut) : '—',
      workedHours: workedHours.toFixed(1),
      lunch: summarizeLunch(entry.breaks),
      isForgottenClockOut,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Time Tracking — {isToday ? 'Today' : headingDate}
          </h1>
          {!isToday && (
            <button
              onClick={goToday}
              className="text-xs text-muted-foreground underline hover:text-foreground mt-0.5"
            >
              Jump to today
            </button>
          )}
        </div>
        <TimeEntryDialog
          defaultDate={selectedDate}
          payPeriodLocked={isLocked}
          onSaved={refresh}
        />
      </div>

      {/* Date navigator */}
      <Card className="mb-4">
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={goPrev} aria-label="Previous day">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </Button>
          <div className="flex items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="font-normal tabular-nums">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {headingDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={new Date(selectedDate + 'T00:00:00')}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(isoDateString(d));
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {isLocked && (
              <Badge
                variant="outline"
                className="bg-warning/15 text-warning border-warning/30 gap-1"
                title={
                  lockingPeriod?.label
                    ? `Pay period "${lockingPeriod.label}" is closed`
                    : 'This date is in a closed pay period'
                }
              >
                <Lock className="w-3 h-3" />
                Pay period locked
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goNext}
            aria-label="Next day"
            disabled={selectedDate >= todayIso}
            title={selectedDate >= todayIso ? "Can't go past today" : undefined}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {entriesWithNames.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {isToday
                ? `No time entries for today yet. They'll appear here once employees clock in, or click "Add Entry" above to record one manually.`
                : `No time entries on ${headingDate}.`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Lunch</TableHead>
                  <TableHead className="text-right">Hours Worked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesWithNames.map((row) => (
                  <TableRow
                    key={row.raw.id}
                    className={row.isForgottenClockOut ? 'bg-warning/5' : undefined}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                          {row.initials}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {row.employeeName}
                          </span>
                          {row.isForgottenClockOut && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 w-fit bg-warning/15 text-warning border-warning/30"
                            >
                              Forgot to clock out
                            </Badge>
                          )}
                          {ENTRY_TYPE_STYLES[row.raw.entryType] && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] py-0 px-1.5 w-fit ${ENTRY_TYPE_STYLES[row.raw.entryType]!.tone}`}
                            >
                              {ENTRY_TYPE_STYLES[row.raw.entryType]!.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.raw.department}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-foreground">
                      {row.clockInTime}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-foreground">
                      {row.clockOutTime}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.lunch ? (
                        <span className="tabular-nums text-foreground whitespace-pre-line">
                          {row.lunch.range}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          No lunch
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
                      {row.workedHours}h
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TimeEntryDialog
                          entry={row.raw}
                          payPeriodLocked={isLocked}
                          onSaved={refresh}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${row.employeeName}'s entry`}
                              disabled={isLocked}
                              title={isLocked ? 'Pay period is closed' : undefined}
                            >
                              {isLocked ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                <Pencil className="w-4 h-4" />
                              )}
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${row.employeeName}'s entry`}
                          onClick={() => setPendingDelete(row.raw)}
                          className="text-muted-foreground hover:text-destructive"
                          disabled={isLocked}
                          title={isLocked ? 'Pay period is closed' : undefined}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeleteDialog
        pendingDelete={pendingDelete}
        isLocked={isLocked}
        onCancel={() => setPendingDelete(null)}
        onConfirmed={async () => {
          await refresh();
          setPendingDelete(null);
        }}
      />
    </div>
  );
};

// ============================================================
// Delete dialog — separate component so it can ask for a reason
// before recording the delete in the audit log.
// ============================================================
interface DeleteDialogProps {
  pendingDelete: TimeEntry | null;
  isLocked: boolean;
  onCancel: () => void;
  onConfirmed: () => Promise<void>;
}

const DeleteDialog = ({ pendingDelete, isLocked, onCancel, onConfirmed }: DeleteDialogProps) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!pendingDelete) return;
    if (!reason.trim()) {
      toast.error('Please add a reason for the audit log.');
      return;
    }
    setSubmitting(true);
    const ok = await deleteTimeEntry(pendingDelete.id, { reason: reason.trim() });
    setSubmitting(false);
    if (ok) {
      toast.success('Time entry deleted');
      setReason('');
      await onConfirmed();
    } else {
      toast.error('Could not delete entry.');
    }
  };

  return (
    <AlertDialog
      open={Boolean(pendingDelete)}
      onOpenChange={(open) => {
        if (!open) {
          setReason('');
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this time entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the time entry and any associated breaks. This
            cannot be undone — payroll history for this entry will be lost. The
            deletion (with your reason below) is recorded in the audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-reason">
            Reason for deletion <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. duplicate entry, wrong employee"
            disabled={submitting}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // keep dialog open so we can show errors
              void handleConfirm();
            }}
            disabled={submitting || isLocked || !reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? 'Deleting…' : 'Delete entry'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ============================================================
// Date helpers
// ============================================================

/** Format a Date in the local timezone as YYYY-MM-DD (no UTC shift). */
function isoDateString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Add (or subtract) days from a YYYY-MM-DD string, returning a new YYYY-MM-DD. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoDateString(d);
}

/** "Wed, Jun 12, 2026" style heading from a YYYY-MM-DD. */
function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
