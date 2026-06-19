// Pay period management — OWNER ONLY.
// Lets the owner define dated ranges (e.g. "May 1–7"), then mark them
// "closed" so the rest of the app refuses to edit time entries in that
// range. Reopening a period creates an audit log entry too.

import { useCallback, useEffect, useState } from 'react';
import { PayPeriod } from '@/types/workforce';
import {
  fetchPayPeriods,
  createPayPeriod,
  closePayPeriod,
  reopenPayPeriod,
  deletePayPeriod,
} from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Lock, LockOpen, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export const AdminPayPeriods = () => {
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setPeriods(await fetchPayPeriods());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pay Periods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Close a period to lock its time entries from edits. Open periods can
            still be modified in Time Tracking.
          </p>
        </div>
        <CreatePayPeriodDialog onCreated={refresh} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading pay periods…
            </div>
          ) : periods.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No pay periods defined yet. Create one to start locking historical
              entries.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <PayPeriodRow key={p.id} period={p} onChanged={refresh} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// Row
// ============================================================
const PayPeriodRow = ({
  period,
  onChanged,
}: {
  period: PayPeriod;
  onChanged: () => Promise<void>;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <TableRow>
      <TableCell className="text-sm tabular-nums text-foreground">
        {formatDate(period.startDate)} – {formatDate(period.endDate)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {period.label || <span className="italic">—</span>}
      </TableCell>
      <TableCell>
        {period.isClosed ? (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning border-warning/30 gap-1"
          >
            <Lock className="w-3 h-3" />
            Closed
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-success/15 text-success border-success/30 gap-1"
          >
            <LockOpen className="w-3 h-3" />
            Open
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {period.isClosed && period.closedAt ? (
          <>
            {period.closedByTier} ·{' '}
            {new Date(period.closedAt).toLocaleDateString()}
          </>
        ) : (
          <span className="italic">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {period.isClosed ? (
            <ReopenButton period={period} onChanged={onChanged} />
          ) : (
            <CloseButton period={period} onChanged={onChanged} />
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete pay period"
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
      <DeletePayPeriodAlert
        open={confirmDelete}
        period={period}
        onOpenChange={setConfirmDelete}
        onDeleted={onChanged}
      />
    </TableRow>
  );
};

// ============================================================
// Create dialog
// ============================================================
const CreatePayPeriodDialog = ({ onCreated }: { onCreated: () => Promise<void> }) => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStartDate('');
    setEndDate('');
    setLabel('');
    setNotes('');
    setSaving(false);
  };

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast.error('Both start and end dates are required.');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date must be on or after start date.');
      return;
    }
    setSaving(true);
    const created = await createPayPeriod({
      startDate,
      endDate,
      label: label.trim(),
      notes: notes.trim(),
    });
    setSaving(false);
    if (!created) {
      toast.error('Could not create pay period. Does it overlap an existing one?');
      return;
    }
    toast.success('Pay period created');
    reset();
    setOpen(false);
    await onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          New pay period
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New pay period</DialogTitle>
          <DialogDescription>
            Define the date range. You can close it later to lock those entries.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pp-start">Start date</Label>
              <Input
                id="pp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pp-end">End date</Label>
              <Input
                id="pp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="pp-label">Label (optional)</Label>
            <Input
              id="pp-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "May 1–7"'
            />
          </div>
          <div>
            <Label htmlFor="pp-notes">Notes (optional)</Label>
            <Textarea
              id="pp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Creating…' : 'Create period'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Close / Reopen actions (each requires a reason for the audit log)
// ============================================================
const CloseButton = ({
  period,
  onChanged,
}: {
  period: PayPeriod;
  onChanged: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error('Reason is required.');
      return;
    }
    setSaving(true);
    const ok = await closePayPeriod(period.id, { reason: reason.trim() });
    setSaving(false);
    if (ok) {
      toast.success('Pay period closed');
      setReason('');
      setOpen(false);
      await onChanged();
    } else {
      toast.error('Could not close pay period.');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Lock className="w-3.5 h-3.5 mr-1.5" />
        Close
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this pay period?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing locks every time entry between {formatDate(period.startDate)}{' '}
              and {formatDate(period.endDate)}. Edits and deletes will be refused
              until the period is reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="close-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="close-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. payroll submitted to Paychex"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={saving || !reason.trim()}
            >
              {saving ? 'Closing…' : 'Close period'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const ReopenButton = ({
  period,
  onChanged,
}: {
  period: PayPeriod;
  onChanged: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error('Reason is required.');
      return;
    }
    setSaving(true);
    const ok = await reopenPayPeriod(period.id, { reason: reason.trim() });
    setSaving(false);
    if (ok) {
      toast.success('Pay period reopened');
      setReason('');
      setOpen(false);
      await onChanged();
    } else {
      toast.error('Could not reopen pay period.');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <LockOpen className="w-3.5 h-3.5 mr-1.5" />
        Reopen
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-warning" />
              Reopen this pay period?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Reopening allows edits to time entries between{' '}
              {formatDate(period.startDate)} and {formatDate(period.endDate)} —
              including ones already paid out. The reopen action and your reason
              are recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reopen-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. payroll correction needed for J. Smith"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={saving || !reason.trim()}
            >
              {saving ? 'Reopening…' : 'Reopen period'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ============================================================
// Delete pay period (just the period record — does NOT delete entries)
// ============================================================
const DeletePayPeriodAlert = ({
  open,
  period,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  period: PayPeriod;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => Promise<void>;
}) => {
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    const ok = await deletePayPeriod(period.id);
    setSaving(false);
    if (ok) {
      toast.success('Pay period deleted');
      onOpenChange(false);
      await onDeleted();
    } else {
      toast.error('Could not delete pay period.');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this pay period?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes the period record. <strong>This does not delete time
            entries</strong> in the date range — they'll just no longer be
            locked. If this period was closed, time entries inside it become
            editable again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={saving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {saving ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ============================================================
// Helpers
// ============================================================
function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
