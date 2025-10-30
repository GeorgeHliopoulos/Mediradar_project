import { supabaseClient } from '../firebase.js';

const REDIRECT_URL = 'https://mediradar.gr/';

const STATUS_MESSAGES = {
  success: '✅ Magic link στάλθηκε στο email σας!',
  missingEmail: 'Παρακαλούμε συμπληρώστε το email σας.',
  genericError: 'Κάτι πήγε στραβά. Προσπαθήστε ξανά.'
};

function qs(root, selector) {
  return root.querySelector(selector);
}

function qsa(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

function setActiveTab(root, tab) {
  const forms = qsa(root, '[data-auth-form]');
  const tabs = qsa(root, '[data-auth-tab]');

  tabs.forEach(btn => {
    const isActive = btn.dataset.authTab === tab;
    btn.classList.toggle('bg-white');
    btn.classList.toggle('text-slate-900', isActive);
    btn.classList.toggle('shadow-lg', isActive);
    btn.classList.toggle('text-slate-600', !isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  forms.forEach(form => {
    const isActive = form.dataset.authForm === tab;
    form.classList.toggle('hidden', !isActive);
  });
}

function setStatus(el, type, message) {
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('text-rose-600', 'text-brand-700');
  if (!message) return;
  if (type === 'success') {
    el.classList.add('text-brand-700');
  } else if (type === 'error') {
    el.classList.add('text-rose-600');
  }
}

function setLoading(form, isLoading) {
  const emailBtn = form.querySelector('[data-auth-email-button]');
  const googleBtn = form.querySelector('[data-auth-google]');
  emailBtn?.classList.toggle('opacity-80', isLoading);
  if (emailBtn) {
    emailBtn.disabled = !!isLoading;
    emailBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
  if (googleBtn) {
    googleBtn.disabled = !!isLoading;
    googleBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
}

async function handleEmailSubmit(event, supabase) {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = form.querySelector('input[type="email"]');
  const statusEl = form.querySelector('[data-auth-status]');
  const email = emailInput?.value?.trim();

  if (!email) {
    setStatus(statusEl, 'error', STATUS_MESSAGES.missingEmail);
    emailInput?.focus();
    return;
  }

  if (!supabase) {
    setStatus(statusEl, 'error', 'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.');
    return;
  }

  try {
    setLoading(form, true);
    setStatus(statusEl, null, '');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: REDIRECT_URL }
    });
    if (error) throw error;
    setStatus(statusEl, 'success', STATUS_MESSAGES.success);
    form.reset();
  } catch (error) {
    const message = error?.message || STATUS_MESSAGES.genericError;
    setStatus(statusEl, 'error', message);
  } finally {
    setLoading(form, false);
  }
}

async function handleGoogleClick(form, supabase) {
  const statusEl = form.querySelector('[data-auth-status]');
  if (!supabase) {
    setStatus(statusEl, 'error', 'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.');
    return;
  }

  try {
    setLoading(form, true);
    setStatus(statusEl, null, '');
    const { error, data } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_URL }
    });
    if (error) throw error;
    if (!data?.url) {
      setStatus(statusEl, 'success', 'Συνδέεστε με Google…');
    }
  } catch (error) {
    const message = error?.message || STATUS_MESSAGES.genericError;
    setStatus(statusEl, 'error', message);
  } finally {
    setLoading(form, false);
  }
}

function notifyAuthChange(user) {
  try {
    const event = new CustomEvent('mediradar-auth-change', { detail: { user } });
    document.dispatchEvent(event);
  } catch (error) {
    console.warn('[auth] Failed to dispatch auth change event', error);
  }
}

function updateSessionUI(root, user) {
  const sessionCard = qs(root, '[data-auth-session]');
  const viewsContainer = qs(root, '[data-auth-views]');
  const emailEl = qs(root, '[data-auth-user-email]');
  const avatar = qs(root, '[data-auth-avatar]');

  if (user) {
    const email = user.email || '';
    const initial = email ? email.trim().charAt(0).toUpperCase() : '?';
    if (avatar) avatar.textContent = initial;
    if (emailEl) emailEl.textContent = email;
    sessionCard?.classList.remove('hidden');
    viewsContainer?.classList.add('hidden');
  } else {
    sessionCard?.classList.add('hidden');
    viewsContainer?.classList.remove('hidden');
  }

  notifyAuthChange(user);
}

async function refreshUser(root, supabase) {
  if (!supabase) return null;
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const globalStatus = qs(root, '[data-auth-status-global]');
    if (globalStatus) {
      globalStatus.textContent = '';
      globalStatus.classList.add('hidden');
    }
    updateSessionUI(root, user);
    return user;
  } catch (error) {
    const globalStatus = qs(root, '[data-auth-status-global]');
    setStatus(globalStatus, 'error', error?.message || STATUS_MESSAGES.genericError);
    globalStatus?.classList.remove('hidden');
    return null;
  }
}

function showSupabaseError(root) {
  const globalStatus = qs(root, '[data-auth-status-global]');
  if (globalStatus) {
    globalStatus.textContent = 'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.';
    globalStatus.classList.remove('hidden');
  }
  const forms = qsa(root, '[data-auth-form]');
  forms.forEach(form => {
    form.querySelectorAll('button').forEach(btn => {
      btn.disabled = true;
      btn.classList.add('opacity-60');
    });
  });
}

function initAuthPortal() {
  const root = document.querySelector('[data-auth-root]');
  if (!root) return;

  const supabase = supabaseClient;
  const forms = qsa(root, '[data-auth-form]');
  const logoutButton = qs(root, '[data-auth-logout]');

  setActiveTab(root, 'users');

  forms.forEach(form => {
    form.addEventListener('submit', event => handleEmailSubmit(event, supabase));
    const googleButton = form.querySelector('[data-auth-google]');
    googleButton?.addEventListener('click', () => handleGoogleClick(form, supabase));
  });

  qsa(root, '[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(root, btn.dataset.authTab));
  });

  logoutButton?.addEventListener('click', async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      updateSessionUI(root, null);
    } catch (error) {
      const globalStatus = qs(root, '[data-auth-status-global]');
      setStatus(globalStatus, 'error', error?.message || STATUS_MESSAGES.genericError);
      globalStatus?.classList.remove('hidden');
    }
  });

  if (!supabase) {
    showSupabaseError(root);
    return;
  }

  refreshUser(root, supabase);

  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user || null;
    updateSessionUI(root, user);
  });

  window.addEventListener('beforeunload', () => {
    authListener?.subscription?.unsubscribe?.();
  });
}

initAuthPortal();
