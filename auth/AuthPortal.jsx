import React, { useCallback, useEffect, useState } from 'react';
import { supabaseClient } from '../firebase.js';

const AUDIENCES = {
  users: {
    id: 'users',
    label: 'Για Χρήστες',
    metadata: { audience: 'consumer' }
  },
  pharmacies: {
    id: 'pharmacies',
    label: 'Για Φαρμακοποιούς',
    metadata: { audience: 'pharmacy' }
  }
};

const defaultFormState = Object.freeze({
  email: '',
  message: '',
  tone: null,
  loading: null
});

const toneClasses = {
  success: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  error: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  info: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200'
};

function Spinner({ className = 'h-4 w-4 text-white' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function AuthPortal() {
  const [activeAudience, setActiveAudience] = useState(AUDIENCES.users.id);
  const [forms, setForms] = useState({
    [AUDIENCES.users.id]: { ...defaultFormState },
    [AUDIENCES.pharmacies.id]: { ...defaultFormState }
  });
  const [currentUser, setCurrentUser] = useState(null);
  const supabase = supabaseClient;
  const supabaseUnavailable = !supabase;

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setCurrentUser(data?.user ?? null);
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  const activeFormState = forms[activeAudience];

  const updateForm = useCallback((audience, updates) => {
    setForms(prev => ({
      ...prev,
      [audience]: {
        ...prev[audience],
        ...updates
      }
    }));
  }, []);

  const handleEmailChange = useCallback((audience, value) => {
    updateForm(audience, { email: value });
  }, [updateForm]);

  const handleMagicLink = useCallback(async (event) => {
    event.preventDefault();
    const audience = activeAudience;
    const email = forms[audience].email.trim();

    if (!email) {
      updateForm(audience, {
        message: 'Παρακαλώ εισάγετε ένα έγκυρο email / Please enter a valid email.',
        tone: 'error'
      });
      return;
    }

    if (!supabase) {
      updateForm(audience, {
        message: 'Δεν βρέθηκε σύνδεση με το Supabase. Ελέγξτε τις ρυθμίσεις σας.',
        tone: 'error'
      });
      return;
    }

    updateForm(audience, { loading: 'email', message: '', tone: null });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'https://mediradar.gr/',
          shouldCreateUser: true,
          data: { ...AUDIENCES[audience].metadata }
        }
      });

      if (error) throw error;

      updateForm(audience, {
        message: 'Email στάλθηκε! Ελέγξτε τα εισερχόμενά σας. / Email sent! Check your inbox.',
        tone: 'success'
      });
    } catch (err) {
      const fallback = 'Κάτι πήγε στραβά. Προσπαθήστε ξανά. / Something went wrong. Please try again.';
      updateForm(audience, {
        message: err?.message || fallback,
        tone: 'error'
      });
    } finally {
      updateForm(audience, { loading: null });
    }
  }, [activeAudience, forms, supabase, updateForm]);

  const handleGoogle = useCallback(async (audience) => {
    if (!supabase) {
      updateForm(audience, {
        message: 'Δεν βρέθηκε σύνδεση με το Supabase. Ελέγξτε τις ρυθμίσεις σας.',
        tone: 'error'
      });
      return;
    }

    updateForm(audience, { loading: 'google', message: '', tone: null });

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://mediradar.gr/',
          queryParams: { prompt: 'select_account' }
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      const fallback = 'Η σύνδεση με Google απέτυχε. Προσπαθήστε ξανά. / Google sign-in failed. Try again.';
      updateForm(audience, {
        message: err?.message || fallback,
        tone: 'error'
      });
    } finally {
      updateForm(audience, { loading: null });
    }
  }, [supabase, updateForm]);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const googleIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.8l3 2.3c1.8-1.6 2.8-4 2.8-6.8 0-.7-.1-1.4-.2-2h-8.8z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3l-.8.6-2.4 1.8C4 19.9 7.7 22 12 22c2.7 0 5-.9 6.7-2.4l-3-2.3c-.9.6-2 1-3.7 1-2.8 0-5.1-1.9-6-4.6z"
      />
      <path
        fill="#4A90E2"
        d="M2.1 6.3C1.4 7.7 1 9.3 1 11s.4 3.3 1.1 4.7c0 .1 3.2-2.5 3.2-2.5-.2-.6-.3-1.2-.3-1.9 0-.7.1-1.3.3-1.9L2.1 6.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.5c1.5 0 2.9.5 4 1.5l3-3C16.9 1 14.7 0 12 0 7.7 0 4 2.1 2.1 6.3l3.2 2.4c.9-2.6 3.2-4.5 6.7-4.5z"
      />
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        {currentUser && (
          <div className="mb-6 flex items-center justify-end gap-4 text-sm text-white">
            <div className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">
              {currentUser.email}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Logout
            </button>
          </div>
        )}

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full rounded-3xl bg-white p-8 shadow-2xl shadow-emerald-500/10 ring-1 ring-slate-200/60 sm:p-10">
            <div className="mb-6 flex flex-col items-center gap-4 text-center">
              <img src="/icons/icon-192.png" alt="MediRadar logo" className="h-16 w-16 rounded-2xl" />
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">MediRadar</h1>
                <p className="mt-1 text-sm text-slate-500">Σύνδεση στην πλατφόρμα MediRadar</p>
                {currentUser && (
                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    Καλωσήρθες, {currentUser.email}!
                  </p>
                )}
              </div>
            </div>

            <nav className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-medium">
              {Object.values(AUDIENCES).map(({ id, label }) => {
                const isActive = id === activeAudience;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveAudience(id)}
                    className={`rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      isActive ? 'bg-white text-slate-900 shadow-sm ring-1 ring-emerald-200' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>

            <form onSubmit={handleMagicLink} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor={`email-${activeAudience}`} className="text-sm font-medium text-slate-700">
                  Email / Ηλεκτρονικό Ταχυδρομείο
                </label>
                <input
                  id={`email-${activeAudience}`}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={activeFormState.email}
                  onChange={(event) => handleEmailChange(activeAudience, event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              {activeFormState.message && (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                    toneClasses[activeFormState.tone] || 'bg-slate-100 text-slate-700'
                  }`}
                  role={activeFormState.tone === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {activeFormState.message}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={activeFormState.loading !== null || supabaseUnavailable}
                >
                  {activeFormState.loading === 'email' && <Spinner />}
                  <span>Σύνδεση / Εγγραφή με Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGoogle(activeAudience)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={activeFormState.loading !== null || supabaseUnavailable}
                >
                  {activeFormState.loading === 'google' ? <Spinner className="h-4 w-4 text-slate-600" /> : googleIcon}
                  <span>Σύνδεση με Google</span>
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Τα δεδομένα σας προστατεύονται από το MediRadar Cloud.
              </p>
            </form>

            <p className="mt-6 text-xs text-slate-500">
              Η πρόσβαση είναι δωρεάν για χρήστες. Οι φαρμακοποιοί χρειάζονται ενεργή συνδρομή.
            </p>

            {supabaseUnavailable && (
              <p className="mt-2 text-xs font-medium text-rose-600">
                ⚠️ Παρακαλούμε συμπληρώστε τα SUPABASE_URL και SUPABASE_ANON_KEY για να ενεργοποιηθεί η είσοδος.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
