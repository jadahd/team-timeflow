// Supabase client for Team TimeFlow.
//
// Configuration comes from environment variables prefixed with `VITE_`
// (see .env.example). The publishable key is safe to ship to the browser —
// data access is controlled by Row Level Security policies in Supabase,
// not by hiding the key.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly during dev so missing config is obvious instead of
  // silently breaking queries with a confusing error later.
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env.local and fill in your project values.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '', {
  auth: {
    // We're not using Supabase auth yet — keep the client lightweight.
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** True when Supabase env vars are configured. Useful for falling back
 * to mock data while development is still in progress. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
