import { Employee, TimeEntry, Announcement, DepartmentGoal, Department, ScheduleEntry, OvertimeConfig } from '@/types/workforce';

export const DEPARTMENTS: Department[] = [
  { id: '1', name: 'Retail', color: 'hsl(205, 80%, 50%)' },
  { id: '2', name: 'Embroidery', color: 'hsl(280, 60%, 50%)' },
  { id: '3', name: 'Uniform Department', color: 'hsl(152, 60%, 40%)' },
  { id: '4', name: 'Management', color: 'hsl(38, 90%, 45%)' },
  { id: '5', name: 'B2B Sales', color: 'hsl(340, 65%, 50%)' },
];

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: '1', firstName: 'Marcus', lastName: 'Johnson', initials: 'MJ',
    pin: '1234', department: 'Retail', role: 'Sales Associate',
    employmentStatus: 'full-time', payType: 'hourly', hourlyRate: 16.50,
    isFullTimeEligible: true, userRole: 'employee', locationId: '1',
    companyId: '1', isActive: true, createdAt: '2024-01-15',
  },
  {
    id: '2', firstName: 'Sarah', lastName: 'Chen', initials: 'SC',
    pin: '5678', department: 'Embroidery', role: 'Embroidery Specialist',
    employmentStatus: 'full-time', payType: 'hourly', hourlyRate: 19.00,
    isFullTimeEligible: true, userRole: 'employee', locationId: '1',
    companyId: '1', isActive: true, createdAt: '2023-08-20',
  },
  {
    id: '3', firstName: 'David', lastName: 'Martinez', initials: 'DM',
    pin: '9012', department: 'Management', role: 'Store Manager',
    employmentStatus: 'full-time', payType: 'salary', salary: 52000,
    isFullTimeEligible: true, userRole: 'admin', locationId: '1',
    companyId: '1', isActive: true, createdAt: '2022-03-10',
  },
  {
    id: '4', firstName: 'Ashley', lastName: 'Williams', initials: 'AW',
    pin: '3456', department: 'Uniform Department', role: 'Sales Associate',
    employmentStatus: 'part-time', payType: 'hourly', hourlyRate: 15.00,
    isFullTimeEligible: false, userRole: 'employee', locationId: '1',
    companyId: '1', isActive: true, createdAt: '2024-06-01',
  },
  {
    id: '5', firstName: 'Tyler', lastName: 'Brooks', initials: 'TB',
    pin: '7890', department: 'B2B Sales', role: 'B2B Account Rep',
    employmentStatus: 'full-time', payType: 'hourly', hourlyRate: 20.00,
    isFullTimeEligible: true, userRole: 'employee', locationId: '1',
    companyId: '1', isActive: true, createdAt: '2023-11-01',
  },
  {
    id: '6', firstName: 'Jordan', lastName: 'Rivera', initials: 'JR',
    pin: '2468', department: 'Retail', role: 'Seasonal Staff',
    employmentStatus: 'seasonal', payType: 'hourly', hourlyRate: 14.00,
    isFullTimeEligible: false, userRole: 'employee', locationId: '1',
    companyId: '1', isActive: true, createdAt: '2024-10-15',
  },
];

const today = new Date().toISOString().split('T')[0];

export const MOCK_TIME_ENTRIES: TimeEntry[] = [
  {
    id: '1', employeeId: '1', clockIn: `${today}T08:02:00`, department: 'Retail',
    breaks: [{ id: 'b1', type: 'break', startTime: `${today}T10:15:00`, endTime: `${today}T10:30:00` }],
    notes: [], isScheduled: true, date: today,
  },
  {
    id: '2', employeeId: '2', clockIn: `${today}T07:55:00`, department: 'Embroidery',
    breaks: [{ id: 'b2', type: 'lunch', startTime: `${today}T12:00:00`, expectedReturn: `${today}T12:30:00` }],
    notes: [], isScheduled: true, date: today,
  },
  {
    id: '3', employeeId: '3', clockIn: `${today}T07:30:00`, department: 'Management',
    breaks: [], notes: [], isScheduled: true, date: today,
  },
  {
    id: '4', employeeId: '5', clockIn: `${today}T09:00:00`, clockOut: `${today}T17:00:00`,
    department: 'B2B Sales', breaks: [
      { id: 'b3', type: 'break', startTime: `${today}T10:30:00`, endTime: `${today}T10:45:00` },
      { id: 'b4', type: 'lunch', startTime: `${today}T13:00:00`, endTime: `${today}T13:30:00` },
    ], notes: ['Client meeting at 2pm'], isScheduled: true, date: today,
  },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1', text: '🎉 New uniform shipment arriving Thursday — all hands for unboxing!',
    priority: 'normal', createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), createdBy: '3',
  },
  {
    id: '2', text: '⚡ Flash sale this weekend: 20% off all embroidered items',
    priority: 'urgent', createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), createdBy: '3',
  },
  {
    id: '3', text: '📋 Quarterly inventory count scheduled for next Monday',
    priority: 'normal', createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), createdBy: '3',
  },
];

export const MOCK_GOALS: DepartmentGoal[] = [
  {
    id: '1', department: 'Retail', period: 'daily', target: 3500,
    shopifySales: 2180, manualAdjustments: [
      { id: 'a1', amount: 350, tag: 'offline-sale', note: 'Cash sale - boots', addedBy: '3', createdAt: today },
    ], startDate: today, endDate: today,
  },
  {
    id: '2', department: 'Embroidery', period: 'daily', target: 1200,
    shopifySales: 890, manualAdjustments: [
      { id: 'a2', amount: 200, tag: 'invoice-pending', note: 'Corporate order #4521', addedBy: '3', createdAt: today },
    ], startDate: today, endDate: today,
  },
  {
    id: '3', department: 'Uniform Department', period: 'daily', target: 2000,
    shopifySales: 1650, manualAdjustments: [], startDate: today, endDate: today,
  },
  {
    id: '4', department: 'B2B Sales', period: 'daily', target: 5000,
    shopifySales: 3200, manualAdjustments: [
      { id: 'a3', amount: 1500, tag: 'event-sales', note: 'Trade show orders', addedBy: '3', createdAt: today },
    ], startDate: today, endDate: today,
  },
];

export const DEFAULT_OT_CONFIG: OvertimeConfig = {
  payPeriodStart: 'friday',
  otThresholdHours: 40,
  otMultiplier: 1.5,
  excludeSalaried: true,
  excludeRoles: ['Store Manager'],
};

export function getEmployeeStatus(employeeId: string, entries: TimeEntry[]) {
  const entry = entries.find(e => e.employeeId === employeeId && !e.clockOut);
  if (!entry) return 'clocked-out' as const;
  const activeBreak = entry.breaks.find(b => !b.endTime);
  if (activeBreak) return activeBreak.type === 'lunch' ? 'on-lunch' as const : 'on-break' as const;
  return 'clocked-in' as const;
}

export function getActiveBreakReturn(employeeId: string, entries: TimeEntry[]): string | undefined {
  const entry = entries.find(e => e.employeeId === employeeId && !e.clockOut);
  if (!entry) return undefined;
  const activeBreak = entry.breaks.find(b => !b.endTime);
  return activeBreak?.expectedReturn;
}
