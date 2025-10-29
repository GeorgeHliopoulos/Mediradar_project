import React, { useCallback, useMemo, useState } from 'react';
import { supabaseClient } from '../firebase.js';

const AUDIENCES = {
  users: {
    id: 'users',
    label: 'Για Χρήστες',
    subtitle: 'Πλοηγηθείτε εύκολα σε φαρμακεία, φάρμακα και υπηρεσίες υγείας.',
    metadata: { audience: 'consumer' }
  },
  pharmacies: {
    id: 'pharmacies',
    label: 'Για Φαρμακοποιούς',
    subtitle: 'Διαχειριστείτε τη συνδρομή σας και συνδεθείτε με νέους πελάτες.',
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
  success: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30',
  error: 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/30',
  info: 'bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/30'
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

  const supabase = supabaseClient;
  const supabaseUnavailable = !supabase;

  const activeConfig = useMemo(() => AUDIENCES[activeAudience], [activeAudience]);
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
        message: 'Παρακαλώ εισάγετε ένα έγκυρο email.',
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
        message: 'Email στάλθηκε! Ελέγξτε τα εισερχόμενά σας.',
        tone: 'success'
      });
    } catch (err) {
      const fallback = 'Κάτι πήγε στραβά. Προσπαθήστε ξανά.';
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
        updateForm(audience, {
          message: 'Μεταφορά στη Google…',
          tone: 'info'
        });
        window.location.assign(data.url);
      }
    } catch (err) {
      const fallback = 'Η σύνδεση με Google απέτυχε. Προσπαθήστε ξανά.';
      updateForm(audience, {
        message: err?.message || fallback,
        tone: 'error'
      });
    } finally {
      updateForm(audience, { loading: null });
    }
  }, [supabase, updateForm]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-5xl">
        <div className="mx-auto flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(15,23,42,0.65)] md:flex-row md:p-10">
          <div className="md:w-2/5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-2">
                <img
                  src="/icons/icon-192.png"
                  alt="Λογότυπο MediRadar"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">MediRadar</h1>
                <p className="text-sm text-slate-300">Το Progressive Web App για αξιόπιστη πληροφόρηση υγείας.</p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-300">
              Συνδεθείτε με ένα κλικ. Οι χρήστες λαμβάνουν προσαρμοσμένες ενημερώσεις για φάρμακα και διαθεσιμότητα,
              ενώ οι φαρμακοποιοί διαχειρίζονται τα ραντεβού και την προβολή τους στην κοινότητα.
            </p>
            <div className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
              <p className="font-medium text-white/90">Τι προσφέρει το MediRadar;</p>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-emerald-400" aria-hidden="true"></span>
                  <span>Γρήγορη είσοδος με email ή Google.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-sky-400" aria-hidden="true"></span>
                  <span>Ασφαλής διαχείριση λογαριασμού μέσα από Supabase.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-violet-400" aria-hidden="true"></span>
                  <span>Σχεδιασμένο για mobile &amp; desktop εμπειρία.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex-1 rounded-3xl border border-white/10 bg-slate-950/40 p-6 shadow-inner">
            <nav className="flex gap-2 rounded-full bg-white/10 p-1">
              {Object.values(AUDIENCES).map(({ id, label }) => {
                const isActive = id === activeAudience;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveAudience(id)}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-lg'
                        : 'text-slate-200 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 space-y-6">
              <div>
                <p className="text-sm font-medium text-slate-200">{activeConfig.subtitle}</p>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor={`email-${activeAudience}`} className="text-sm font-medium text-slate-100">
                    Email
                  </label>
                  <input
                    id={`email-${activeAudience}`}
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={activeFormState.email}
                    onChange={(event) => handleEmailChange(activeAudience, event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-emerald-400 focus:bg-slate-950/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  />
                </div>

                {activeFormState.message && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                      toneClasses[activeFormState.tone] || 'bg-white/10 text-slate-200'
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
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={activeFormState.loading !== null || supabaseUnavailable}
                  >
                    {activeFormState.loading === 'email' && <Spinner />}
                    <span>Σύνδεση / Εγγραφή με Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGoogle(activeAudience)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-slate-900/40 transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={activeFormState.loading !== null || supabaseUnavailable}
                  >
                    {activeFormState.loading === 'google' && <Spinner className="h-4 w-4 text-white" />}
                    <span>Σύνδεση με Google</span>
                  </button>
                </div>
              </form>

              <p className="text-xs text-slate-400">
                Η πρόσβαση είναι δωρεάν για χρήστες. Οι φαρμακοποιοί χρειάζονται ενεργή συνδρομή.
              </p>

              {supabaseUnavailable && (
                <p className="text-xs font-medium text-rose-300">
                  ⚠️ Παρακαλούμε συμπληρώστε τα SUPABASE_URL και SUPABASE_ANON_KEY για να ενεργοποιηθεί η είσοδος.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
