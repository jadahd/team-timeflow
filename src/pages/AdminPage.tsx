import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminEmployees } from '@/components/admin/AdminEmployees';
import { AdminTimeTracking } from '@/components/admin/AdminTimeTracking';
import { AdminPayroll } from '@/components/admin/AdminPayroll';
import { AdminDashboardOverview } from '@/components/admin/AdminDashboardOverview';
import { AdminAnnouncements } from '@/components/admin/AdminAnnouncements';

export type AdminView = 'overview' | 'employees' | 'time-tracking' | 'payroll' | 'announcements';

const AdminPage = () => {
  const [view, setView] = useState<AdminView>('overview');

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar currentView={view} onNavigate={setView} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {view === 'overview' && <AdminDashboardOverview />}
          {view === 'employees' && <AdminEmployees />}
          {view === 'time-tracking' && <AdminTimeTracking />}
          {view === 'payroll' && <AdminPayroll />}
          {view === 'announcements' && <AdminAnnouncements />}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
