const DAYS = [
  { key: 'mon', label: 'Δευτέρα' },
  { key: 'tue', label: 'Τρίτη' },
  { key: 'wed', label: 'Τετάρτη' },
  { key: 'thu', label: 'Πέμπτη' },
  { key: 'fri', label: 'Παρασκευή' },
  { key: 'sat', label: 'Σάββατο' },
  { key: 'sun', label: 'Κυριακή' }
];

let supabase = null;
let currentUser = null;
let pharmacyId = null;
let bootInFlight = null;
let listenersBound = false;
let hoursState = createDefaultHours();

let portalEl = null;
let authCardEl = null;
let userEmailEl = null;
let signOutBtn = null;
let authForm = null;
let magicLinkBtn = null;
let googleBtn = null;
let cityFilterInput = null;
let loadBtn = null;
let refreshBtn = null;
let demoBtn = null;
let requestsErrorEl = null;
let requestsListEl = null;
let hoursForm = null;
let hoursErrorEl = null;
let hoursSaveBtn = null;
let hoursReloadBtn = null;
let toastContainer = null;

function createDefaultHours() {
  return DAYS.reduce((acc, { key }) => {
    acc[key] = { openFlag: false, open: '', close: '' };
    return acc;
  }, {});
}

function getRedirectUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return 'https://mediradar.gr/pharmacy.html';
  }
  return `${window.location.origin}/pharmacy.html`;
}

function showAuth() {
  if (authCardEl) authCardEl.style.display = 'block';
  if (portalEl) portalEl.style.display = 'none';
  if (userEmailEl) userEmailEl.textContent = '';
}

function showPortal(user) {
  if (portalEl) portalEl.style.display = 'block';
  if (authCardEl) authCardEl.style.display = 'none';
  if (userEmailEl) userEmailEl.textContent = user?.email || '';
}

async function boot(user) {
  if (!supabase || !user) return;
  currentUser = user;

  if (bootInFlight) {
    await bootInFlight;
    return;
  }

  bootInFlight = (async () => {
    try {
      const pharmacy = await ensurePharmacy(user);
      await loadHours(pharmacy?.hours);
      await reloadRequests();
    } catch (error) {
      console.error('[pharmacy] boot error', error);
      toast('Αποτυχία φόρτωσης δεδομένων. Δοκίμασε ξανά.', 'error');
    } finally {
      bootInFlight = null;
    }
  })();

  await bootInFlight;
}

async function ensurePharmacy(user) {
  const { data, error } = await supabase
    .from('pharmacies')
    .select('id, hours')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data) {
    pharmacyId = data.id;
    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('pharmacies')
    .insert({ owner_id: user.id, name: '', is_pro_active: false, hours: createDefaultHours() })
    .select('id, hours')
    .single();

  if (insertError) {
    throw insertError;
  }

  pharmacyId = inserted.id;
  return inserted;
}

async function reloadRequests() {
  if (!supabase || !pharmacyId || !requestsListEl) return;

  requestsErrorEl?.classList.add('hidden');
  if (requestsErrorEl) {
    requestsErrorEl.textContent = '';
    requestsErrorEl.style.display = 'none';
  }

  requestsListEl.innerHTML = '';
  const loadingEl = document.createElement('p');
  loadingEl.textContent = 'Φόρτωση αιτημάτων…';
  loadingEl.className = 'requests-loading';
  requestsListEl.appendChild(loadingEl);

  try {
    const city = cityFilterInput?.value?.trim() || '';
    let query = supabase
      .from('open_requests_for_pharmacies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    renderRequests(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('[pharmacy] failed to load requests', error);
    requestsListEl.innerHTML = '';
    showRequestsError('Αδυναμία φόρτωσης αιτημάτων. Προσπάθησε ξανά.');
  }
}

function renderRequests(requests) {
  if (!requestsListEl) return;
  requestsListEl.innerHTML = '';

  if (!requests.length) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'requests-empty';
    emptyEl.textContent = 'Δεν υπάρχουν αιτήματα που να ταιριάζουν με τα φίλτρα.';
    requestsListEl.appendChild(emptyEl);
    return;
  }

  const fragment = document.createDocumentFragment();
  requests.forEach((request) => {
    const card = buildRequestCard(request);
    fragment.appendChild(card);
  });
  requestsListEl.appendChild(fragment);
}

function buildRequestCard(request) {
  const card = document.createElement('article');
  card.className = 'request-card';
  card.dataset.requestId = request.id;

  const title = document.createElement('h3');
  title.className = 'request-title';
  title.textContent = request.medicine_name || 'Αίτημα';
  card.appendChild(title);

  const badge = document.createElement('span');
  badge.className = 'request-badge';
  badge.textContent = 'Απαντήθηκε';
  badge.setAttribute('aria-hidden', 'true');
  badge.style.display = 'none';
  card.appendChild(badge);

  const meta = document.createElement('div');
  meta.className = 'request-meta';
  meta.innerHTML = `
    <p><strong>Ουσία:</strong> ${escapeHtml(request.substance || '—')}</p>
    <p><strong>Τύπος:</strong> ${escapeHtml(request.type || '—')}</p>
    <p><strong>Ποσότητα:</strong> ${escapeHtml(String(request.quantity ?? '—'))}</p>
    <p><strong>Πόλη:</strong> ${escapeHtml(request.city || '—')}</p>
    <p><strong>Κατάσταση:</strong> ${escapeHtml(request.status || '—')}</p>
    <p><strong>Δημιουργήθηκε:</strong> ${formatRelative(request.created_at)}</p>
    ${request.pickup_until ? `<p><strong>Παραλαβή έως:</strong> ${formatDate(request.pickup_until)}</p>` : ''}
  `;
  card.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'request-actions';

  const availableBtn = document.createElement('button');
  availableBtn.type = 'button';
  availableBtn.className = 'request-action';
  availableBtn.dataset.action = 'respond';
  availableBtn.dataset.kind = 'available';
  availableBtn.textContent = 'Το έχω';

  const genericBtn = document.createElement('button');
  genericBtn.type = 'button';
  genericBtn.className = 'request-action';
  genericBtn.dataset.action = 'respond';
  genericBtn.dataset.kind = 'available';
  genericBtn.dataset.genericOnly = 'true';
  genericBtn.textContent = 'Μόνο γενόσημο';

  const unavailableBtn = document.createElement('button');
  unavailableBtn.type = 'button';
  unavailableBtn.className = 'request-action';
  unavailableBtn.dataset.action = 'respond';
  unavailableBtn.dataset.kind = 'unavailable';
  unavailableBtn.textContent = 'Δεν το έχω';

  actions.appendChild(availableBtn);
  actions.appendChild(genericBtn);
  actions.appendChild(unavailableBtn);
  card.appendChild(actions);

  return card;
}

function showRequestsError(message) {
  if (!requestsErrorEl) return;
  requestsErrorEl.textContent = message;
  requestsErrorEl.style.display = 'block';
  requestsErrorEl.classList.remove('hidden');
}

async function respond(requestId, kind, genericOnly) {
  if (!supabase || !pharmacyId || !requestId) return;

  try {
    const payload = {
      request_id: requestId,
      pharmacy_id: pharmacyId,
      kind,
      generic_only: !!genericOnly
    };

    const { error } = await supabase.from('responses').insert(payload).select().single();

    if (error) {
      if (error.code === '23505') {
        const { error: updateError } = await supabase
          .from('responses')
          .update({ kind, generic_only: !!genericOnly })
          .eq('request_id', requestId)
          .eq('pharmacy_id', pharmacyId)
          .select()
          .single();
        if (updateError) throw updateError;
      } else {
        throw error;
      }
    }

    markRequestAsAnswered(requestId);
    toast('Η απάντησή σου καταχωρήθηκε.', 'success');
  } catch (error) {
    console.error('[pharmacy] failed to respond', error);
    toast('Αποτυχία αποστολής απάντησης. Προσπάθησε ξανά.', 'error');
  }
}

function markRequestAsAnswered(requestId) {
  if (!requestsListEl) return;
  const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(requestId) : requestId;
  const card = requestsListEl.querySelector(`[data-request-id="${safeId}"]`);
  if (!card) return;
  card.dataset.answered = 'true';
  const badge = card.querySelector('.request-badge');
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.setAttribute('aria-hidden', 'false');
  }
}

async function loadHours(initialHours) {
  if (!supabase || !pharmacyId) return false;
  clearHoursError();

  try {
    let hours = initialHours;
    if (!hours) {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('hours')
        .eq('id', pharmacyId)
        .single();
      if (error) throw error;
      hours = data?.hours || null;
    }

    hoursState = mergeHours(hours);
    renderHours();
    return true;
  } catch (error) {
    console.error('[pharmacy] failed to load hours', error);
    showHoursError('Αδυναμία φόρτωσης ωραρίου. Προσπάθησε ξανά.');
    return false;
  }
}

function renderHours() {
  if (!hoursForm) return;

  DAYS.forEach(({ key }) => {
    const dayState = hoursState[key] || { openFlag: false, open: '', close: '' };
    const checkbox = hoursForm.querySelector(`input[type="checkbox"][data-day="${key}"][data-field="openFlag"]`);
    const openInput = hoursForm.querySelector(`input[type="time"][data-day="${key}"][data-field="open"]`);
    const closeInput = hoursForm.querySelector(`input[type="time"][data-day="${key}"][data-field="close"]`);

    if (checkbox) {
      checkbox.checked = !!dayState.openFlag;
    }
    if (openInput) {
      openInput.value = safeTime(dayState.open);
      openInput.disabled = !dayState.openFlag;
    }
    if (closeInput) {
      closeInput.value = safeTime(dayState.close);
      closeInput.disabled = !dayState.openFlag;
    }
  });
}

async function saveHours() {
  if (!supabase || !pharmacyId || !hoursForm) return;

  const payload = {};
  for (const { key } of DAYS) {
    const checkbox = hoursForm.querySelector(`input[type="checkbox"][data-day="${key}"][data-field="openFlag"]`);
    const openInput = hoursForm.querySelector(`input[type="time"][data-day="${key}"][data-field="open"]`);
    const closeInput = hoursForm.querySelector(`input[type="time"][data-day="${key}"][data-field="close"]`);

    const openFlag = checkbox?.checked ?? false;
    const open = safeTime(openInput?.value || '');
    const close = safeTime(closeInput?.value || '');

    if (openFlag) {
      if (!open || !close) {
        showHoursError('Για κάθε ανοιχτή ημέρα συμπλήρωσε ώρα έναρξης και λήξης.');
        return;
      }
      if (!isValidTimeRange(open, close)) {
        showHoursError('Η ώρα λήξης πρέπει να είναι μεταγενέστερη της ώρας έναρξης.');
        return;
      }
    }

    payload[key] = {
      openFlag,
      open: openFlag ? open : '',
      close: openFlag ? close : ''
    };
  }

  clearHoursError();

  try {
    const { error } = await supabase
      .from('pharmacies')
      .update({ hours: payload })
      .eq('id', pharmacyId)
      .select()
      .single();
    if (error) throw error;

    hoursState = mergeHours(payload);
    toast('Το ωράριο αποθηκεύτηκε.', 'success');
  } catch (error) {
    console.error('[pharmacy] failed to save hours', error);
    showHoursError('Αποτυχία αποθήκευσης ωραρίου. Προσπάθησε ξανά.');
  }
}

async function reloadHoursFromDB() {
  const ok = await loadHours();
  if (ok) {
    toast('Έγινε επαναφόρτωση του ωραρίου από το Supabase.', 'info');
  }
}

function mergeHours(source) {
  const merged = createDefaultHours();
  if (!source || typeof source !== 'object') {
    return merged;
  }

  for (const { key } of DAYS) {
    const entry = source[key];
    if (!entry || typeof entry !== 'object') continue;
    merged[key] = {
      openFlag: !!entry.openFlag,
      open: safeTime(entry.open),
      close: safeTime(entry.close)
    };
  }
  return merged;
}

function safeTime(value) {
  const str = (value || '').toString().trim();
  if (!str) return '';
  const match = str.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return '';
  return `${match[1]}:${match[2]}`;
}

function isValidTimeRange(open, close) {
  if (!open || !close) return false;
  const [openHours, openMinutes] = open.split(':').map(Number);
  const [closeHours, closeMinutes] = close.split(':').map(Number);
  const openTotal = openHours * 60 + openMinutes;
  const closeTotal = closeHours * 60 + closeMinutes;
  return closeTotal > openTotal;
}

function clearHoursError() {
  if (!hoursErrorEl) return;
  hoursErrorEl.textContent = '';
  hoursErrorEl.style.display = 'none';
  hoursErrorEl.classList.add('hidden');
}

function showHoursError(message) {
  if (!hoursErrorEl) return;
  hoursErrorEl.textContent = message;
  hoursErrorEl.style.display = 'block';
  hoursErrorEl.classList.remove('hidden');
}

async function createDemoRequest() {
  if (!supabase || !currentUser) return;

  try {
    const { error } = await supabase
      .from('requests')
      .insert({
        user_id: currentUser.id,
        city: 'DEMO CITY',
        medicine_name: 'Demozin 500mg tabs',
        substance: 'demo-cillin',
        type: 'tabs',
        quantity: 1,
        allow_generic: true,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) throw error;

    toast('Δημιουργήθηκε demo αίτημα.', 'success');
    await reloadRequests();
  } catch (error) {
    console.error('[pharmacy] failed to create demo request', error);
    toast('Αποτυχία δημιουργίας demo αιτήματος.', 'error');
  }
}

function toast(message, tone = 'info') {
  if (!toastContainer) return;

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${tone}`;
  toastEl.textContent = message;
  toastContainer.appendChild(toastEl);

  requestAnimationFrame(() => {
    toastEl.classList.add('visible');
  });

  setTimeout(() => {
    toastEl.classList.remove('visible');
    setTimeout(() => toastEl.remove(), 300);
  }, 4000);
}

function formatRelative(dateLike) {
  if (!dateLike) return '—';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'πριν λίγα δευτερόλεπτα';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `πριν ${diffMinutes} λεπτά`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `πριν ${diffHours} ώρες`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `πριν ${diffDays} ημέρες`;
  return formatDate(dateLike);
}

function formatDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('el-GR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function bindEventListeners() {
  if (listenersBound) return;
  listenersBound = true;

  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailInput = authForm.querySelector('#auth-email');
    const email = emailInput?.value?.trim();
    if (!email) {
      toast('Συμπλήρωσε email για να στείλεις magic link.', 'error');
      emailInput?.focus();
      return;
    }
    if (!supabase) {
      toast('Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.', 'error');
      return;
    }

    try {
      magicLinkBtn?.setAttribute('disabled', 'true');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getRedirectUrl() }
      });
      if (error) throw error;
      toast('Σου στείλαμε link. Άνοιξέ το στον ίδιο browser.', 'success');
    } catch (error) {
      console.error('[pharmacy] magic link error', error);
      toast('Αποτυχία αποστολής magic link.', 'error');
    } finally {
      magicLinkBtn?.removeAttribute('disabled');
    }
  });

  googleBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    if (!supabase) {
      toast('Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.', 'error');
      return;
    }
    try {
      googleBtn.setAttribute('disabled', 'true');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getRedirectUrl() }
      });
      if (error) throw error;
    } catch (error) {
      console.error('[pharmacy] google auth error', error);
      toast('Αποτυχία σύνδεσης με Google.', 'error');
    } finally {
      googleBtn?.removeAttribute('disabled');
    }
  });

  signOutBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      toast('Αποσυνδέθηκες.', 'info');
    } catch (error) {
      console.error('[pharmacy] sign out error', error);
      toast('Αποτυχία αποσύνδεσης.', 'error');
    }
  });

  refreshBtn?.addEventListener('click', () => reloadRequests());
  loadBtn?.addEventListener('click', () => reloadRequests());
  cityFilterInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      reloadRequests();
    }
  });
  demoBtn?.addEventListener('click', () => createDemoRequest());

  requestsListEl?.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('button[data-action="respond"]') : null;
    if (!button) return;
    const card = button.closest('[data-request-id]');
    if (!card) return;
    const requestId = card.dataset.requestId;
    const kind = button.dataset.kind || 'available';
    const genericOnly = button.dataset.genericOnly === 'true';
    respond(requestId, kind, genericOnly);
  });

  hoursSaveBtn?.addEventListener('click', () => saveHours());
  hoursReloadBtn?.addEventListener('click', () => reloadHoursFromDB());

  HOURS_CHECKBOX_SELECTOR_CACHE.forEach(({ key, checkbox, openInput, closeInput }) => {
    checkbox?.addEventListener('change', () => {
      const enabled = checkbox.checked;
      if (openInput) openInput.disabled = !enabled;
      if (closeInput) closeInput.disabled = !enabled;
    });
  });
}

const HOURS_CHECKBOX_SELECTOR_CACHE = DAYS.map(({ key }) => ({
  key,
  checkbox: null,
  openInput: null,
  closeInput: null
}));

function cacheHoursInputs() {
  if (!hoursForm) return;
  HOURS_CHECKBOX_SELECTOR_CACHE.forEach((entry) => {
    entry.checkbox = hoursForm.querySelector(`input[type="checkbox"][data-day="${entry.key}"][data-field="openFlag"]`);
    entry.openInput = hoursForm.querySelector(`input[type="time"][data-day="${entry.key}"][data-field="open"]`);
    entry.closeInput = hoursForm.querySelector(`input[type="time"][data-day="${entry.key}"][data-field="close"]`);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  portalEl = document.getElementById('portal');
  authCardEl = document.getElementById('auth-card');
  userEmailEl = document.getElementById('user-email');
  signOutBtn = document.getElementById('btn-signout');
  authForm = document.getElementById('auth-form');
  magicLinkBtn = document.getElementById('btn-magic-link');
  googleBtn = document.getElementById('btn-google');
  cityFilterInput = document.getElementById('city-filter');
  loadBtn = document.getElementById('btn-load');
  refreshBtn = document.getElementById('btn-refresh');
  demoBtn = document.getElementById('btn-demo');
  requestsErrorEl = document.getElementById('requests-error');
  requestsListEl = document.getElementById('requests-list');
  hoursForm = document.getElementById('hours-form');
  hoursErrorEl = document.getElementById('hours-error');
  hoursSaveBtn = document.getElementById('btn-hours-save');
  hoursReloadBtn = document.getElementById('btn-hours-reload');
  toastContainer = document.querySelector('.toast-container');

  cacheHoursInputs();
  renderHours();
  bindEventListeners();

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    console.error('Missing Supabase configuration.');
    showAuth();
    return;
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
      try {
        await supabase.auth.exchangeCodeForSession({ code });
      } catch (error) {
        console.error('[pharmacy] exchange code error', error);
        toast('Αποτυχία ολοκλήρωσης σύνδεσης.', 'error');
      } finally {
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        history.replaceState({}, document.title, `${url.pathname}${url.hash}`);
      }
    }

    const { data: sessionData, error } = await supabase.auth.getSession();
    if (error) throw error;

    const session = sessionData?.session || null;
    if (session?.user) {
      showPortal(session.user);
      await boot(session.user);
    } else {
      showAuth();
    }

    supabase.auth.onAuthStateChange(async (event, sessionInfo) => {
      if (event === 'SIGNED_IN' && sessionInfo?.user) {
        showPortal(sessionInfo.user);
        await boot(sessionInfo.user);
      } else if (event === 'SIGNED_OUT') {
        showAuth();
        pharmacyId = null;
      }
    });
  } catch (error) {
    console.error('[pharmacy] auth bootstrap error', error);
    showAuth();
  }
});

export { showAuth, showPortal, boot, reloadRequests, respond, loadHours, saveHours, reloadHoursFromDB, toast };
