import { useEffect, useState } from 'react';
import { PayPeriod } from '@/types/workforce';
import { fetchPayPeriodForDate } from '@/lib/db';

/**
 * Hook: returns whether the given YYYY-MM-DD falls inside a CLOSED pay
 * period, plus the period itself (for tooltips like "Pay period 'May 1–14'
 * is closed"). Re-runs whenever the date changes.
 *
 * Used by:
 *   - AdminTimeTracking to disable edit/delete on locked dates
 *   - TimeEntryDialog to refuse saves into a locked date
 */
export function usePayPeriodLock(date: string) {
  const [lockingPeriod, setLockingPeriod] = useState<PayPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPayPeriodForDate(date)
      .then((p) => {
        if (cancelled) return;
        // We only care about CLOSED periods — an open one isn't a lock.
        setLockingPeriod(p && p.isClosed ? p : null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLockingPeriod(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return {
    isLocked: Boolean(lockingPeriod),
    lockingPeriod,
    loading,
  };
}
