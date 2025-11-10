// Plain script (NOT a module). Safe to include on any page.
// If a user signs in, redirect them to /pharmacy.html.

(function () {
  if (!window.supabase) return;
  try {
    const env = window.ENV || {};
    const supabaseUrl = env.SUPABASE_URL || window.SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;
    const existingClient = window.mediradarSupabase || null;
    const sb = existingClient || supabase.createClient(
      supabaseUrl,
      supabaseAnonKey,
      { auth: { persistSession: true } }
    );
    if (!existingClient) {
      window.mediradarSupabase = sb;
    }
    sb.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const target = window.location.origin + '/pharmacy.html';
        if (window.location.href !== target) window.location.href = target;
      }
    });
  } catch (e) {
    console.warn('afterLoginRedirect init error:', e);
  }
})();
