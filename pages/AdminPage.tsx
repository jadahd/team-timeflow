import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminEmployees } from '@/components/admin/AdminEmployees';
import { AdminTimeTracking } from '@/components/admin/AdminTimeTracking';
import { AdminForgottenPunches } from '@/components/admin/AdminForgottenPunches';
import { AdminPayroll } from '@/components/admin/AdminPayroll';
import { AdminPayPeriods } from '@/components/admin/AdminPayPeriods';
import { AdminDashboardOverview } from '@/components/admin/AdminDashboardOverview';
import { AdminAnnouncements } from '@/components/admin/AdminAnnouncements';
import { AdminCompanySettings } from '@/components/admin/AdminCompanySettings';
import { AdminAttendance } from '@/components/admin/AdminAttendance';
import { AdminLoginScreen } from '@/components/admin/AdminLoginScreen';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export type AdminView =
  | 'overview'
  | 'employees'
  | 'attendance'
  | 'time-tracking'
  | 'forgotten-punches'
  | 'payroll'
  | 'pay-periods'
  | 'announcements'
  | 'settings';

/** Views that are gated to the owner tier only. */
const OWNER_ONLY_VIEWS: AdminView[] = ['payroll', 'pay-periods'];

const AdminPage = () => {
  const [view, setView] = useState<AdminView>('overview');
  const { authenticated, isOwner } = useAdminAuth();

  // Gate the entire admin section behind the password.
  if (!authenticated) {
    return <AdminLoginScreen />;
  }

  // Force manager off owner-only views if they somehow land there
  // (e.g. saved url, browser back).
  const activeView: AdminView =
    OWNER_ONLY_VIEWS.includes(view) && !isOwner ? 'overview' : view;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar currentView={view} onNavigate={setView} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {activeView === 'overview' && <AdminDashboardOverview onNavigate={setView} />}
          {activeView === 'employees' && <AdminEmployees />}
          {activeView === 'attendance' && <AdminAttendance />}
          {activeView === 'time-tracking' && <AdminTimeTracking />}
          {activeView === 'forgotten-punches' && <AdminForgottenPunches />}
          {activeView === 'payroll' && isOwner && <AdminPayroll />}
          {activeView === 'pay-periods' && isOwner && <AdminPayPeriods />}
          {activeView === 'announcements' && <AdminAnnouncements />}
          {activeView === 'settings' && <AdminCompanySettings />}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
