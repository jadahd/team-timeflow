import { useCallback, useSyncExternalStore } from 'react';

/**
 * Two-tier password gate for /admin.
 *
 *   - "owner" tier (e.g. Mrs. Gay) sees everything including pay rates and payroll.
 *   - "manager" tier (e.g. Kayla) sees employees, attendance, time tracking,
 *      announcements, and company settings — but not dollar amounts.
 *
 * State is held in a singleton (so all consumers of useAdminAuth see the
 * same value), persisted to localStorage. When one component calls logout,
 * every component that uses this hook re-renders with the new state.
 *
 * NOT a real per-user auth (passwords ship in the client bundle). Real
 * Supabase Auth is on the roadmap.
 */
export type AuthTier = 'owner' | 'manager';

const STORAGE_KEY = 'team-timeflow.admin-auth';

function loadInitialTier(): AuthTier | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'owner' || v === 'manager') return v;
    // Backwards-compat: older sessions stored the literal "authenticated".
    if (v === 'authenticated') return 'manager';
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Singleton store — shared across every useAdminAuth() call
// ============================================================
let currentTier: AuthTier | null = loadInitialTier();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persist(next: AuthTier | null) {
  try {
    if (next === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore quota / private-mode errors
  }
}

const adminAuthStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): AuthTier | null {
    return currentTier;
  },
  setTier(next: AuthTier | null) {
    if (currentTier === next) return;
    currentTier = next;
    persist(next);
    notify();
  },
};

// Cross-tab sync: if the user logs out in another tab, reflect that here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    const v = e.newValue;
    let next: AuthTier | null = null;
    if (v === 'owner' || v === 'manager') next = v;
    else if (v === 'authenticated') next = 'manager';
    if (currentTier !== next) {
      currentTier = next;
      notify();
    }
  });
}

// ============================================================
// React hook
// ============================================================
export function useAdminAuth() {
  const tier = useSyncExternalStore(
    adminAuthStore.subscribe,
    adminAuthStore.getSnapshot,
    adminAuthStore.getSnapshot,
  );

  const login = useCallback((attempt: string): boolean => {
    const ownerPwd = import.meta.env.VITE_OWNER_PASSWORD;
    const managerPwd = import.meta.env.VITE_ADMIN_PASSWORD;

    if (!ownerPwd && !managerPwd) {
      // eslint-disable-next-line no-console
      console.error(
        '[useAdminAuth] No passwords configured. Set VITE_OWNER_PASSWORD and/or VITE_ADMIN_PASSWORD in .env.local.',
      );
      return false;
    }

    const trimmed = attempt.trim();
    let matched: AuthTier | null = null;
    if (ownerPwd && trimmed === ownerPwd) matched = 'owner';
    else if (managerPwd && trimmed === managerPwd) matched = 'manager';

    if (!matched) return false;
    adminAuthStore.setTier(matched);
    return true;
  }, []);

  const logout = useCallback(() => {
    adminAuthStore.setTier(null);
  }, []);

  return {
    tier,
    authenticated: tier !== null,
    isOwner: tier === 'owner',
    isManager: tier === 'manager',
    login,
    logout,
  };
}
