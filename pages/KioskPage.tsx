import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Employee, TimeEntry } from '@/types/workforce';
import {
  getEmployeeStatus,
  getActiveBreakReturn,
  getActiveBreakStart,
} from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useAnniversaries } from '@/hooks/useAnniversaries';
import {
  createTimeEntry,
  clockOutTimeEntry,
  startBreak,
  endBreak,
  fetchOpenEntryForEmployee,
} from '@/lib/db';
import { KioskInitialsGrid } from '@/components/kiosk/KioskInitialsGrid';
import { KioskPinEntry } from '@/components/kiosk/KioskPinEntry';
import { KioskClockActions } from '@/components/kiosk/KioskClockActions';
import { KioskStaffBoard } from '@/components/kiosk/KioskStaffBoard';
import { KioskAnnouncementsBanner } from '@/components/kiosk/KioskAnnouncementsBanner';
import { KioskStaleShiftWarning } from '@/components/kiosk/KioskStaleShiftWarning';
import { KioskClock } from '@/components/kiosk/KioskClock';
import { CompanyLogo } from '@/components/CompanyLogo';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

type KioskView = 'idle' | 'pin' | 'actions' | 'stale-shift';
const IDLE_TIMEOUT = 30000; // 30 seconds
// An open shift this old or older triggers the "see a manager" screen
// instead of the normal Clock Out flow. Same-day forgotten clock-outs
// still resolve normally — this only catches multi-day phantoms.
const STALE_SHIFT_HOURS = 12;

const KioskPage = () => {
  const { company } = useCompany();
  const [view, setView] = useState<KioskView>('idle');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  // The employee's most recent open entry (across all dates). Fetched the
  // moment their PIN is accepted, used to:
  //   - decide whether to show the "see a manager" stale-shift screen
  //   - block double clock-ins (handleClockIn refuses if this is set)
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  // Synchronous tap-guard. Set to true the instant ANY clock button is
  // tapped, cleared only when the network round-trip finishes (or the
  // session resets). Prevents the duplicate-entry bug where rapid taps
  // start two simultaneous create requests before the openEntry check
  // can update state. Pure-React state update is synchronous enough for
  // this — the second tap sees `processing === true` and bails.
  const [processing, setProcessing] = useState(false);

  const employees = useEmployees();
  const { timeEntries, refresh: refreshTimeEntries } = useTimeEntries();
  const { announcements } = useAnnouncements();
  const { announcements: anniversaryAnnouncements } = useAnniversaries();
  // Anniversaries first so they're the headline message when someone
  // walks up to the kiosk. Regular announcements cycle after them.
  const tickerAnnouncements = [...anniversaryAnnouncements, ...announcements];

  const resetToIdle = useCallback(() => {
    setView('idle');
    setSelectedEmployee(null);
    setOpenEntry(null);
    setProcessing(false);
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

  const handlePinSuccess = async () => {
    if (!selectedEmployee) return;
    touch();
    // Pull the employee's most recent open entry — across ALL dates, not
    // just today. This is what lets us catch a multi-day forgotten shift
    // before it can do damage.
    const existing = await fetchOpenEntryForEmployee(selectedEmployee.id);
    setOpenEntry(existing);

    if (existing) {
      const hoursAgo =
        (Date.now() - new Date(existing.clockIn).getTime()) / 3_600_000;
      if (hoursAgo >= STALE_SHIFT_HOURS) {
        setView('stale-shift');
        return;
      }
    }
    setView('actions');
  };

  const handleClockIn = async () => {
    if (!selectedEmployee) return;
    if (processing) return; // tap-guard: a previous tap is still in flight
    setProcessing(true);
    try {
      // Double-check: refuse if there's an open entry (race condition between
      // PIN success and tap, or a stale openEntry we missed).
      const existing =
        openEntry ?? (await fetchOpenEntryForEmployee(selectedEmployee.id));
      if (existing) {
        toast.error(
          `${selectedEmployee.firstName}, you're already clocked in. Tap Clock Out to end this shift first.`,
        );
        resetToIdle();
        return;
      }
      const created = await createTimeEntry(
        selectedEmployee.id,
        selectedEmployee.department,
      );
      if (created) setOpenEntry(created);
      await refreshTimeEntries();
      // Stay on the actions screen briefly so the user sees the new
      // status, then reset. The tap-guard stays on until reset so a
      // panicked re-tap during the 2-second pause does nothing.
      setTimeout(resetToIdle, 2000);
    } catch (err) {
      console.error('[kiosk] handleClockIn failed', err);
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedEmployee || !openEntry) return;
    if (processing) return;
    setProcessing(true);
    try {
      await clockOutTimeEntry(openEntry.id);
      setOpenEntry(null);
      await refreshTimeEntries();
      setTimeout(resetToIdle, 2000);
    } catch (err) {
      console.error('[kiosk] handleClockOut failed', err);
      setProcessing(false);
    }
  };

  const handleStartBreak = async (type: 'break' | 'lunch') => {
    if (!selectedEmployee || !openEntry) return;
    if (processing) return;
    setProcessing(true);
    try {
      await startBreak(openEntry.id, type);
      await refreshTimeEntries();
      setTimeout(resetToIdle, 2000);
    } catch (err) {
      console.error('[kiosk] handleStartBreak failed', err);
      setProcessing(false);
    }
  };

  const handleEndBreak = async () => {
    if (!selectedEmployee || !openEntry) return;
    if (processing) return;
    setProcessing(true);
    try {
      const openBreak = openEntry.breaks.find((b) => !b.endTime);
      if (openBreak) {
        await endBreak(openBreak.id);
        await refreshTimeEntries();
      }
      setTimeout(resetToIdle, 2000);
    } catch (err) {
      console.error('[kiosk] handleEndBreak failed', err);
      setProcessing(false);
    }
  };

  const activeEmployees = employees.filter((e) => e.isActive);
  // Compute status from the openEntry we fetched on PIN success — this is
  // more accurate than getEmployeeStatus(timeEntries) which only sees
  // today's entries. If openEntry is null they're clocked-out.
  const currentStatus = (() => {
    if (!openEntry) return 'clocked-out' as const;
    const activeBreak = openEntry.breaks.find((b) => !b.endTime);
    if (activeBreak)
      return activeBreak.type === 'lunch'
        ? ('on-lunch' as const)
        : ('on-break' as const);
    return 'clocked-in' as const;
  })();

  const kioskStatuses = activeEmployees.map((emp) => ({
    initials: emp.initials,
    firstName: emp.firstName,
    role: emp.role,
    department: emp.department,
    status: getEmployeeStatus(emp.id, timeEntries),
    breakReturnTime: getActiveBreakReturn(emp.id, timeEntries),
    breakStartTime: getActiveBreakStart(emp.id, timeEntries),
  }));

  return (
    <div className="min-h-screen kiosk-bg flex flex-col" onClick={touch}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-kiosk-muted">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-kiosk-muted/30 transition-colors"
          aria-label="Go to home"
        >
          <CompanyLogo size="md" />
          <div>
            <h1 className="text-kiosk-foreground font-semibold text-lg">{company.name}</h1>
            <p className="text-kiosk-muted-foreground text-xs">Workforce Dashboard</p>
          </div>
        </Link>
        <KioskClock />
      </div>

      {/* Announcements (anniversaries shown first if any today) */}
      <KioskAnnouncementsBanner announcements={tickerAnnouncements} />

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
              processing={processing}
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
              onStartBreak={handleStartBreak}
              onEndBreak={handleEndBreak}
              onCancel={resetToIdle}
            />
          )}
          {view === 'stale-shift' && selectedEmployee && openEntry && (
            <KioskStaleShiftWarning
              employee={selectedEmployee}
              openEntry={openEntry}
              onAcknowledge={resetToIdle}
            />
          )}
        </div>

        {/* Right: Staff status */}
        <div className="w-80 flex flex-col gap-4 overflow-hidden">
          <KioskStaffBoard statuses={kioskStatuses} />
        </div>
      </div>
    </div>
  );
};

export default KioskPage;
