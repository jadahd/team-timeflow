import { AdminView } from '@/pages/AdminPage';
import {
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  Megaphone,
  Monitor,
  Settings,
  ClipboardCheck,
  AlertTriangle,
  Lock,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from '@/components/CompanyLogo';
import { useCompany } from '@/hooks/useCompany';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useForgottenClockOuts } from '@/hooks/useForgottenClockOuts';

interface NavItem {
  view: AdminView;
  label: string;
  icon: React.ElementType;
  /** When true, only owner tier sees this nav item. */
  ownerOnly?: boolean;
}

const navItems: NavItem[] = [
  { view: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'employees', label: 'Employees', icon: Users },
  { view: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { view: 'time-tracking', label: 'Time Tracking', icon: Clock },
  { view: 'forgotten-punches', label: 'Forgotten Punches', icon: AlertTriangle },
  { view: 'payroll', label: 'Payroll Export', icon: DollarSign, ownerOnly: true },
  { view: 'pay-periods', label: 'Pay Periods', icon: Lock, ownerOnly: true },
  { view: 'announcements', label: 'Announcements', icon: Megaphone },
  { view: 'settings', label: 'Company Settings', icon: Settings },
];

interface Props {
  currentView: AdminView;
  onNavigate: (view: AdminView) => void;
}

export const AdminSidebar = ({ currentView, onNavigate }: Props) => {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { logout, isOwner } = useAdminAuth();
  const { count: forgottenCount } = useForgottenClockOuts();
  const visibleNav = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen border-r border-sidebar-border">
      <div className="p-5 border-b border-sidebar-border">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-sidebar-accent/40 transition-colors text-left"
          aria-label="Go to home"
        >
          <CompanyLogo
            size="sm"
            bgClass="bg-sidebar-primary"
            textClass="text-sidebar-primary-foreground"
          />
          <div>
            <h1 className="font-semibold text-sm text-sidebar-foreground">{company.shortName}</h1>
            <p className="text-xs text-sidebar-foreground/60">
              {isOwner ? 'Owner Dashboard' : 'Manager Dashboard'}
            </p>
          </div>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {visibleNav.map(item => {
          const Icon = item.icon;
          const active = currentView === item.view;
          const showBadge = item.view === 'forgotten-punches' && forgottenCount > 0;
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
              <Icon
                className={`w-4 h-4 ${
                  showBadge ? 'text-warning' : ''
                }`}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {showBadge && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-warning text-warning-foreground text-[10px] font-semibold tabular-nums">
                  {forgottenCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => navigate('/kiosk')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Monitor className="w-4 h-4" />
          Open Kiosk
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </div>
  );
};
