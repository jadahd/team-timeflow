import { useCallback, useEffect, useState } from 'react';
import { TimeEntry } from '@/types/workforce';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchTimeEntriesForDate } from '@/lib/db';
import { MOCK_TIME_ENTRIES } from '@/data/mockData';

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Loads time entries for the given date (defaults to today) from Supabase,
 * falling back to the seed mock data when Supabase isn't configured.
 *
 * Returns the list plus a `refresh` callback to call after a mutation.
 */
export function useTimeEntries(date: string = todayDateString()) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(
    isSupabaseConfigured ? [] : MOCK_TIME_ENTRIES,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTimeEntries(MOCK_TIME_ENTRIES);
      return;
    }
    setLoading(true);
    const rows = await fetchTimeEntriesForDate(date);
    setTimeEntries(rows);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { timeEntries, loading, refresh };
}
