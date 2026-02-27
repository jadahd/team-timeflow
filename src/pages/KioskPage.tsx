import { useState, useEffect, useCallback } from 'react';
import { Employee, TimeEntry, EmployeeStatus } from '@/types/workforce';
import { MOCK_EMPLOYEES, MOCK_TIME_ENTRIES, MOCK_ANNOUNCEMENTS, MOCK_GOALS, getEmployeeStatus, getActiveBreakReturn } from '@/data/mockData';
import { KioskInitialsGrid } from '@/components/kiosk/KioskInitialsGrid';
import { KioskPinEntry } from '@/components/kiosk/KioskPinEntry';
import { KioskClockActions } from '@/components/kiosk/KioskClockActions';
import { KioskStaffBoard } from '@/components/kiosk/KioskStaffBoard';
import { KioskAnnouncementsBanner } from '@/components/kiosk/KioskAnnouncementsBanner';
import { KioskGoalsDisplay } from '@/components/kiosk/KioskGoalsDisplay';
import { KioskClock } from '@/components/kiosk/KioskClock';

type KioskView = 'idle' | 'pin' | 'actions';
const IDLE_TIMEOUT = 30000; // 30 seconds

const KioskPage = () => {
  const [view, setView] = useState<KioskView>('idle');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(MOCK_TIME_ENTRIES);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const resetToIdle = useCallback(() => {
    setView('idle');
    setSelectedEmployee(null);
  }, []);

  // Auto-reset idle
  useEffect(() => {
    const interval = setInterval(() => {
      if (view !== 'idle' && Date.now() - lastActivity > IDLE_TIMEOUT) {
        resetToIdle();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [view, lastActivity, resetToIdle]);

  const touch = () => setLastActivity(Date.now());

  const handleSelectEmployee = (emp: Employee) => {
    touch();
    setSelectedEmployee(emp);
    setView('pin');
  };

  const handlePinSuccess = () => {
    touch();
    setView('actions');
  };

  const handleClockIn = () => {
    if (!selectedEmployee) return;
    const now = new Date().toISOString();
    const newEntry: TimeEntry = {
      id: `te-${Date.now()}`,
      employeeId: selectedEmployee.id,
      clockIn: now,
      department: selectedEmployee.department,
      breaks: [],
      notes: [],
      isScheduled: true,
      date: new Date().toISOString().split('T')[0],
    };
    setTimeEntries(prev => [...prev, newEntry]);
    setTimeout(resetToIdle, 2000);
  };

  const handleClockOut = () => {
    if (!selectedEmployee) return;
    setTimeEntries(prev =>
      prev.map(e =>
        e.employeeId === selectedEmployee.id && !e.clockOut
          ? { ...e, clockOut: new Date().toISOString() }
          : e
      )
    );
    setTimeout(resetToIdle, 2000);
  };

  const handleStartBreak = (type: 'break' | 'lunch') => {
    if (!selectedEmployee) return;
    const now = new Date();
    const returnTime = new Date(now.getTime() + (type === 'lunch' ? 30 : 15) * 60000);
    setTimeEntries(prev =>
      prev.map(e =>
        e.employeeId === selectedEmployee.id && !e.clockOut
          ? {
              ...e,
              breaks: [...e.breaks, {
                id: `br-${Date.now()}`,
                type,
                startTime: now.toISOString(),
                expectedReturn: returnTime.toISOString(),
              }],
            }
          : e
      )
    );
    setTimeout(resetToIdle, 2000);
  };

  const handleEndBreak = () => {
    if (!selectedEmployee) return;
    setTimeEntries(prev =>
      prev.map(e =>
        e.employeeId === selectedEmployee.id && !e.clockOut
          ? {
              ...e,
              breaks: e.breaks.map(b =>
                !b.endTime ? { ...b, endTime: new Date().toISOString() } : b
              ),
            }
          : e
      )
    );
    setTimeout(resetToIdle, 2000);
  };

  const activeEmployees = MOCK_EMPLOYEES.filter(e => e.isActive);
  const currentStatus = selectedEmployee
    ? getEmployeeStatus(selectedEmployee.id, timeEntries)
    : 'clocked-out';

  const kioskStatuses = activeEmployees.map(emp => ({
    initials: emp.initials,
    firstName: emp.firstName,
    role: emp.role,
    department: emp.department,
    status: getEmployeeStatus(emp.id, timeEntries),
    breakReturnTime: getActiveBreakReturn(emp.id, timeEntries),
  }));

  return (
    <div className="min-h-screen kiosk-bg flex flex-col" onClick={touch}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-kiosk-muted">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-kiosk-foreground font-semibold text-lg">SACS Supply & Outfitters</h1>
            <p className="text-kiosk-muted-foreground text-xs">Workforce Dashboard</p>
          </div>
        </div>
        <KioskClock />
      </div>

      {/* Announcements */}
      <KioskAnnouncementsBanner announcements={MOCK_ANNOUNCEMENTS} />

      {/* Main content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: Action area */}
        <div className="flex-1 flex items-center justify-center">
          {view === 'idle' && (
            <KioskInitialsGrid
              employees={activeEmployees}
              timeEntries={timeEntries}
              onSelect={handleSelectEmployee}
            />
          )}
          {view === 'pin' && selectedEmployee && (
            <KioskPinEntry
              employee={selectedEmployee}
              onSuccess={handlePinSuccess}
              onCancel={resetToIdle}
            />
          )}
          {view === 'actions' && selectedEmployee && (
            <KioskClockActions
              employee={selectedEmployee}
              status={currentStatus}
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
              onStartBreak={handleStartBreak}
              onEndBreak={handleEndBreak}
              onCancel={resetToIdle}
            />
          )}
        </div>

        {/* Right: Status + Goals */}
        <div className="w-80 flex flex-col gap-4 overflow-hidden">
          <KioskStaffBoard statuses={kioskStatuses} />
          <KioskGoalsDisplay goals={MOCK_GOALS} />
        </div>
      </div>
    </div>
  );
};

export default KioskPage;
