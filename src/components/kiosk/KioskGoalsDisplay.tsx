import { DepartmentGoal } from '@/types/workforce';

interface Props {
  goals: DepartmentGoal[];
}

export const KioskGoalsDisplay = ({ goals }: Props) => {
  return (
    <div className="kiosk-card rounded-xl border border-kiosk-muted overflow-hidden">
      <div className="px-4 py-3 border-b border-kiosk-muted">
        <h3 className="text-sm font-semibold text-kiosk-foreground">Today's Goals</h3>
      </div>
      <div className="p-3 space-y-3">
        {goals.map(goal => {
          const adjustmentsTotal = goal.manualAdjustments.reduce((sum, a) => sum + a.amount, 0);
          const total = goal.shopifySales + adjustmentsTotal;
          const pct = Math.min((total / goal.target) * 100, 100);

          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-medium text-kiosk-foreground">{goal.department}</span>
                <span className="text-xs text-kiosk-muted-foreground tabular-nums">
                  ${total.toLocaleString()} / ${goal.target.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-kiosk-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 100 ? 'bg-kiosk-success' : pct >= 75 ? 'bg-accent' : 'bg-status-on-lunch'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
