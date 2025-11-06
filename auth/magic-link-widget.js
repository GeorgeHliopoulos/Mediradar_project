import { supabaseClient } from '../firebase.js';

const ENV = window.ENV || {};
const SITE_URL =
  typeof ENV.SUPABASE_SITE_URL === 'string' && ENV.SUPABASE_SITE_URL.length
    ? ENV.SUPABASE_SITE_URL
    : 'https://mediradar.gr';
const NORMALIZED_SITE_URL = SITE_URL.endsWith('/') ? SITE_URL.slice(0, -1) : SITE_URL;
const EMAIL_REDIRECT_URL =
  typeof ENV.SUPABASE_EMAIL_REDIRECT_URL === 'string' && ENV.SUPABASE_EMAIL_REDIRECT_URL.length
    ? ENV.SUPABASE_EMAIL_REDIRECT_URL
    : `${NORMALIZED_SITE_URL}/`;
const OAUTH_REDIRECT_URL =
  typeof ENV.SUPABASE_REDIRECT_URL === 'string' && ENV.SUPABASE_REDIRECT_URL.length
    ? ENV.SUPABASE_REDIRECT_URL
    : `${NORMALIZED_SITE_URL}/auth/v1/callback`;
const APP_NAME =
  typeof ENV.SUPABASE_APP_NAME === 'string' && ENV.SUPABASE_APP_NAME.length
    ? ENV.SUPABASE_APP_NAME
    : 'MediRadar';
const APP_DESCRIPTION =
  typeof ENV.SUPABASE_APP_DESCRIPTION === 'string' && ENV.SUPABASE_APP_DESCRIPTION.length
    ? ENV.SUPABASE_APP_DESCRIPTION
    : 'Σύνδεση μέσω Google για την πλατφόρμα MediRadar';
const APP_LOGO =
  typeof ENV.SUPABASE_APP_LOGO === 'string' && ENV.SUPABASE_APP_LOGO.length
    ? ENV.SUPABASE_APP_LOGO
    : `${NORMALIZED_SITE_URL}/icons/icon-512.png`;

const DEFAULT_DEMO_EMAIL = 'info@mediradar.gr';

const AUTH_CHANNEL_PREFIX = 'mediradar_auth_channel_';
const AUTH_CHANNEL_EVENT = 'AUTH_SUCCESS';
const AUTH_CHANNEL_STORAGE_KEY = 'mediradar.auth.channel';

let activeAuthChannel = null;
let activeAuthChannelName = null;
let authBroadcastSent = false;
let authCleanupRegistered = false;

function ensureMetaTag({ selector, name, property, content }) {
  if (!content || !document?.head) return;
  let tag = selector ? document.head.querySelector(selector) : null;
  if (!tag) {
    tag = document.createElement('meta');
    if (name) tag.setAttribute('name', name);
    if (property) tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function applyBrandingMetadata() {
  ensureMetaTag({
    selector: 'meta[name="application-name"]',
    name: 'application-name',
    content: APP_NAME
  });
  ensureMetaTag({
    selector: 'meta[name="apple-mobile-web-app-title"]',
    name: 'apple-mobile-web-app-title',
    content: APP_NAME
  });
  ensureMetaTag({
    selector: 'meta[name="description"]',
    name: 'description',
    content: APP_DESCRIPTION
  });
  ensureMetaTag({
    selector: 'meta[property="og:site_name"]',
    property: 'og:site_name',
    content: APP_NAME
  });
  ensureMetaTag({
    selector: 'meta[property="og:description"]',
    property: 'og:description',
    content: APP_DESCRIPTION
  });
  ensureMetaTag({
    selector: 'meta[property="twitter:description"]',
    property: 'twitter:description',
    content: APP_DESCRIPTION
  });

  const iconSelectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'];
  iconSelectors.forEach(selector => {
    const link = document.head.querySelector(selector);
    if (link && APP_LOGO) {
      link.setAttribute('href', APP_LOGO);
    }
  });
}

applyBrandingMetadata();

const STATUS_MESSAGES = {
  success: '✅ Magic link στάλθηκε στο email σας!',
  missingEmail: 'Παρακαλούμε συμπληρώστε το email σας.',
  genericError: 'Κάτι πήγε στραβά. Προσπαθήστε ξανά.',
  crossDeviceTip: 'Αν ανοίξετε το magic link από άλλη συσκευή, η σύνδεση θα ενεργοποιηθεί μόνο εκεί για λόγους ασφαλείας.',
  demoSuccess: '🧪 Demo σύνδεση ενεργοποιήθηκε. Θα δείτε δοκιμαστικά αιτήματα.',
  demoError: 'Δεν ήταν δυνατή η είσοδος demo αυτή τη στιγμή.'
};

const successTimers = new WeakMap();

function qs(root, selector) {
  return root.querySelector(selector);
}

function qsa(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

function detectAuthRedirect() {
  try {
    if (typeof window === 'undefined') return false;
    const hash = typeof window.location?.hash === 'string' ? window.location.hash : '';
    const search = typeof window.location?.search === 'string' ? window.location.search : '';
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    searchParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
    const hasToken = params.has('access_token');
    const type = (params.get('type') || '').toLowerCase();
    const validTypes = ['magiclink', 'recovery', 'signup', 'invite'];
    return hasToken || validTypes.includes(type);
  } catch (error) {
    console.warn('[auth] Failed to detect auth redirect', error);
    return false;
  }
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getAuthChannelName(identifier) {
  const normalized = normalizeEmail(identifier);
  if (!normalized) return null;
  const safe = normalized.replace(/[^a-z0-9]/g, '_');
  return `${AUTH_CHANNEL_PREFIX}${safe}`;
}

function storeAuthChannelName(channelName) {
  try {
    if (channelName) {
      localStorage.setItem(AUTH_CHANNEL_STORAGE_KEY, channelName);
    }
  } catch (error) {
    console.warn('[auth] Failed to store auth channel name', error);
  }
}

function clearStoredAuthChannelName() {
  try {
    localStorage.removeItem(AUTH_CHANNEL_STORAGE_KEY);
  } catch (error) {
    console.warn('[auth] Failed to clear stored auth channel name', error);
  }
}

async function cleanupAuthChannel(supabase) {
  if (activeAuthChannel) {
    try {
      await activeAuthChannel.unsubscribe();
    } catch (error) {
      console.warn('[auth] Failed to unsubscribe from auth channel', error);
    }
    try {
      supabase?.removeChannel?.(activeAuthChannel);
    } catch (error) {
      console.warn('[auth] Failed to remove auth channel', error);
    }
  }
  activeAuthChannel = null;
  activeAuthChannelName = null;
  clearStoredAuthChannelName();
}

async function subscribeToAuthSuccess(email, supabase) {
  if (!supabase) return;
  const channelName = getAuthChannelName(email);
  if (!channelName) return;
  await cleanupAuthChannel(supabase);
  storeAuthChannelName(channelName);
  let channel;
  try {
    channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } });
    channel.on('broadcast', { event: AUTH_CHANNEL_EVENT }, async () => {
      await cleanupAuthChannel(supabase);
      try {
        window.location.href = '/dashboard.html';
      } catch (error) {
        console.warn('[auth] Failed to redirect after auth success', error);
      }
    });
    activeAuthChannel = channel;
    activeAuthChannelName = channelName;
    await channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        cleanupAuthChannel(supabase);
      }
    });
  } catch (error) {
    console.warn('[auth] Failed to subscribe to auth channel', error);
  }
}

async function broadcastAuthSuccess(user, supabase) {
  if (!supabase || !user?.email || authBroadcastSent || !authRedirectDetected) return;
  const channelName = getAuthChannelName(user.email);
  if (!channelName) return;
  let channel = null;
  try {
    channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } });
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: AUTH_CHANNEL_EVENT,
      payload: {
        email: user.email,
        timestamp: new Date().toISOString()
      }
    });
    authBroadcastSent = true;
  } catch (error) {
    console.warn('[auth] Failed to broadcast auth success', error);
  } finally {
    if (channel) {
      try {
        await channel.unsubscribe();
      } catch (error) {
        console.warn('[auth] Failed to unsubscribe auth broadcast channel', error);
      }
      try {
        supabase.removeChannel?.(channel);
      } catch (error) {
        console.warn('[auth] Failed to remove auth broadcast channel', error);
      }
    }
  }
}

const authRedirectDetected = detectAuthRedirect();

function setActiveTab(root, tab) {
  if (!tab) return;
  const forms = qsa(root, '[data-auth-form]');
  const tabs = qsa(root, '[data-auth-tab]');

  tabs.forEach(btn => {
    const isActive = btn.dataset.authTab === tab;
    btn.classList.toggle('bg-white', isActive);
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

function getCardFromElement(el) {
  const root = el?.closest('[data-auth-root]') || null;
  if (!root) return null;
  return root.closest('[data-auth-card]') || root;
}

function runCardEffect(card, className, duration = 1000) {
  if (!card || !className) return;
  card.classList.remove(className);
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  card.offsetHeight;
  card.classList.add(className);
  window.setTimeout(() => {
    card.classList.remove(className);
  }, duration);
}

function triggerCardFeedback(statusEl, type) {
  if (!statusEl || !type) return;
  const card = getCardFromElement(statusEl);
  if (!card) return;
  if (type === 'success') {
    runCardEffect(card, 'auth-card--pulse-success', 1400);
  } else if (type === 'error') {
    runCardEffect(card, 'auth-card--shake-error', 600);
  }
}

function clearSuccessTimer(root) {
  const timer = successTimers.get(root);
  if (timer) {
    window.clearTimeout(timer);
    successTimers.delete(root);
  }
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
  triggerCardFeedback(el, type);
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
      options: { emailRedirectTo: EMAIL_REDIRECT_URL }
    });
    if (error) throw error;
    await subscribeToAuthSuccess(email, supabase);
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
      options: { redirectTo: OAUTH_REDIRECT_URL }
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
  if (!root) return;
  const sessionCard = qs(root, '[data-auth-session]');
  const formsContainer = qs(root, '[data-auth-forms]') || qs(root, '[data-auth-views]') || root;
  const successView = qs(root, '[data-auth-success]');
  const emailEl = qs(root, '[data-auth-user-email]');
  const avatar = qs(root, '[data-auth-avatar]');
  const demoBanner = qs(root, '[data-demo-banner]');
  const card = getCardFromElement(root);

  clearSuccessTimer(root);

  const previousUserId = root.dataset.authUserId || '';
  const initialized = root.dataset.authInitialized === 'true';
  const newUserId = user?.id || '';
  const isNewLogin = Boolean(user && initialized && previousUserId !== newUserId);

  if (user) {
    const email = user.email || '';
    const initial = email ? email.trim().charAt(0).toUpperCase() : '?';
    if (avatar) avatar.textContent = initial;
    if (emailEl) emailEl.textContent = email;

    // show demo banner if demo email
    if (demoBanner) {
      if (email === DEFAULT_DEMO_EMAIL) {
        demoBanner.classList.remove('hidden');
      } else {
        demoBanner.classList.add('hidden');
      }
    }

    if (successView && sessionCard && isNewLogin) {
      successView.classList.remove('hidden');
      successView.classList.add('auth-success-active');
      runCardEffect(card, 'auth-card--login-success', 2000);
      successTimers.set(
        root,
        window.setTimeout(() => {
          successView.classList.remove('auth-success-active');
          successView.classList.add('hidden');
          sessionCard.classList.remove('hidden');
        }, 2000)
      );
    } else {
      successView?.classList.remove('auth-success-active');
      successView?.classList.add('hidden');
      sessionCard?.classList.remove('hidden');
    }
    formsContainer?.classList.add('hidden');
  } else {
    sessionCard?.classList.add('hidden');
    successView?.classList.remove('auth-success-active');
    successView?.classList.add('hidden');
    formsContainer?.classList.remove('hidden');
    if (demoBanner) demoBanner.classList.add('hidden');
  }

  root.dataset.authUserId = newUserId;
  root.dataset.authInitialized = 'true';

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
    await broadcastAuthSuccess(user, supabase);
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

function initAuthPortal(root) {
  if (!root) return;

  const supabase = supabaseClient;
  if (!authCleanupRegistered) {
    authCleanupRegistered = true;
    window.addEventListener('beforeunload', () => {
      cleanupAuthChannel(supabase);
    });
  }
  const forms = qsa(root, '[data-auth-form]');
  const logoutButton = qs(root, '[data-auth-logout]');
  const tabs = qsa(root, '[data-auth-tab]');
  const crossDeviceTips = qsa(root, '[data-auth-cross-device-tip]');

  // set cross-device tip text
  crossDeviceTips.forEach(tip => {
    tip.textContent = `💡 ${STATUS_MESSAGES.crossDeviceTip}`;
  });

  const defaultTab = root.dataset.authDefaultTab || tabs[0]?.dataset.authTab || forms[0]?.dataset.authForm;
  if (tabs.length > 0 && defaultTab) {
    setActiveTab(root, defaultTab);
  }

  forms.forEach(form => {
    form.addEventListener('submit', event => handleEmailSubmit(event, supabase));
    const googleButton = form.querySelector('[data-auth-google]');
    googleButton?.addEventListener('click', () => handleGoogleClick(form, supabase));
    const demoButton = form.querySelector('[data-demo-login]');
    if (demoButton) {
      demoButton.addEventListener('click', async () => {
        const statusEl = form.querySelector('[data-auth-status]');
        if (!supabase) {
          setStatus(statusEl, 'error', 'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.');
          return;
        }
        try {
          setLoading(form, true);
          setStatus(statusEl, null, '');
          const { error } = await supabase.auth.signInWithOtp({
            email: DEFAULT_DEMO_EMAIL,
            options: { emailRedirectTo: EMAIL_REDIRECT_URL }
          });
          if (error) throw error;
          await subscribeToAuthSuccess(DEFAULT_DEMO_EMAIL, supabase);
          setStatus(statusEl, 'success', STATUS_MESSAGES.demoSuccess);
        } catch (error) {
          setStatus(statusEl, 'error', STATUS_MESSAGES.demoError);
        } finally {
          setLoading(form, false);
        }
      });
    }
  });

  tabs.forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(root, btn.dataset.authTab));
  });

  logoutButton?.addEventListener('click', async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      await cleanupAuthChannel(supabase);
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

  const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user || null;
    updateSessionUI(root, user);
    await broadcastAuthSuccess(user, supabase);
  });

  window.addEventListener('beforeunload', () => {
    authListener?.subscription?.unsubscribe?.();
  });
}

function bootstrapAuthPortals() {
  const roots = document.querySelectorAll('[data-auth-root]');
  if (!roots.length) return;
  roots.forEach(root => initAuthPortal(root));
}
update magic link widget

bootstrapAuthPortals();

