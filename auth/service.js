import {
  supabaseClient,
  firebaseAuth,
  googleProvider,
  signInWithPopup
} from '../firebase.js';

const STORAGE_KEY = 'mr:bookingAuthSession';
const subscribers = new Set();

let currentSession = loadStoredSession();

if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data?.session) {
      setSessionInternal(normalizeSupabaseSession(data.session), false);
    }
  }).catch(() => undefined);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) {
      setSessionInternal(normalizeSupabaseSession(session));
    } else {
      clearSession();
    }
  });
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[auth] Failed to parse stored session', err);
    return null;
  }
}

function persistSession(session) {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[auth] Failed to persist session', err);
  }
}

function notify() {
  subscribers.forEach(cb => {
    try { cb(currentSession); } catch { /* noop */ }
  });
}

function setSessionInternal(session, notifySubs = true) {
  currentSession = session;
  persistSession(session);
  if (notifySubs) notify();
}

function ensureSupabase(message) {
  if (!supabaseClient) {
    throw new Error(message || 'Supabase client is not configured');
  }
}

function normalizeSupabaseSession(session, meta = {}) {
  if (!session) return null;
  const expiresAt = session.expires_at
    ? session.expires_at * 1000
    : (session.expires_in ? Date.now() + session.expires_in * 1000 : null);
  return {
    type: 'supabase',
    provider: session.user?.app_metadata?.provider || meta.provider || 'supabase',
    access_token: session.access_token,
    refresh_token: session.refresh_token || null,
    expires_at: expiresAt,
    user: session.user || null,
    metadata: meta,
    raw: session
  };
}

function normalizeFirebaseSession(result, provider) {
  if (!result) return null;
  const credential = result.credential || null;
  return {
    type: 'firebase',
    provider,
    access_token: credential?.accessToken || null,
    id_token: typeof result.user?.getIdToken === 'function' ? undefined : null,
    user: result.user ? {
      uid: result.user.uid,
      email: result.user.email || null,
      phone: result.user.phoneNumber || null,
      name: result.user.displayName || null,
      photoURL: result.user.photoURL || null
    } : null,
    metadata: {},
    raw: null
  };
}

async function enrichFirebaseSession(result, provider) {
  const session = normalizeFirebaseSession(result, provider);
  if (result?.user && typeof result.user.getIdToken === 'function') {
    session.id_token = await result.user.getIdToken(true);
  }
  return session;
}

export const bookingAuthContext = {
  getSession: () => currentSession,
  setSession(session) {
    setSessionInternal(session || null);
  },
  clearSession,
  subscribe(callback) {
    if (typeof callback !== 'function') return () => undefined;
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }
};

export function clearSession() {
  setSessionInternal(null);
}

export async function signIn({ email, password }) {
  ensureSupabase('Supabase sign-in is not configured');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message || 'Unable to sign in');
  if (data?.session) {
    setSessionInternal(normalizeSupabaseSession(data.session, { provider: 'password' }));
  }
  return data;
}

export async function signUp({ email, password, metadata = {} }) {
  ensureSupabase('Supabase sign-up is not configured');
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: metadata, emailRedirectTo: window.location.origin }
  });
  if (error) throw new Error(error.message || 'Unable to sign up');
  if (data?.session) {
    setSessionInternal(normalizeSupabaseSession(data.session, { provider: 'password' }));
  }
  return data;
}

export async function signInWithProvider(providerName) {
  const provider = (providerName || '').toLowerCase();
  if (provider === 'google' && firebaseAuth && googleProvider && signInWithPopup) {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const session = await enrichFirebaseSession(result, provider);
    setSessionInternal(session);
    return { session, user: session.user };
  }

  ensureSupabase('Supabase OAuth is not configured');
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: { skipBrowserRedirect: true }
  });
  if (error) throw new Error(error.message || `Unable to sign in with ${providerName}`);
  if (data?.session) {
    const session = normalizeSupabaseSession(data.session, { provider });
    setSessionInternal(session);
    return { session, user: session.user };
  }
  if (data?.url) {
    window.location.assign(data.url);
    return { url: data.url };
  }
  return data;
}

export async function sendSmsOtp(phone) {
  ensureSupabase('SMS OTP requires Supabase configuration');
  const formatted = phone.startsWith('+') ? phone : `+30${phone.replace(/^0+/, '')}`;
  const { data, error } = await supabaseClient.auth.signInWithOtp({
    phone: formatted,
    options: { channel: 'sms', shouldCreateUser: true }
  });
  if (error) throw new Error(error.message || 'Failed to send SMS');
  return data;
}

export async function verifyOtp({ phone, token }) {
  ensureSupabase('OTP verification requires Supabase');
  const formatted = phone.startsWith('+') ? phone : `+30${phone.replace(/^0+/, '')}`;
  const { data, error } = await supabaseClient.auth.verifyOtp({
    phone: formatted,
    token,
    type: 'sms'
  });
  if (error) throw new Error(error.message || 'Invalid code');
  if (data?.session) {
    setSessionInternal(normalizeSupabaseSession(data.session, { provider: 'sms', phone: formatted }));
  }
  return data;
}

export async function sendMagicLink({ email, mode = 'login' }) {
  ensureSupabase('Magic links require Supabase configuration');
  const shouldCreateUser = mode !== 'login';
  const { data, error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser,
      data: { flow: mode }
    }
  });
  if (error) throw new Error(error.message || 'Unable to send magic link');
  return data;
}

export async function refreshSession() {
  ensureSupabase('Supabase session unavailable');
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw new Error(error.message || 'Unable to read session');
  if (data?.session) {
    const session = normalizeSupabaseSession(data.session);
    setSessionInternal(session);
    return session;
  }
  return null;
}
