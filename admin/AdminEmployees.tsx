import { useCallback, useEffect, useState } from 'react';
import { Employee } from '@/types/workforce';
import { useEmployees } from '@/hooks/useEmployees';
import { refreshEmployees } from '@/data/employeeStore';
import {
  deleteEmployee,
  restoreEmployee,
  purgeEmployee,
  fetchDeletedEmployees,
  fetchTimeEntryCountsForAllEmployees,
} from '@/lib/db';
import { useAdminAuth } from '@/hooks/useAdminAuth';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { EmployeeDialog } from './EmployeeDialog';
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Archive,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export const AdminEmployees = () => {
  const employees = useEmployees();
  const { isOwner } = useAdminAuth();
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [pendingPurge, setPendingPurge] = useState<Employee | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [deletedExpanded, setDeletedExpanded] = useState(false);
  const [deletedEmployees, setDeletedEmployees] = useState<Employee[]>([]);
  const [entryCounts, setEntryCounts] = useState<Map<string, number>>(new Map());

  const refreshDeleted = useCallback(async () => {
    setDeletedEmployees(await fetchDeletedEmployees());
  }, []);
  const refreshCounts = useCallback(async () => {
    setEntryCounts(await fetchTimeEntryCountsForAllEmployees());
  }, []);

  useEffect(() => {
    void refreshDeleted();
    void refreshCounts();
  }, [refreshDeleted, refreshCounts]);

  // Split into active vs former (both excluding soft-deleted, which are
  // filtered out by fetchEmployees already).
  const active = employees.filter((e) => e.isActive);
  const former = employees
    .filter((e) => !e.isActive)
    .sort((a, b) => {
      // Most recently departed first.
      const ad = a.endDate ?? '';
      const bd = b.endDate ?? '';
      return bd.localeCompare(ad);
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {active.length} active
            {former.length > 0 && (
              <span className="text-muted-foreground/60">
                {' · '}
                {former.length} former
              </span>
            )}
          </span>
          <EmployeeDialog />
        </div>
      </div>

      {/* Active employees */}
      <Card>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No active employees yet. Click "Add Employee" above to add the first one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {isOwner && <TableHead>Pay Type</TableHead>}
                  {isOwner && <TableHead className="text-right">Rate</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((emp) => (
                  <EmployeeListRow
                    key={emp.id}
                    emp={emp}
                    isOwner={isOwner}
                    // Trash icon never shows in the Active list. The only
                    // path to remove an active employee is to offboard
                    // them first (uncheck Active in the edit dialog).
                    canDelete={false}
                    onRequestDelete={setPendingDelete}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Archive — collapsed by default */}
      {former.length > 0 && (
        <Card className="mt-6">
          <button
            type="button"
            onClick={() => setArchiveExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors rounded-t-xl"
            aria-expanded={archiveExpanded}
          >
            <span className="flex items-center gap-2">
              {archiveExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <Archive className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Former Employees
              </span>
              <span className="text-xs text-muted-foreground">
                ({former.length})
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {archiveExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {archiveExpanded && (
            <CardContent className="p-0 border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {isOwner && <TableHead>Pay Type</TableHead>}
                    {isOwner && <TableHead className="text-right">Rate</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {former.map((emp) => {
                    const count = entryCounts.get(emp.id) ?? 0;
                    return (
                      <EmployeeListRow
                        key={emp.id}
                        emp={emp}
                        isOwner={isOwner}
                        // Former employees: trash visible, but disabled
                        // when they have time history. Only zero-history
                        // entries (rare — test records) can be deleted.
                        canDelete={true}
                        deleteDisabledReason={
                          count > 0
                            ? `Has ${count} time ${count === 1 ? 'entry' : 'entries'} — cannot delete (use the audit log if needed)`
                            : null
                        }
                        onRequestDelete={setPendingDelete}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Recently Deleted — soft-deleted employees, owner-only */}
      {isOwner && deletedEmployees.length > 0 && (
        <Card className="mt-6 border-destructive/20">
          <button
            type="button"
            onClick={() => setDeletedExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-destructive/5 transition-colors rounded-t-xl"
            aria-expanded={deletedExpanded}
          >
            <span className="flex items-center gap-2">
              {deletedExpanded ? (
                <ChevronDown className="w-4 h-4 text-destructive" />
              ) : (
                <ChevronRight className="w-4 h-4 text-destructive" />
              )}
              <Trash2 className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-foreground">
                Recently Deleted
              </span>
              <span className="text-xs text-muted-foreground">
                ({deletedEmployees.length})
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {deletedExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {deletedExpanded && (
            <CardContent className="p-0 border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Deleted on</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <p className="font-medium text-foreground text-sm">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emp.department} · {emp.role}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {emp.deletedAt
                          ? new Date(emp.deletedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const ok = await restoreEmployee(emp.id, {
                                reason: 'Restored from Recently Deleted',
                              });
                              if (ok) {
                                toast.success(
                                  `${emp.firstName} ${emp.lastName} restored`,
                                );
                                await refreshEmployees();
                                await refreshDeleted();
                              } else {
                                toast.error('Could not restore employee.');
                              }
                            }}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingPurge(emp)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Permanently delete ${emp.firstName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      <DeleteConfirmDialog
        employee={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirmed={async () => {
          await refreshEmployees();
          await refreshDeleted();
          setPendingDelete(null);
        }}
      />
      <PurgeConfirmDialog
        employee={pendingPurge}
        onCancel={() => setPendingPurge(null)}
        onConfirmed={async () => {
          await refreshDeleted();
          await refreshCounts();
          setPendingPurge(null);
        }}
      />
    </div>
  );
};

// ============================================================
// Soft-delete confirm dialog — requires typing the employee's
// full name before the Delete button enables.
// ============================================================
interface DeleteConfirmProps {
  employee: Employee | null;
  onCancel: () => void;
  onConfirmed: () => Promise<void>;
}

const DeleteConfirmDialog = ({
  employee,
  onCancel,
  onConfirmed,
}: DeleteConfirmProps) => {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fullName = employee ? `${employee.firstName} ${employee.lastName}` : '';
  const matches = typed.trim() === fullName;

  const handleConfirm = async () => {
    if (!employee || !matches) return;
    setSubmitting(true);
    const ok = await deleteEmployee(employee.id, {
      reason: `Soft-deleted from Employees page (former employee, no time history blocking)`,
    });
    setSubmitting(false);
    if (ok) {
      toast.success(`${fullName} moved to Recently Deleted`);
      setTyped('');
      await onConfirmed();
    } else {
      toast.error('Could not delete employee.');
    }
  };

  return (
    <AlertDialog
      open={Boolean(employee)}
      onOpenChange={(open) => {
        if (!open) {
          setTyped('');
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {fullName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Moves them to <strong>Recently Deleted</strong>, where you can restore
            them later or permanently purge. Their time-entry history is preserved
            until permanent purge. Recoverable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm-name">
            Type <span className="font-semibold text-foreground">{fullName}</span>{' '}
            to confirm
          </Label>
          <Input
            id="delete-confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={fullName}
            disabled={submitting}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={!matches || submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ============================================================
// Permanent-purge confirm dialog — second-tier protection for
// the Recently Deleted view. Requires typing the literal phrase
// PERMANENTLY DELETE because this DOES cascade through time entries.
// ============================================================
const PurgeConfirmDialog = ({
  employee,
  onCancel,
  onConfirmed,
}: DeleteConfirmProps) => {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const REQUIRED = 'PERMANENTLY DELETE';
  const matches = typed.trim() === REQUIRED;

  const handleConfirm = async () => {
    if (!employee || !matches) return;
    setSubmitting(true);
    const ok = await purgeEmployee(employee.id, {
      reason: 'Permanent purge from Recently Deleted view',
    });
    setSubmitting(false);
    if (ok) {
      toast.success(
        `${employee.firstName} ${employee.lastName} permanently deleted`,
      );
      setTyped('');
      await onConfirmed();
    } else {
      toast.error('Could not permanently delete employee.');
    }
  };

  return (
    <AlertDialog
      open={Boolean(employee)}
      onOpenChange={(open) => {
        if (!open) {
          setTyped('');
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Permanently delete {employee?.firstName} {employee?.lastName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This{' '}
            <strong className="text-destructive">cannot be undone</strong>. It
            removes the employee record and{' '}
            <strong>cascades through every time entry and break they ever had</strong>.
            Payroll history will be lost. Use this only when you're certain — for
            example, removing a test record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="purge-confirm">
            Type{' '}
            <span className="font-mono font-semibold text-destructive">
              {REQUIRED}
            </span>{' '}
            to confirm
          </Label>
          <Input
            id="purge-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={REQUIRED}
            disabled={submitting}
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={!matches || submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? 'Deleting…' : 'Permanently delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ============================================================
// Row — extracted so the Active table and the Archive table share
// exactly the same rendering, no copy-paste drift.
// ============================================================
interface RowProps {
  emp: Employee;
  isOwner: boolean;
  /** When false, the Trash icon doesn't render at all (Active list). */
  canDelete: boolean;
  /** When set, the Trash icon renders but is disabled with this tooltip. */
  deleteDisabledReason?: string | null;
  onRequestDelete: (emp: Employee) => void;
}

const EmployeeListRow = ({
  emp,
  isOwner,
  canDelete,
  deleteDisabledReason = null,
  onRequestDelete,
}: RowProps) => {
  return (
    <TableRow className={emp.isActive ? '' : 'opacity-60'}>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent">{emp.initials}</span>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">
              {emp.firstName} {emp.lastName}
              {!emp.isActive && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {emp.endDate
                    ? `(left ${new Date(emp.endDate + 'T00:00:00').toLocaleDateString(
                        undefined,
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )})`
                    : '(inactive)'}
                </span>
              )}
            </p>
            {emp.isActive && emp.hireDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Hired {new Date(emp.hireDate + 'T00:00:00').toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric', year: 'numeric' },
                )}
                {' · '}
                {yearsAndMonthsSince(emp.hireDate)}
              </p>
            )}
            {!emp.isActive && emp.endReason && (
              <p className="text-xs text-muted-foreground italic mt-0.5">
                {emp.endReason}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{emp.department}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{emp.role}</TableCell>
      <TableCell>
        <Badge
          variant={emp.employmentStatus === 'full-time' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {emp.employmentStatus}
        </Badge>
      </TableCell>
      {isOwner && (
        <TableCell className="text-sm text-muted-foreground capitalize">{emp.payType}</TableCell>
      )}
      {isOwner && (
        <TableCell className="text-right text-sm font-medium tabular-nums text-foreground">
          {emp.payType === 'hourly'
            ? emp.hourlyRate && emp.hourlyRate > 1
              ? `$${emp.hourlyRate.toFixed(2)}/hr`
              : <span className="text-muted-foreground italic">not set</span>
            : emp.salary && emp.salary > 1
              ? `$${(emp.salary / 1000).toFixed(0)}k/yr`
              : <span className="text-muted-foreground italic">not set</span>}
        </TableCell>
      )}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <EmployeeDialog
            employee={emp}
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Edit ${emp.firstName}`}>
                <Pencil className="w-4 h-4" />
              </Button>
            }
          />
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${emp.firstName}`}
              onClick={() => onRequestDelete(emp)}
              disabled={Boolean(deleteDisabledReason)}
              title={deleteDisabledReason ?? `Delete ${emp.firstName}`}
              className="text-muted-foreground hover:text-destructive disabled:hover:text-muted-foreground"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

/** "3 years, 2 months" / "1 year" / "8 months" style tenure formatter. */
function yearsAndMonthsSince(isoDate: string): string {
  const hire = new Date(isoDate + 'T00:00:00');
  const now = new Date();
  let months =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth());
  if (now.getDate() < hire.getDate()) months--;
  if (months < 0) return 'starting soon';
  if (months === 0) return 'just hired';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} ${y === 1 ? 'yr' : 'yrs'}`;
  return `${y} ${y === 1 ? 'yr' : 'yrs'}, ${m} mo`;
}
