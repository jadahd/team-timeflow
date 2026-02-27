// Core types for SACS Supply & Outfitters Workforce Management System

export type EmployeeStatus = 'clocked-in' | 'on-break' | 'on-lunch' | 'clocked-out';
export type PayType = 'hourly' | 'salary';
export type EmploymentStatus = 'full-time' | 'part-time' | 'seasonal' | 'contractor';
export type UserRole = 'employee' | 'manager' | 'admin';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'seasonal';
export type AdjustmentTag = 'offline-sale' | 'invoice-pending' | 'event-sales' | 'adjustment';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  pin: string;
  department: string;
  role: string;
  employmentStatus: EmploymentStatus;
  payType: PayType;
  hourlyRate?: number; // admin-only
  salary?: number; // admin-only
  isFullTimeEligible: boolean;
  fullTimeOverride?: boolean;
  userRole: UserRole;
  locationId: string;
  companyId: string;
  isActive: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut?: string;
  breaks: BreakEntry[];
  notes: string[];
  isScheduled: boolean;
  department: string;
  date: string;
}

export interface BreakEntry {
  id: string;
  type: 'break' | 'lunch';
  startTime: string;
  endTime?: string;
  expectedReturn?: string;
}

export interface ScheduleEntry {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  department: string;
  source: 'google-sheets' | 'manual';
}

export interface Announcement {
  id: string;
  text: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
  expiresAt: string;
  createdBy: string;
}

export interface DepartmentGoal {
  id: string;
  department: string;
  period: GoalPeriod;
  target: number;
  shopifySales: number;
  manualAdjustments: ManualAdjustment[];
  startDate: string;
  endDate: string;
}

export interface ManualAdjustment {
  id: string;
  amount: number;
  tag: AdjustmentTag;
  note?: string;
  addedBy: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  color: string;
}

export interface OvertimeConfig {
  payPeriodStart: 'friday'; // Friday–Thursday
  otThresholdHours: number; // 40
  otMultiplier: number; // 1.5
  excludeSalaried: boolean;
  excludeRoles: string[];
}

export interface PayrollSummary {
  employeeId: string;
  employeeName: string;
  department: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  hourlyRate: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  notes: string[];
}

// Kiosk display types (customer-safe, no pay info)
export interface KioskEmployeeStatus {
  initials: string;
  firstName: string;
  role: string;
  department: string;
  status: EmployeeStatus;
  breakReturnTime?: string;
}
