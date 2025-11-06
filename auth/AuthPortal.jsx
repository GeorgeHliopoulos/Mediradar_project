import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabaseClient } from '../firebase.js';

const TABS = {
  users: {
    id: 'users',
    label: 'Για Χρήστες',
    description: 'Αποκτήστε πρόσβαση στη MediRadar για να αναζητήσετε φαρμακεία, υπηρεσίες και διαθεσιμότητα φαρμάκων.'
  },
  pharmacies: {
    id: 'pharmacies',
    label: 'Για Φαρμακεία',
    description: 'Συνδεθείτε για να διαχειριστείτε το προφίλ σας, τα αιτήματα και τη συνδρομή σας στο MediRadar Pro.'
  }
};

const GOOGLE_LOGO_PATH = (
  <svg viewBox="0 0 533.5 544.3" className="h-5 w-5" aria-hidden="true">
    <path
      d="M533.5 278.4c0-17.4-1.5-34.1-4.4-50.4H272v95.3h147.3c-6.4 34.5-25.9 63.7-55.3 83.2v68h89.2c52.3-48.1 80.3-119 80.3-196.1z"
      fill="#4285f4"
    />
    <path
      d="M272 544.3c74.7 0 137.4-24.7 183.2-67.7l-89.2-68c-24.7 16.6-56.5 26.3-94 26.3-72.3 0-133.7-48.8-155.6-114.5H25.8v71.9C71.6 486.6 165 544.3 272 544.3z"
      fill="#34a853"
    />
    <path
      d="M116.4 320.4c-5.6-16.6-8.8-34.4-8.8-52.4s3.2-35.7 8.8-52.4v-71.9H25.8C9.4 187.8 0 229 0 268s9.4 80.2 25.8 124.3l90.6-71.9z"
      fill="#fbbc05"
    />
    <path
      d="M272 107.7c40.6 0 77 14 105.6 41.4l79-79C409.3 24.3 346.6 0 272 0 165 0 71.6 57.7 25.8 147.8l90.6 71.9C138.3 156.5 199.7 107.7 272 107.7z"
      fill="#ea4335"
    />
  </svg>
);

function Toast({ message, tone }) {
  const toneClasses = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800'
  };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow ${
        toneClasses[tone] || 'border-white/20 bg-white/10 text-white'
      }`}
    >
      <span>{message}</span>
    </div>
  );
}

function Spinner({ className = 'h-4 w-4 text-white' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function AuthPortal() {
  const [activeTab, setActiveTab] = useState(TABS.users.id);
  const [forms, setForms] = useState({
    [TABS.users.id]: { email: '', loading: null },
    [TABS.pharmacies.id]: { email: '', loading: null }
  });
  const [toasts, setToasts] = useState([]);
  const [user, setUser] = useState(null);
  const supabase = supabaseClient;
  const supabaseUnavailable = !supabase;

  const activeTabConfig = useMemo(() => TABS[activeTab], [activeTab]);
  const activeFormState = forms[activeTab];

  useEffect(() => {
    let mounted = true;
    if (!supabase) return undefined;

    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUser(data?.user ?? null);
      }
    };

    fetchUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const addToast = useCallback((message, tone) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const updateForm = useCallback((tabId, updates) => {
    setForms((prev) => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        ...updates
      }
    }));
  }, []);

  const handleEmailInput = useCallback(
    (tabId, value) => {
      updateForm(tabId, { email: value });
    },
    [updateForm]
  );

  const handleMagicLink = useCallback(
    async (event) => {
      event.preventDefault();
      const tabId = activeTab;
      const email = forms[tabId].email.trim();

      if (!email) {
        addToast('Παρακαλώ εισάγετε ένα έγκυρο email.', 'error');
        return;
      }

      if (!supabase) {
        addToast('Δεν βρέθηκε σύνδεση με το Supabase. Ελέγξτε τις ρυθμίσεις σας.', 'error');
        return;
      }

      updateForm(tabId, { loading: 'email' });
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: 'https://mediradar.gr/' }
        });

        if (error) throw error;
        addToast('Magic link στάλθηκε στο email σας!', 'success');
        updateForm(tabId, { email: '' });
      } catch (err) {
        addToast(err?.message || 'Κάτι πήγε στραβά. Προσπαθήστε ξανά.', 'error');
      } finally {
        updateForm(tabId, { loading: null });
      }
    },
    [activeTab, addToast, forms, supabase, updateForm]
  );

  const handleGoogleLogin = useCallback(
    async (tabId) => {
      if (!supabase) {
        addToast('Δεν βρέθηκε σύνδεση με το Supabase. Ελέγξτε τις ρυθμίσεις σας.', 'error');
        return;
      }

      updateForm(tabId, { loading: 'google' });
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'https://mediradar.gr/' }
        });

        if (error) throw error;
        if (data?.url) {
          window.location.assign(data.url);
        }
      } catch (err) {
        addToast(err?.message || 'Η σύνδεση με Google απέτυχε. Προσπαθήστε ξανά.', 'error');
      } finally {
        updateForm(tabId, { loading: null });
      }
    },
    [addToast, supabase, updateForm]
  );

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    addToast('Αποσυνδεθήκατε με επιτυχία.', 'success');
  }, [addToast, supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00c6ff] to-[#0072ff] px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mx-auto w-full rounded-3xl border border-white/40 bg-white/20 p-8 shadow-[0_40px_120px_-25px_rgba(14,88,174,0.55)] backdrop-blur-3xl sm:p-10 lg:p-12"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div className="flex flex-col gap-6 text-center lg:text-left">
              <div className="mx-auto h-20 w-20 overflow-hidden rounded-3xl border border-white/50 bg-white/30 p-3 shadow-inner lg:mx-0">
                <img src="/icons/icon-192.png" alt="Λογότυπο MediRadar" className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Σύνδεση στην πλατφόρμα MediRadar
                </h1>
                <p className="mt-3 text-base text-slate-700">
                  Επιλέξτε το κατάλληλο προφίλ για να συνεχίσετε με email ή λογαριασμό Google.
                </p>
              </div>
              <dl className="space-y-3 text-sm text-slate-700/80">
                <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur">
                  <dt className="font-semibold text-slate-900">Για Χρήστες</dt>
                  <dd>Άμεση πρόσβαση σε ενημερωμένες πληροφορίες φαρμακείων και υπηρεσιών υγείας.</dd>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur">
                  <dt className="font-semibold text-slate-900">Για Φαρμακεία</dt>
                  <dd>Διαχειριστείτε το προφίλ σας, τις κρατήσεις και τις ανάγκες των πελατών σας στο MediRadar Pro.</dd>
                </div>
              </dl>
            </div>

            <div className="lg:pl-6">
              {toasts.length > 0 && (
                <div className="space-y-3">
                  {toasts.map((toast) => (
                    <Toast key={toast.id} tone={toast.tone} message={toast.message} />
                  ))}
                </div>
              )}

              {user ? (
                <div className="mt-8 rounded-3xl border border-white/60 bg-white/60 p-8 text-center shadow-inner backdrop-blur">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-semibold text-emerald-700">
                    {user.email?.charAt(0)?.toUpperCase() || 'Μ'}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900">Καλωσήρθες, {user.email}</h2>
                  <p className="mt-2 text-sm text-slate-700">
                    Είστε πλέον συνδεδεμένοι. Μπορείτε να κλείσετε αυτό το παράθυρο ή να συνεχίσετε στην εφαρμογή MediRadar.
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    Αποσύνδεση
                  </button>
                </div>
              ) : (
                <div className="mt-8 lg:mt-0">
                  <nav className="flex gap-2 rounded-full border border-white/60 bg-white/50 p-1 backdrop-blur">
                    {Object.values(TABS).map((tab) => {
                      const isActive = tab.id === activeTab;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                            isActive ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="mt-8 rounded-3xl border border-white/60 bg-white/60 p-8 shadow-inner backdrop-blur">
                    <p className="text-sm text-slate-700">{activeTabConfig.description}</p>

                    <form onSubmit={handleMagicLink} className="mt-6 space-y-5">
                      <div className="space-y-2 text-left">
                        <label htmlFor={`email-${activeTab}`} className="text-sm font-medium text-slate-800">
                          Email
                        </label>
                        <input
                          id={`email-${activeTab}`}
                          type="email"
                          required
                          autoComplete="email"
                          value={activeFormState.email}
                          onChange={(event) => handleEmailInput(activeTab, event.target.value)}
                          placeholder="name@example.com"
                          className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!!activeFormState.loading || supabaseUnavailable}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {activeFormState.loading === 'email' ? <Spinner /> : null}
                        <span>Συνέχεια με Magic Link (Email)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGoogleLogin(activeTab)}
                        disabled={!!activeFormState.loading || supabaseUnavailable}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 shadow transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {activeFormState.loading === 'google' ? <Spinner className="h-4 w-4 text-slate-900" /> : GOOGLE_LOGO_PATH}
                        <span>Σύνδεση με Google</span>
                      </button>
                    </form>

                    {supabaseUnavailable && (
                      <p className="mt-4 text-center text-xs font-medium text-rose-500">
                        ⚠️ Παρακαλούμε ορίστε τα SUPABASE_URL και SUPABASE_ANON_KEY για να ενεργοποιήσετε την είσοδο.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <p className="mt-8 text-center text-xs text-slate-600">
                Η πρόσβαση είναι δωρεάν για χρήστες. Οι φαρμακοποιοί χρειάζονται ενεργή συνδρομή MediRadar Pro.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
