import { MOCK_TIME_ENTRIES, MOCK_GOALS, getEmployeeStatus } from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

export const AdminDashboardOverview = () => {
  const employees = useEmployees();
  const activeCount = employees.filter(e => {
    const s = getEmployeeStatus(e.id, MOCK_TIME_ENTRIES);
    return s !== 'clocked-out';
  }).length;

  const totalHoursToday = MOCK_TIME_ENTRIES.reduce((sum, entry) => {
    const start = new Date(entry.clockIn).getTime();
    const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
    return sum + (end - start) / 3600000;
  }, 0);

  const otRisk = employees.filter(e => e.payType === 'hourly').length; // simplified

  const totalGoalProgress = MOCK_GOALS.reduce((sum, g) => {
    const adj = g.manualAdjustments.reduce((s, a) => s + a.amount, 0);
    return sum + g.shopifySales + adj;
  }, 0);
  const totalTarget = MOCK_GOALS.reduce((sum, g) => sum + g.target, 0);

  const stats = [
    { label: 'Staff On Duty', value: activeCount, total: employees.length, icon: Users, color: 'text-success' },
    { label: 'Hours Today', value: totalHoursToday.toFixed(1), icon: Clock, color: 'text-info' },
    { label: 'OT Risk', value: `${otRisk}`, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Sales Today', value: `$${totalGoalProgress.toLocaleString()}`, total: `$${totalTarget.toLocaleString()}`, icon: TrendingUp, color: 'text-accent' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    {stat.total && <p className="text-xs text-muted-foreground">of {stat.total}</p>}
                  </div>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Department Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Department Goals — Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MOCK_GOALS.map(goal => {
            const adj = goal.manualAdjustments.reduce((s, a) => s + a.amount, 0);
            const total = goal.shopifySales + adj;
            const pct = Math.min((total / goal.target) * 100, 100);
            return (
              <div key={goal.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{goal.department}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    ${total.toLocaleString()} / ${goal.target.toLocaleString()} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 100 ? 'bg-success' : pct >= 75 ? 'bg-accent' : 'bg-info'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Active Staff */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Active Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {employees.map(emp => {
              const status = getEmployeeStatus(emp.id, MOCK_TIME_ENTRIES);
              const statusColors = {
                'clocked-in': 'bg-success',
                'on-break': 'bg-warning',
                'on-lunch': 'bg-info',
                'clocked-out': 'bg-muted-foreground/30',
              };
              return (
                <div key={emp.id} className="flex items-center gap-3 py-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
                  <span className="text-sm font-medium text-foreground w-8">{emp.initials}</span>
                  <span className="text-sm text-foreground flex-1">{emp.firstName} {emp.lastName}</span>
                  <span className="text-xs text-muted-foreground">{emp.department}</span>
                  <span className="text-xs text-muted-foreground capitalize">{status.replace('-', ' ')}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
