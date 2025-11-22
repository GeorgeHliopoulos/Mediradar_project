import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.5/+esm";

const ENV = window.ENV || {};

let supabaseClient = null;

if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
  supabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
} else {
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
}

export { supabaseClient };

export function isSupabaseReady() {
  return !!supabaseClient;
}
