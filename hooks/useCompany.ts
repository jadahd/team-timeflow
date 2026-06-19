import { useSyncExternalStore } from 'react';
import { companyStore } from '@/data/companyStore';
import { Company } from '@/types/company';

/**
 * Subscribes to the Company config and re-renders when it changes.
 * Returns the live config plus an `update` setter that persists to
 * Supabase (and to localStorage as a cache).
 *
 * `update` and `reset` are async — fire-and-forget is fine; the UI
 * updates optimistically on local state before the network call returns.
 */
export function useCompany(): {
  company: Company;
  update: (patch: Partial<Company>) => Promise<void>;
  reset: () => Promise<void>;
} {
  const company = useSyncExternalStore(
    companyStore.subscribe,
    companyStore.getSnapshot,
    companyStore.getSnapshot,
  );
  return {
    company,
    update: companyStore.update,
    reset: companyStore.reset,
  };
}
