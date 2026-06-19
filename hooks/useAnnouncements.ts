import { useEffect, useState, useCallback } from 'react';
import { Announcement } from '@/types/workforce';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchActiveAnnouncements } from '@/lib/db';
import { MOCK_ANNOUNCEMENTS } from '@/data/mockData';

/**
 * Loads active (non-expired) announcements from Supabase, falling back
 * to the mock seed when Supabase isn't configured.
 *
 * Returns the list plus a `refresh` callback to re-fetch after a mutation.
 */
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    isSupabaseConfigured ? [] : MOCK_ANNOUNCEMENTS,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAnnouncements(MOCK_ANNOUNCEMENTS);
      return;
    }
    setLoading(true);
    const rows = await fetchActiveAnnouncements();
    setAnnouncements(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { announcements, loading, refresh };
}
