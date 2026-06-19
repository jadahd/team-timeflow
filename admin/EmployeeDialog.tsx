import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Employee } from '@/types/workforce';
import { addEmployee, updateEmployee } from '@/data/employeeStore';
import { useCompany } from '@/hooks/useCompany';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

// Shared schema. Used in both add and edit modes.
// Rate is intentionally OPTIONAL — admin can save an employee without
// committing to a pay rate. Set the real value later when payroll is ready.
const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'Too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Too long'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  department: z.string().min(1, 'Department is required'),
  role: z.string().min(1, 'Role is required').max(100, 'Too long'),
  employmentStatus: z.enum(['full-time', 'part-time', 'seasonal', 'contractor']),
  payType: z.enum(['hourly', 'salary']),
  // Accept empty string / null / undefined as "not set"; otherwise coerce
  // to a non-negative number.
  rate: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0, 'Rate cannot be negative').optional(),
  ),
  isFullTimeEligible: z.boolean().default(false),
  isActive: z.boolean().default(true),
  hireDate: z.string().optional(),
  endDate: z.string().optional(),
  endReason: z.string().optional(),
  userRole: z.enum(['employee', 'manager', 'admin']),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeDialogProps {
  /** When present, dialog opens in EDIT mode pre-filled with this employee. */
  employee?: Employee;
  /** Controls a custom trigger. Defaults to a built-in button. */
  trigger?: React.ReactNode;
  /** Optional callback after successful save. */
  onSaved?: () => void;
}

export const EmployeeDialog = ({ employee, trigger, onSaved }: EmployeeDialogProps) => {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(employee);
  const { company } = useCompany();
  const { isOwner } = useAdminAuth();

  const defaultValues: EmployeeFormValues = {
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    pin: employee?.pin ?? '',
    department: employee?.department ?? '',
    role: employee?.role ?? '',
    employmentStatus: employee?.employmentStatus ?? 'part-time',
    payType: employee?.payType ?? 'hourly',
    rate: employee?.payType === 'salary' ? employee?.salary : employee?.hourlyRate,
    isFullTimeEligible: employee?.isFullTimeEligible ?? false,
    isActive: employee?.isActive ?? true,
    hireDate: employee?.hireDate ?? '',
    endDate: employee?.endDate ?? '',
    endReason: employee?.endReason ?? '',
    userRole: employee?.userRole ?? 'employee',
  };

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  // When the dialog re-opens with a different employee, refresh the form.
  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const payType = form.watch('payType');
  const isActive = form.watch('isActive');

  const onSubmit = async (values: EmployeeFormValues) => {
    const initials = `${values.firstName[0] ?? ''}${values.lastName[0] ?? ''}`.toUpperCase();
    // Treat blank or zero rates as "not set" so we don't bake $0 into payroll.
    const rateValue =
      values.rate != null && values.rate > 0 ? values.rate : undefined;

    // Offboarding logic: when Active is unchecked, persist end_date and
    // reason. When Active is checked back on, clear them so the
    // employee is treated as currently employed again.
    const trimmedEndDate = (values.endDate ?? '').trim();
    const trimmedEndReason = (values.endReason ?? '').trim();
    const endDate = !values.isActive
      ? (trimmedEndDate || isoToday())
      : undefined;
    const endReason = !values.isActive ? trimmedEndReason : '';

    const trimmedHireDate = (values.hireDate ?? '').trim();
    const payload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      initials,
      pin: values.pin,
      department: values.department,
      role: values.role,
      employmentStatus: values.employmentStatus,
      payType: values.payType,
      hourlyRate: values.payType === 'hourly' ? rateValue : undefined,
      salary: values.payType === 'salary' ? rateValue : undefined,
      isFullTimeEligible: values.isFullTimeEligible,
      userRole: values.userRole,
      locationId: '1',
      companyId: '1',
      isActive: values.isActive,
      hireDate: trimmedHireDate || undefined,
      endDate,
      endReason,
    };

    if (isEdit && employee) {
      const updated = await updateEmployee(employee.id, payload);
      if (!updated) {
        toast.error('Could not update employee. Check the console for details.');
        return;
      }
      toast.success(`${updated.firstName} ${updated.lastName} updated`);
    } else {
      const created = await addEmployee(payload);
      if (!created) {
        toast.error('Could not add employee. Check the console for details.');
        return;
      }
      toast.success(`${created.firstName} ${created.lastName} added`);
    }

    form.reset();
    setOpen(false);
    onSaved?.();
  };

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="sm">
      <Pencil className="w-4 h-4" />
    </Button>
  ) : (
    <Button size="sm">
      <Plus className="w-4 h-4 mr-2" />
      Add Employee
    </Button>
  );

  // YYYY-MM-DD in local timezone — used for default end_date.
  function isoToday(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this team member\'s details.' : 'Onboard a new team member. All fields are required.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Alex" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rivera" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>4-Digit PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {company.departments.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role / Title</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {company.roles.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employmentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="seasonal">Seasonal</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isOwner && (
                <FormField
                  control={form.control}
                  name="payType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="salary">Salary</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {isOwner && (
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{payType === 'hourly' ? 'Hourly Rate ($)' : 'Annual Salary ($)'} <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="Leave blank for not set" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="userRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hireDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hire date <span className="text-muted-foreground font-normal">(optional, powers work anniversaries)</span></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isFullTimeEligible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-1">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Full-time eligible for benefits</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-1">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Active (uncheck when they no longer work here)
                  </FormLabel>
                </FormItem>
              )}
            />

            {/* Offboarding fields — only shown when Active is unchecked.
                Last Day defaults to today on save if left blank. */}
            {!isActive && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
                <p className="text-xs text-foreground font-medium">
                  This employee is being marked as no longer here.
                </p>
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Last day worked</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Leave blank to use today. Their time entries stay in the
                        database — past pay periods still calculate correctly.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Reason (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. moved away, new job, seasonal end"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="submit">{isEdit ? 'Save Changes' : 'Add Employee'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
