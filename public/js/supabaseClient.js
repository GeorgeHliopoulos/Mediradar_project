const SUPABASE_GLOBAL_KEY = '__sb';
let initPromise = null;

function ensureSupabaseAvailable() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client can only be used in the browser.');
  }
  if (!window.supabase) {
    throw new Error('Supabase library not loaded.');
  }
}

export async function init() {
  if (window[SUPABASE_GLOBAL_KEY]) {
    return window[SUPABASE_GLOBAL_KEY];
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    ensureSupabaseAvailable();
    const env = window.ENV || {};
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase configuration.');
    }

    const sb = window.supabase.createClient(url, key);
    window[SUPABASE_GLOBAL_KEY] = sb;
    return sb;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

export function client() {
  const sb = window[SUPABASE_GLOBAL_KEY];
  if (!sb) {
    throw new Error('Supabase client not initialized. Call init() first.');
  }
  return sb;
}

export async function requireAuth() {
  const sb = window[SUPABASE_GLOBAL_KEY] || (await init());
  try {
    const { data } = await sb.auth.getSession();
    if (data?.session?.user) {
      return data.session.user;
    }
  } catch (error) {
    console.error('Failed to fetch session', error);
  }

  return new Promise((resolve) => {
    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session?.user) {
        listener.subscription.unsubscribe();
        resolve(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        listener.subscription.unsubscribe();
        resolve(null);
      }
    });

    // Fallback in case no auth event ever fires
    setTimeout(() => {
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
      resolve(null);
    }, 1000 * 60 * 5); // 5 minutes timeout
  });
}
