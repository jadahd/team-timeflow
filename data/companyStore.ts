// Company config store.
//
// Source of truth is Supabase (the `company_settings` table). localStorage
// is a cache so the app shows the previous settings instantly on load —
// then we re-fetch from Supabase in the background and update if anything
// changed.
//
// Falls back to DEFAULT_COMPANY when Supabase isn't configured (e.g. local
// development without env vars) or when the network is unavailable.

import { Company, DEFAULT_COMPANY } from '@/types/company';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchCompanySettings, updateCompanySettings } from '@/lib/db';

const STORAGE_KEY = 'team-timeflow.company';

function loadCached(): Company {
  if (typeof window === 'undefined') return DEFAULT_COMPANY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMPANY;
    const parsed = JSON.parse(raw) as Partial<Company>;
    // Merge with defaults so newly-added fields don't break older caches.
    return { ...DEFAULT_COMPANY, ...parsed };
  } catch {
    return DEFAULT_COMPANY;
  }
}

let current: Company = loadCached();
let hydrated = false;
const listeners = new Set<() => void>();

function persistLocal() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore quota/private-mode errors
  }
}

function setCurrent(next: Company) {
  current = next;
  persistLocal();
  listeners.forEach((l) => l());
}

/** Pull the latest from Supabase. Updates current + cache if different. */
async function hydrateFromSupabase() {
  if (hydrated || !isSupabaseConfigured) return;
  hydrated = true;
  try {
    const remote = await fetchCompanySettings();
    if (remote) setCurrent(remote);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[companyStore] hydrate failed', err);
  }
}

export const companyStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    // Lazy hydrate on first subscribe.
    void hydrateFromSupabase();
    return () => listeners.delete(listener);
  },
  getSnapshot(): Company {
    return current;
  },
  /**
   * Persist a patch. Writes to Supabase (so other devices see it) and
   * updates the local cache + listeners optimistically.
   */
  async update(patch: Partial<Company>) {
    // Optimistic: update local immediately so the UI feels snappy.
    setCurrent({ ...current, ...patch });
    if (isSupabaseConfigured) {
      try {
        const saved = await updateCompanySettings(patch);
        if (saved) setCurrent(saved);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[companyStore] update failed; local change kept', err);
      }
    }
  },
  /** Reset to factory defaults. Writes the defaults to Supabase too. */
  async reset() {
    setCurrent(DEFAULT_COMPANY);
    if (isSupabaseConfigured) {
      try {
        await updateCompanySettings(DEFAULT_COMPANY);
      } catch {
        // ignore
      }
    }
  },
};
