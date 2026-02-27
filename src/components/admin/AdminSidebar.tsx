import { AdminView } from '@/pages/AdminPage';
import { LayoutDashboard, Users, Clock, DollarSign, Megaphone, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const navItems: { view: AdminView; label: string; icon: React.ElementType }[] = [
  { view: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'employees', label: 'Employees', icon: Users },
  { view: 'time-tracking', label: 'Time Tracking', icon: Clock },
  { view: 'payroll', label: 'Payroll Export', icon: DollarSign },
  { view: 'announcements', label: 'Announcements', icon: Megaphone },
];

interface Props {
  currentView: AdminView;
  onNavigate: (view: AdminView) => void;
}

export const AdminSidebar = ({ currentView, onNavigate }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen border-r border-sidebar-border">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold">S</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm text-sidebar-foreground">SACS Supply</h1>
            <p className="text-xs text-sidebar-foreground/60">Admin Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => navigate('/kiosk')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Monitor className="w-4 h-4" />
          Open Kiosk
        </button>
      </div>
    </div>
  );
};
