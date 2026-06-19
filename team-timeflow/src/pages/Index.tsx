import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Monitor, Settings, Clock, Users, TrendingUp } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
          <span className="text-accent-foreground text-2xl font-bold">S</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">SACS Supply & Outfitters</h1>
        <p className="text-muted-foreground mb-8">Workforce Management System</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm mx-auto">
          <button
            onClick={() => navigate('/kiosk')}
            className="flex flex-col items-center gap-3 p-6 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95"
          >
            <Monitor className="w-8 h-8" />
            <span className="font-semibold">Open Kiosk</span>
            <span className="text-xs opacity-70">Clock in/out · Staff board</span>
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border text-foreground hover:border-accent transition-all active:scale-95"
          >
            <Settings className="w-8 h-8 text-accent" />
            <span className="font-semibold">Admin Dashboard</span>
            <span className="text-xs text-muted-foreground">Manage · Reports · Payroll</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 mt-10 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time Tracking</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Workforce</span>
          <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Goals</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
