import { useCallback, useEffect, useState } from 'react';
import { TimeEntry } from '@/types/workforce';
import { fetchForgottenClockOuts } from '@/lib/db';

/**
 * Loads every "forgotten clock-out" — a time_entry whose clock_out is
 * NULL and whose entry_date is before today.
 *
 * Returns the list, loading state, and a refresh callback. The list is
 * the source of truth for:
 *   - the dashboard alert banner ("X forgotten clock-outs")
 *   - the sidebar badge counter
 *   - the Forgotten Punches admin view
 *
 * Today's open shifts (people still actively on the clock) are EXCLUDED.
 */
export function useForgottenClockOuts() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setEntries(await fetchForgottenClockOuts());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, count: entries.length, loading, refresh };
}
