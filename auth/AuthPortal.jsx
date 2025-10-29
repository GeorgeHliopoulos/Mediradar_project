import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient } from '../firebase.js';

const TABS = {
  users: {
    id: 'users',
    label: 'Για Χρήστες',
    note: null
  },
  pharmacies: {
    id: 'pharmacies',
    label: 'Για Φαρμακεία',
    note: 'Η πρόσβαση απαιτεί ενεργή συνδρομή MediRadar Pro.'
  }
};

const initialFormState = {
  email: '',
  message: '',
  tone: null,
  loading: false
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
  const supabase = supabaseClient;
  const supabaseUnavailable = !supabase;
  const [activeTab, setActiveTab] = useState(TABS.users.id);
  const [forms, setForms] = useState({
    [TABS.users.id]: { ...initialFormState },
    [TABS.pharmacies.id]: { ...initialFormState }
  });
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setUser(data?.user ?? null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  const activeForm = forms[activeTab];

  const updateForm = useCallback((tabId, updates) => {
    setForms(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        ...updates
      }
    }));
  }, []);

  const handleEmailChange = useCallback(
    (tabId, value) => {
      updateForm(tabId, { email: value });
    },
    [updateForm]
  );

  const setMessage = useCallback(
    (tabId, message, tone) => {
      updateForm(tabId, { message, tone });
    },
    [updateForm]
  );

  const handleMagicLink = useCallback(
    async event => {
      event.preventDefault();
      const email = activeForm.email.trim();

      if (!email) {
        setMessage(activeTab, 'Παρακαλούμε εισάγετε ένα έγκυρο email.', 'error');
        return;
      }

      if (!supabase) {
        setMessage(activeTab, 'Αδυναμία σύνδεσης με Supabase. Ελέγξτε τις ρυθμίσεις σας.', 'error');
        return;
      }

      updateForm(activeTab, { loading: true, message: '', tone: null });

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: 'https://mediradar.gr/' }
        });

        if (error) {
          throw error;
        }

        setMessage(activeTab, 'Magic link στάλθηκε στο email σας!', 'success');
      } catch (err) {
        setMessage(
          activeTab,
          err?.message || 'Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά.',
          'error'
        );
      } finally {
        updateForm(activeTab, { loading: false });
      }
    },
    [activeForm.email, activeTab, setMessage, supabase, updateForm]
  );

  const handleGoogle = useCallback(
    async tabId => {
      if (!supabase) {
        setMessage(tabId, 'Αδυναμία σύνδεσης με Supabase. Ελέγξτε τις ρυθμίσεις σας.', 'error');
        return;
      }

      updateForm(tabId, { loading: true, message: '', tone: null });

      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'https://mediradar.gr/' }
        });

        if (error) {
          throw error;
        }

        if (data?.url) {
          window.location.assign(data.url);
        }
      } catch (err) {
        setMessage(
          tabId,
          err?.message || 'Η σύνδεση με Google απέτυχε. Προσπαθήστε ξανά.',
          'error'
        );
      } finally {
        updateForm(tabId, { loading: false });
      }
    },
    [setMessage, supabase, updateForm]
  );

  const handleLogout = useCallback(async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  }, [supabase]);

  const googleIcon = useMemo(
    () => (
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
    ),
    []
  );

  const toneClasses = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    error: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
  };

  const initials = user?.email?.[0]?.toUpperCase() ?? '';

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        {user && (
          <div className="mb-6 w-full rounded-2xl bg-white/80 p-4 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-lg font-semibold text-white">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Καλωσήρθες,</p>
                  <p className="text-base font-semibold text-slate-900">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {!user && (
          <div className="w-full rounded-3xl bg-white/80 p-8 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-sm sm:p-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <img
                src="/icons/icon-192.png"
                alt="MediRadar logo"
                className="h-16 w-16 rounded-2xl"
              />
              <h1 className="mt-4 text-2xl font-semibold text-slate-900 sm:text-3xl">MediRadar</h1>
              <p className="mt-2 text-sm text-slate-500">Σύνδεση στην πλατφόρμα MediRadar</p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-medium">
              {Object.values(TABS).map(tab => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-sky-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <form className="space-y-5" onSubmit={handleMagicLink}>
              <div className="space-y-2">
                <label
                  htmlFor={`email-${activeTab}`}
                  className="text-sm font-semibold text-slate-700"
                >
                  Email
                </label>
                <input
                  id={`email-${activeTab}`}
                  type="email"
                  autoComplete="email"
                  required
                  value={activeForm.email}
                  onChange={event => handleEmailChange(activeTab, event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              {activeForm.message && (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                    toneClasses[activeForm.tone] || 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
                  }`}
                  role={activeForm.tone === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {activeForm.message}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={activeForm.loading || supabaseUnavailable}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00c6ff] to-[#0072ff] px-4 py-3 text-base font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-[#02d4ff] hover:to-[#0b7dff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {activeForm.loading && <Spinner />}
                  <span>Σύνδεση / Εγγραφή με Email</span>
                </button>

                <button
                  type="button"
                  disabled={activeForm.loading || supabaseUnavailable}
                  onClick={() => handleGoogle(activeTab)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {activeForm.loading ? (
                    <Spinner className="h-4 w-4 text-slate-600" />
                  ) : (
                    googleIcon
                  )}
                  <span>Σύνδεση με Google</span>
                </button>
              </div>

              <p className="text-xs text-slate-500">Τα δεδομένα σας προστατεύονται από το MediRadar Cloud.</p>
            </form>

            {TABS[activeTab].note && (
              <p className="mt-4 text-xs font-medium text-slate-600">{TABS[activeTab].note}</p>
            )}

            <p className="mt-6 text-xs text-slate-500">
              Η πρόσβαση είναι δωρεάν για χρήστες. Οι φαρμακοποιοί χρειάζονται ενεργή συνδρομή.
            </p>

            {supabaseUnavailable && (
              <p className="mt-2 text-xs font-semibold text-rose-600">
                Παρακαλούμε ορίστε SUPABASE_URL και SUPABASE_ANON_KEY για να ενεργοποιηθεί η είσοδος.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
