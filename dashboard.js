import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.5/+esm';
import { supabaseClient as sharedSupabase } from './firebase.js';
import { ScheduleManager } from './schedule.js';

const env = window.ENV || {};
const urlCandidates = [env.SUPABASE_URL, window.SUPABASE_URL];
const keyCandidates = [env.SUPABASE_ANON_KEY, window.SUPABASE_ANON_KEY];

let supabase = sharedSupabase || window.mediradarSupabase || null;
if (!supabase) {
  const supabaseUrl = urlCandidates.find(value => typeof value === 'string' && value.length);
  const supabaseKey = keyCandidates.find(value => typeof value === 'string' && value.length);
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
}

if (supabase && !window.mediradarSupabase) {
  window.mediradarSupabase = supabase;
}

const LOGIN_URL = '/index.html';

const requestsSection = document.getElementById('requests-container');
const requestsList = document.getElementById('requests-list');
const requestsStatusEl = document.getElementById('requests-status');
const requestsEmptyEl = document.getElementById('requests-empty');
const requestsReloadButton = document.getElementById('requests-reload');
const globalStatusEl = document.getElementById('dashboard-global-status');
const userEmailEl = document.getElementById('dashboard-user-email');
const userNameEl = document.getElementById('dashboard-user-name');
const logoutButton = document.getElementById('dashboard-logout');

const scheduleSection = document.getElementById('schedule-container');
const scheduleManager = scheduleSection ? new ScheduleManager({ section: scheduleSection, supabase }) : null;

let currentSession = null;
let redirectPlanned = false;

function setStatus(element, message, tone = 'info') {
  if (!element) return;
  const allowed = ['info', 'success', 'error'];
  const resolvedTone = allowed.includes(tone) ? tone : 'info';
  element.textContent = message || '';
  element.dataset.tone = resolvedTone;
}

function setGlobalStatus(message, tone = 'info') {
  setStatus(globalStatusEl, message, tone);
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '';
  }
}

function getUserLabel(user) {
  if (!user) return '—';
  return user.email || user.user_metadata?.name || user.phone || '—';
}

function getPharmacyMetadata(user) {
  if (!user) return {};
  const meta = user.user_metadata || {};
  const appMeta = user.app_metadata || {};
  return {
    name: meta.pharmacy_name || appMeta.pharmacy_name || meta.name || null,
    city: meta.pharmacy_city || appMeta.pharmacy_city || null
  };
}

function renderRequests(requests, container = requestsList, emptyEl = requestsEmptyEl) {
  if (!container) return;
  container.innerHTML = '';
  if (!Array.isArray(requests) || requests.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  requests.forEach(request => {
    container.append(createRequestCard(request));
  });
}

function createRequestCard(request) {
  const card = document.createElement('article');
  card.className = 'request-card';
  if (request?.id !== undefined && request?.id !== null) {
    card.dataset.requestId = String(request.id);
  }

  const title = document.createElement('h3');
  title.className = 'request-title';
  title.textContent = request.medicine_name || request.med_name || request.title || 'Αίτημα φαρμάκου';

  const metaList = document.createElement('dl');
  metaList.className = 'request-meta';

  function appendMeta(term, value) {
    if (value === undefined || value === null || value === '') return;
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    metaList.append(dt, dd);
  }

  appendMeta('Πελάτης', request.customer_name || request.customer || 'Ανώνυμος');
  const quantity = request.quantity ?? request.qty ?? null;
  if (quantity !== null) {
    appendMeta('Ποσότητα', String(quantity));
  }
  appendMeta('Πόλη', request.city || request.location || '—');
  appendMeta('Ημ/νία', formatDateTime(request.created_at || request.inserted_at));
  if (request.notes || request.comment || request.message) {
    appendMeta('Σχόλιο', request.notes || request.comment || request.message);
  }
  if (request.allow_generic !== undefined) {
    appendMeta('Γενόσημο', request.allow_generic ? 'Ναι' : 'Όχι');
  }

  const actions = document.createElement('div');
  actions.className = 'request-actions';

  const availableBtn = document.createElement('button');
  availableBtn.type = 'button';
  availableBtn.className = 'request-btn request-btn--available';
  availableBtn.textContent = '✅ Διαθέσιμο';
  availableBtn.dataset.requestAction = 'available';

  const unavailableBtn = document.createElement('button');
  unavailableBtn.type = 'button';
  unavailableBtn.className = 'request-btn request-btn--unavailable';
  unavailableBtn.textContent = '❌ Μη Διαθέσιμο';
  unavailableBtn.dataset.requestAction = 'unavailable';

  actions.append(availableBtn, unavailableBtn);

  card.append(title, metaList, actions);
  return card;
}

export async function loadClientRequests({
  supabase: client = supabase,
  container = requestsList,
  statusEl = requestsStatusEl,
  emptyEl = requestsEmptyEl,
  user = currentSession?.user || null,
  reloadButton = requestsReloadButton
} = {}) {
  if (reloadButton) {
    reloadButton.disabled = true;
    reloadButton.setAttribute('aria-busy', 'true');
  }
  if (!client) {
    setStatus(statusEl, 'Δεν υπάρχει σύνδεση Supabase για φόρτωση αιτημάτων.', 'error');
    if (container) container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (reloadButton) {
      reloadButton.disabled = true;
      reloadButton.removeAttribute('aria-busy');
    }
    return [];
  }

  let session = currentSession || null;
  if (!session) {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      console.warn('[dashboard] Failed to verify session before fetching requests', sessionError);
    }
    session = sessionData?.session || null;
  }
  if (!session) {
    setStatus(statusEl, 'Η συνεδρία έληξε. Συνδεθείτε ξανά για να δείτε αιτήματα.', 'error');
    if (container) container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (reloadButton) {
      reloadButton.disabled = false;
      reloadButton.removeAttribute('aria-busy');
    }
    return [];
  }

  setStatus(statusEl, 'Φόρτωση αιτημάτων…', 'info');
  if (container) container.innerHTML = '';
  if (emptyEl) emptyEl.classList.add('hidden');

  try {
    let query = client
      .from('medicine_requests')
      .select('*')
      .order('created_at', { ascending: false });

    let { data, error } = await query.eq('status', 'pending');
    if (error) {
      const message = error.message || '';
      if (/status/i.test(message)) {
        ({ data, error } = await client
          .from('medicine_requests')
          .select('*')
          .order('created_at', { ascending: false }));
      }
    }
    if (error) {
      throw error;
    }
    const requests = Array.isArray(data) ? data : [];
    renderRequests(requests, container, emptyEl);
    if (requests.length) {
      setStatus(statusEl, `Βρέθηκαν ${requests.length} εκκρεμή αιτήματα.`, 'success');
    } else {
      setStatus(statusEl, 'Δεν υπάρχουν εκκρεμή αιτήματα.', 'info');
    }
    return requests;
  } catch (error) {
    console.warn('[dashboard] loadClientRequests failed', error);
    setStatus(statusEl, `Αποτυχία φόρτωσης αιτημάτων: ${error.message || error}`, 'error');
    if (emptyEl) emptyEl.classList.remove('hidden');
    return [];
  } finally {
    if (reloadButton) {
      reloadButton.disabled = !supabase;
      reloadButton.removeAttribute('aria-busy');
    }
  }
}

async function handleRequestAction(requestId, action, context = {}) {
  if (!requestId) return;
  if (!supabase) {
    setStatus(requestsStatusEl, 'Δεν υπάρχει σύνδεση Supabase.', 'error');
    return;
  }
  let session = currentSession || null;
  if (!session) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('[dashboard] Failed to verify session before updating request', sessionError);
    }
    session = sessionData?.session || null;
  }
  if (!session) {
    setStatus(requestsStatusEl, 'Η συνεδρία έληξε. Συνδεθείτε ξανά για να απαντήσετε στα αιτήματα.', 'error');
    return;
  }
  const statusValue = action === 'available' ? 'available' : 'unavailable';
  const { card, button } = context;
  const buttons = card ? Array.from(card.querySelectorAll('[data-request-action]')) : button ? [button] : [];
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
  });
  setStatus(requestsStatusEl, 'Καταχώρηση απάντησης…', 'info');
  let success = false;
  try {
    const { error } = await supabase
      .from('medicine_requests')
      .update({ status: statusValue })
      .eq('id', requestId);
    if (error) {
      throw error;
    }
    success = true;
  } catch (error) {
    console.warn('[dashboard] handleRequestAction failed', error);
    setStatus(requestsStatusEl, `Αποτυχία ενημέρωσης αιτήματος: ${error.message || error}`, 'error');
  } finally {
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    });
  }
  if (success) {
    await loadClientRequests();
  }
}

function updateUserHeader(user) {
  const label = getUserLabel(user);
  if (userEmailEl) {
    userEmailEl.textContent = label;
  }
  if (userNameEl) {
    const { name, city } = getPharmacyMetadata(user);
    userNameEl.textContent = name ? `${name}${city ? ` • ${city}` : ''}` : label;
  }
}

async function signOut() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.warn('[dashboard] signOut failed', error);
  }
}

function handleAuthSession(session) {
  currentSession = session || null;
  const user = currentSession?.user || null;
  updateUserHeader(user);
  scheduleManager?.setUser(user);

  if (!user) {
    renderRequests([], requestsList, requestsEmptyEl);
    setStatus(requestsStatusEl, 'Δεν υπάρχουν αιτήματα χωρίς σύνδεση.', 'info');
    setGlobalStatus('Η συνεδρία έληξε. Μεταφορά στην αρχική σελίδα…', 'error');
    if (!redirectPlanned) {
      redirectPlanned = true;
      window.setTimeout(() => {
        window.location.href = LOGIN_URL;
      }, 1800);
    }
    return;
  }

  setGlobalStatus('', 'info');
  loadClientRequests({ user });
}

async function initAuth() {
  if (!supabase) {
    setGlobalStatus('Δεν βρέθηκε ρύθμιση Supabase για το MediRadar Dashboard.', 'error');
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    handleAuthSession(data?.session || null);
  } catch (error) {
    console.warn('[dashboard] initAuth failed', error);
    setGlobalStatus('Αποτυχία ελέγχου συνεδρίας. Δοκιμάστε να συνδεθείτε ξανά.', 'error');
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthSession(session || null);
  });
}

if (requestsList) {
  requestsList.addEventListener('click', event => {
    const actionBtn = event.target.closest('[data-request-action]');
    if (!actionBtn) return;
    const card = actionBtn.closest('[data-request-id]');
    const requestId = card?.dataset.requestId || null;
    const action = actionBtn.dataset.requestAction;
    if (!requestId || !action) return;
    handleRequestAction(requestId, action, { card, button: actionBtn });
  });
}

requestsReloadButton?.addEventListener('click', () => {
  loadClientRequests();
});

logoutButton?.addEventListener('click', event => {
  event.preventDefault();
  signOut();
});

if (scheduleManager && supabase) {
  scheduleManager.setSupabase(supabase);
}

if (requestsSection && !supabase) {
  setStatus(requestsStatusEl, 'Δεν υπάρχει ενεργή σύνδεση Supabase.', 'error');
  if (requestsReloadButton) {
    requestsReloadButton.disabled = true;
  }
}

initAuth();
