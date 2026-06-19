// Forgotten Punches — shows every time_entry where the employee forgot
// to clock out (clock_out is NULL on a date before today). Lets admins
// quick-edit (e.g. set a real clock-out time) or delete the entry,
// both routed through the same audit-logged paths as Time Tracking.

import { useState } from 'react';
import { TimeEntry } from '@/types/workforce';
import { useEmployees } from '@/hooks/useEmployees';
import { useForgottenClockOuts } from '@/hooks/useForgottenClockOuts';
import { deleteTimeEntry } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { TimeEntryDialog } from './TimeEntryDialog';
import { toast } from 'sonner';
import { formatTimestamp12 } from '@/lib/time';

export const AdminForgottenPunches = () => {
  const employees = useEmployees();
  const { entries, count, loading, refresh } = useForgottenClockOuts();
  const [pendingDelete, setPendingDelete] = useState<TimeEntry | null>(null);

  const rows = entries.map((entry) => {
    const emp = employees.find((e) => e.id === entry.employeeId);
    const clockInDate = new Date(entry.clockIn);
    const daysAgo = Math.floor(
      (Date.now() - clockInDate.getTime()) / (24 * 3600 * 1000),
    );
    return {
      raw: entry,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      initials: emp?.initials ?? '??',
      department: emp?.department ?? entry.department,
      dateLabel: clockInDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      clockInTime: formatTimestamp12(entry.clockIn),
      daysAgo,
    };
  });

  // Group repeat offenders so admins see who's the biggest culprit.
  const offendersByEmployee = new Map<string, number>();
  for (const r of rows) {
    offendersByEmployee.set(
      r.employeeName,
      (offendersByEmployee.get(r.employeeName) ?? 0) + 1,
    );
  }
  const topOffenders = Array.from(offendersByEmployee.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forgotten Punches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Employees who clocked in but never clocked out, on a date before today.
            Each one inflates payroll until you fix it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {topOffenders.length > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Repeat offenders
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              These employees have multiple forgotten clock-outs — might be worth a
              kind reminder.
            </p>
            <div className="flex flex-wrap gap-2">
              {topOffenders.map(([name, c]) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name} · {c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : count === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-success">
                All caught up — no forgotten clock-outs.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Anything employees are still actively clocked into today isn't shown
                here. Head to Time Tracking for today's view.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clocked In At</TableHead>
                  <TableHead>How long ago</TableHead>
                  <TableHead className="text-right">Fix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.raw.id} className="bg-warning/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center">
                          {row.initials}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm font-medium text-foreground">
                            {row.employeeName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.department}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground tabular-nums">
                      {row.dateLabel}
                    </TableCell>
                    <TableCell className="text-sm text-foreground tabular-nums">
                      {row.clockInTime}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge
                        variant="outline"
                        className={
                          row.daysAgo >= 7
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : 'bg-warning/15 text-warning border-warning/30'
                        }
                      >
                        {row.daysAgo === 0
                          ? 'Yesterday'
                          : row.daysAgo === 1
                          ? '1 day ago'
                          : `${row.daysAgo} days ago`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TimeEntryDialog
                          entry={row.raw}
                          onSaved={refresh}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Set ${row.employeeName}'s clock-out`}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Set clock-out
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${row.employeeName}'s entry`}
                          onClick={() => setPendingDelete(row.raw)}
                          className="text-muted-foreground hover:text-destructive"
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

      <DeleteForgottenDialog
        pendingDelete={pendingDelete}
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
// Delete dialog — requires a reason (audit log).
// ============================================================
interface DeleteForgottenDialogProps {
  pendingDelete: TimeEntry | null;
  onCancel: () => void;
  onConfirmed: () => Promise<void>;
}

const DeleteForgottenDialog = ({
  pendingDelete,
  onCancel,
  onConfirmed,
}: DeleteForgottenDialogProps) => {
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
      toast.success('Entry deleted');
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
          <AlertDialogTitle>Delete this forgotten punch?</AlertDialogTitle>
          <AlertDialogDescription>
            Use this when the employee never actually worked the shift (e.g. they
            clocked in by mistake or were sent home). If they DID work but just
            forgot to clock out, use "Set clock-out" instead so the worked time
            is preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="forgotten-delete-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="forgotten-delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. clocked in by mistake, sent home before shift started"
            disabled={submitting}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={submitting || !reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? 'Deleting…' : 'Delete entry'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
