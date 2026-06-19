import { useEffect, useState } from 'react';
import { Employee, TimeEntry, TimeEntryType } from '@/types/workforce';
import { useEmployees } from '@/hooks/useEmployees';
import { useCompany } from '@/hooks/useCompany';
import {
  createManualTimeEntry,
  updateTimeEntry,
  deleteBreak,
  updateBreak,
  createBreak,
} from '@/lib/db';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface TimeEntryDialogProps {
  /** When present, dialog opens in EDIT mode for this entry. */
  entry?: TimeEntry;
  /** Date in YYYY-MM-DD form. Used when creating a new manual entry
   *  on a date other than today (e.g. forgot-to-clock-in on Monday,
   *  admin fills it in on Wednesday). */
  defaultDate?: string;
  /** When true, the entry's date sits inside a closed pay period — we
   *  refuse to open the dialog and show a friendly note instead. */
  payPeriodLocked?: boolean;
  /** Custom trigger element. Defaults to a built-in button. */
  trigger?: React.ReactNode;
  /** Called after a successful save so the parent can refresh. */
  onSaved?: () => void;
}

export const TimeEntryDialog = ({
  entry,
  defaultDate,
  payPeriodLocked = false,
  trigger,
  onSaved,
}: TimeEntryDialogProps) => {
  const [open, setOpen] = useState(false);
  const employees = useEmployees();
  const { company } = useCompany();
  const isEdit = Boolean(entry);

  // Form state
  const [employeeId, setEmployeeId] = useState<string>(entry?.employeeId ?? '');
  const [clockInLocal, setClockInLocal] = useState<string>(
    toLocalInputValue(entry?.clockIn ?? defaultClockInForDate(defaultDate)),
  );
  const [clockOutLocal, setClockOutLocal] = useState<string>(
    entry?.clockOut ? toLocalInputValue(entry.clockOut) : '',
  );
  const [department, setDepartment] = useState<string>(
    entry?.department ?? '',
  );
  const [notes, setNotes] = useState<string>(entry?.notes.join('\n') ?? '');
  const [entryType, setEntryType] = useState<TimeEntryType>(entry?.entryType ?? 'work');
  // Local copy of breaks so deletes feel snappy.
  const [breaks, setBreaks] = useState(entry?.breaks ?? []);
  // Inline break editor state — when set, one of the break rows shows
  // two datetime-local inputs instead of the static text.
  const [editingBreakId, setEditingBreakId] = useState<string | null>(null);
  const [editBreakStart, setEditBreakStart] = useState('');
  const [editBreakEnd, setEditBreakEnd] = useState('');
  // "Add lunch" inline form state
  const [addingLunch, setAddingLunch] = useState(false);
  const [newLunchStart, setNewLunchStart] = useState('');
  const [newLunchEnd, setNewLunchEnd] = useState('');
  // Reason field — required in edit mode for the audit log.
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Reset to incoming values whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setEmployeeId(entry?.employeeId ?? '');
    setClockInLocal(toLocalInputValue(entry?.clockIn ?? defaultClockInForDate(defaultDate)));
    setClockOutLocal(entry?.clockOut ? toLocalInputValue(entry.clockOut) : '');
    setDepartment(entry?.department ?? '');
    setNotes(entry?.notes.join('\n') ?? '');
    setEntryType(entry?.entryType ?? 'work');
    setBreaks(entry?.breaks ?? []);
    setReason('');
    setSaving(false);
    setEditingBreakId(null);
    setAddingLunch(false);
    setNewLunchStart('');
    setNewLunchEnd('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id, defaultDate]);

  // When the admin picks an employee in CREATE mode, default the
  // department to that employee's primary department.
  const handleEmployeeChange = (id: string) => {
    setEmployeeId(id);
    if (!department) {
      const emp = employees.find((e) => e.id === id);
      if (emp) setDepartment(emp.department);
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    const ok = await deleteBreak(breakId);
    if (ok) {
      setBreaks((prev) => prev.filter((b) => b.id !== breakId));
      toast.success('Break deleted');
      onSaved?.();
    } else {
      toast.error('Could not delete break.');
    }
  };

  const handleStartEditBreak = (b: typeof breaks[number]) => {
    setEditingBreakId(b.id);
    setEditBreakStart(toLocalInputValue(b.startTime));
    setEditBreakEnd(b.endTime ? toLocalInputValue(b.endTime) : '');
  };

  const handleCancelEditBreak = () => {
    setEditingBreakId(null);
    setEditBreakStart('');
    setEditBreakEnd('');
  };

  const handleStartAddLunch = () => {
    setAddingLunch(true);
    // Seed reasonable defaults — noon-ish on the shift's date.
    const shiftDate = entry?.clockIn ? new Date(entry.clockIn) : new Date();
    shiftDate.setHours(12, 0, 0, 0);
    setNewLunchStart(toLocalInputValue(shiftDate.toISOString()));
    const endGuess = new Date(shiftDate);
    endGuess.setMinutes(endGuess.getMinutes() + 30);
    setNewLunchEnd(toLocalInputValue(endGuess.toISOString()));
  };

  const handleCancelAddLunch = () => {
    setAddingLunch(false);
    setNewLunchStart('');
    setNewLunchEnd('');
  };

  const handleSaveNewLunch = async () => {
    if (!entry) return;
    if (!newLunchStart) {
      toast.error('Lunch start time is required.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Add a reason for change (top of dialog) — it goes in the audit log.');
      return;
    }
    const startISO = new Date(newLunchStart).toISOString();
    const endISO = newLunchEnd ? new Date(newLunchEnd).toISOString() : null;
    if (endISO && endISO < startISO) {
      toast.error('Lunch end must be after start.');
      return;
    }
    const created = await createBreak(
      entry.id,
      { startTime: startISO, endTime: endISO, type: 'lunch' },
      { reason: reason.trim() },
    );
    if (!created) {
      toast.error('Could not add lunch.');
      return;
    }
    setBreaks((prev) => [...prev, created]);
    handleCancelAddLunch();
    toast.success('Lunch added');
    onSaved?.();
  };

  const handleSaveEditBreak = async () => {
    if (!editingBreakId) return;
    if (!editBreakStart) {
      toast.error('Break start time is required.');
      return;
    }
    const startISO = new Date(editBreakStart).toISOString();
    const endISO = editBreakEnd ? new Date(editBreakEnd).toISOString() : null;
    if (endISO && endISO < startISO) {
      toast.error('Break end must be after break start.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Add a reason for change (top of dialog) — it goes in the audit log.');
      return;
    }
    const updated = await updateBreak(
      editingBreakId,
      { startTime: startISO, endTime: endISO },
      { reason: reason.trim() },
    );
    if (!updated) {
      toast.error('Could not update break.');
      return;
    }
    setBreaks((prev) =>
      prev.map((b) =>
        b.id === editingBreakId
          ? { ...b, startTime: startISO, endTime: endISO ?? undefined }
          : b,
      ),
    );
    handleCancelEditBreak();
    toast.success('Break updated');
    onSaved?.();
  };

  const handleSave = async () => {
    // Validation
    if (!employeeId) {
      toast.error('Pick an employee first.');
      return;
    }
    if (!clockInLocal) {
      toast.error('Clock-in time is required.');
      return;
    }
    if (!department) {
      toast.error('Department is required.');
      return;
    }
    if (isEdit && !reason.trim()) {
      toast.error('Please add a reason — it goes in the audit log.');
      return;
    }
    const clockInISO = new Date(clockInLocal).toISOString();
    const clockOutISO = clockOutLocal ? new Date(clockOutLocal).toISOString() : null;
    if (clockOutISO && clockOutISO < clockInISO) {
      toast.error('Clock-out must be after clock-in.');
      return;
    }
    const notesArr = notes
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      if (isEdit && entry) {
        const updated = await updateTimeEntry(
          entry.id,
          {
            clockIn: clockInISO,
            clockOut: clockOutISO,
            department,
            notes: notesArr,
            entryType,
          },
          { reason: reason.trim() },
        );
        if (!updated) {
          toast.error(
            'Could not update entry. The entry may be in a closed pay period.',
          );
          return;
        }
        toast.success('Time entry updated');
      } else {
        const created = await createManualTimeEntry({
          employeeId,
          clockIn: clockInISO,
          clockOut: clockOutISO,
          department,
          notes: notesArr,
          entryType,
        });
        if (!created) {
          toast.error('Could not create entry.');
          return;
        }
        toast.success('Time entry added');
      }

      setOpen(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="sm" aria-label="Edit time entry">
      <Pencil className="w-4 h-4" />
    </Button>
  ) : (
    <Button size="sm">
      <Plus className="w-4 h-4 mr-1.5" />
      Add Entry
    </Button>
  );

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Time Entry' : 'Add Manual Time Entry'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Adjust ${selectedEmployee ? `${selectedEmployee.firstName}'s` : "this employee's"} clock-in/out times or notes.`
              : 'Record a time entry on behalf of an employee — useful when someone forgot to clock in.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee picker — only in create mode; in edit it's fixed */}
          {!isEdit && (
            <div>
              <Label htmlFor="te-employee">Employee</Label>
              <Select value={employeeId} onValueChange={handleEmployeeChange}>
                <SelectTrigger id="te-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => e.isActive)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.initials})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isEdit && selectedEmployee && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Employee: </span>
              <span className="font-medium text-foreground">
                {selectedEmployee.firstName} {selectedEmployee.lastName}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                Change the employee by deleting this entry and creating a new one.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="te-clockin">Clock In</Label>
              <Input
                id="te-clockin"
                type="datetime-local"
                value={clockInLocal}
                onChange={(e) => setClockInLocal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="te-clockout">Clock Out</Label>
              <Input
                id="te-clockout"
                type="datetime-local"
                value={clockOutLocal}
                onChange={(e) => setClockOutLocal(e.target.value)}
                placeholder="Leave blank if still working"
              />
              <p className="text-xs text-muted-foreground mt-1">Blank = still clocked in.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="te-department">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="te-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {company.departments.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="te-type">Entry Type</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as TimeEntryType)}>
                <SelectTrigger id="te-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work (regular hours)</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="pto">PTO</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="bereavement">Bereavement</SelectItem>
                  <SelectItem value="jury-duty">Jury Duty</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Flag paid-but-not-worked hours so payroll can separate them later.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="te-notes">Notes</Label>
            <Textarea
              id="te-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="One note per line, e.g. &quot;Manual entry — forgot to clock in&quot;"
            />
            <p className="text-xs text-muted-foreground mt-1">One note per line.</p>
          </div>

          {/* Reason — required when editing so the audit log knows why */}
          {isEdit && (
            <div>
              <Label htmlFor="te-reason">
                Reason for change <span className="text-destructive">*</span>
              </Label>
              <Input
                id="te-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. forgot to clock out, fixed wrong department"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recorded in the audit log alongside who changed what.
              </p>
            </div>
          )}

          {/* Breaks list (edit mode only) */}
          {isEdit && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="mb-0">Lunch on this shift</Label>
                {!addingLunch && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartAddLunch}
                    disabled={editingBreakId !== null}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add lunch
                  </Button>
                )}
              </div>

              {/* Inline "Add lunch" form */}
              {addingLunch && (
                <div className="mb-2 rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-2">
                  <div className="text-xs uppercase font-medium text-muted-foreground">
                    New lunch
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="new-lunch-start" className="text-xs">
                        Start
                      </Label>
                      <Input
                        id="new-lunch-start"
                        type="datetime-local"
                        value={newLunchStart}
                        onChange={(e) => setNewLunchStart(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-lunch-end" className="text-xs">
                        End <span className="text-muted-foreground">(blank = still on lunch)</span>
                      </Label>
                      <Input
                        id="new-lunch-end"
                        type="datetime-local"
                        value={newLunchEnd}
                        onChange={(e) => setNewLunchEnd(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelAddLunch}
                      type="button"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveNewLunch} type="button">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save lunch
                    </Button>
                  </div>
                </div>
              )}

              {breaks.length === 0 && !addingLunch && (
                <p className="text-xs italic text-muted-foreground py-2">
                  No lunch recorded on this shift. Click "Add lunch" if the
                  employee took one but forgot to scan it.
                </p>
              )}

              {breaks.length > 0 && (
              <div className="space-y-1 rounded-lg border border-border">
                {breaks.map((b) => {
                  const isEditingThis = editingBreakId === b.id;
                  return (
                    <div
                      key={b.id}
                      className="px-3 py-2 text-sm"
                    >
                      {isEditingThis ? (
                        // Inline editor — two datetime-locals + Save/Cancel
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="uppercase font-medium text-muted-foreground">
                              {b.type}
                            </span>
                            <span className="text-muted-foreground">— editing</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor={`brk-start-${b.id}`} className="text-xs">
                                Start
                              </Label>
                              <Input
                                id={`brk-start-${b.id}`}
                                type="datetime-local"
                                value={editBreakStart}
                                onChange={(e) => setEditBreakStart(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`brk-end-${b.id}`} className="text-xs">
                                End <span className="text-muted-foreground">(blank = still on break)</span>
                              </Label>
                              <Input
                                id={`brk-end-${b.id}`}
                                type="datetime-local"
                                value={editBreakEnd}
                                onChange={(e) => setEditBreakEnd(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEditBreak}
                              type="button"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEditBreak}
                              type="button"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Save break
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Static view — text + edit + delete icons
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-medium text-muted-foreground">
                              {b.type}
                            </span>
                            <span className="tabular-nums text-foreground">
                              {new Date(b.startTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {' → '}
                              {b.endTime
                                ? new Date(b.endTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'still on break'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditBreak(b)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1"
                              aria-label="Edit break times"
                              disabled={editingBreakId !== null}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBreak(b.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1"
                              aria-label="Delete break"
                              disabled={editingBreakId !== null}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Click the pencil to fix a lunch's start/end (e.g. when an
                employee forgot to clock back in). "Add lunch" creates a new
                one if the kiosk missed it. Changes are recorded in the audit
                log using the reason above.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || payPeriodLocked || (isEdit && !reason.trim())}
            title={payPeriodLocked ? 'This date is in a closed pay period' : undefined}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** ISO → "YYYY-MM-DDTHH:mm" in the browser's local timezone. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Build an ISO clock-in default for the "Add Entry" form.
 * If `defaultDate` (YYYY-MM-DD) is provided, use 9:00 AM on that date —
 * a sensible starting point for backfilling forgotten punches.
 * Otherwise, use right now.
 */
function defaultClockInForDate(defaultDate?: string): string {
  if (!defaultDate) return new Date().toISOString();
  const d = new Date(defaultDate + 'T09:00:00');
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}
