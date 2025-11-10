const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment configuration.');
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const portalEl = document.getElementById('portal');
const authCardEl = document.getElementById('auth-card');
const userEmailEl = document.getElementById('user-email');
const signOutBtn = document.getElementById('btn-signout');
const authForm = document.getElementById('auth-form');
const magicLinkBtn = document.getElementById('btn-magic-link');
const googleBtn = document.getElementById('btn-google');
const requestsListEl = document.getElementById('requests-list');
const requestsErrorEl = document.getElementById('requests-error');
const refreshBtn = document.getElementById('btn-refresh');
const demoBtn = document.getElementById('btn-demo');
const cityFilterInput = document.getElementById('city-filter');
const loadBtn = document.getElementById('btn-load');
const hoursForm = document.getElementById('hours-form');
const hoursErrorEl = document.getElementById('hours-error');
const hoursSaveBtn = document.getElementById('btn-hours-save');
const hoursReloadBtn = document.getElementById('btn-hours-reload');
const toastContainer = document.querySelector('.toast-container');

const DAYS = [
  { key: 'mon', label: 'Δευτέρα' },
  { key: 'tue', label: 'Τρίτη' },
  { key: 'wed', label: 'Τετάρτη' },
  { key: 'thu', label: 'Πέμπτη' },
  { key: 'fri', label: 'Παρασκευή' },
  { key: 'sat', label: 'Σάββατο' },
  { key: 'sun', label: 'Κυριακή' },
];

const state = {
  pharmacyId: null,
  currentUserId: null,
  listenersBound: false,
  hours: defaultHours(),
};

function defaultHours() {
  return DAYS.reduce((acc, day) => {
    acc[day.key] = { openFlag: false, open: '', close: '' };
    return acc;
  }, {});
}

function showPortal(visible) {
  if (!portalEl) return;
  portalEl.style.display = visible ? 'flex' : 'none';
}

function showAuthCard(visible) {
  if (!authCardEl) return;
  authCardEl.style.display = visible ? 'block' : 'none';
}

function resetPortalView() {
  if (requestsListEl) {
    requestsListEl.innerHTML = '';
  }
  if (requestsErrorEl) {
    requestsErrorEl.textContent = '';
    requestsErrorEl.style.display = 'none';
  }
  if (hoursErrorEl) {
    hoursErrorEl.textContent = '';
    hoursErrorEl.style.display = 'none';
  }
}

function bindStaticListeners() {
  if (state.listenersBound) return;
  state.listenersBound = true;

  if (authForm) {
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(authForm);
      const email = (formData.get('auth-email') || '').toString().trim();
      if (!email) {
        toast('Συμπλήρωσε email για να στείλεις magic link.', 'error');
        return;
      }
      magicLinkBtn?.setAttribute('disabled', 'true');
      try {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        toast('Στάλθηκε magic link στο email σου.');
      } catch (err) {
        console.error(err);
        toast('Αδυναμία αποστολής magic link. Προσπάθησε ξανά.', 'error');
      } finally {
        magicLinkBtn?.removeAttribute('disabled');
      }
    });
  }

  googleBtn?.addEventListener('click', async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast('Αποτυχία σύνδεσης με Google.', 'error');
    }
  });

  signOutBtn?.addEventListener('click', async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
      toast('Αποτυχία αποσύνδεσης.', 'error');
    }
  });

  refreshBtn?.addEventListener('click', () => reloadRequests());
  demoBtn?.addEventListener('click', () => createDemoRequest());
  loadBtn?.addEventListener('click', () => reloadRequests());
  cityFilterInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      reloadRequests();
    }
  });

  hoursSaveBtn?.addEventListener('click', () => saveHours());
  hoursReloadBtn?.addEventListener('click', () => reloadHours());

  DAYS.forEach((day) => {
    const checkbox = hoursForm?.querySelector(`input[type="checkbox"][data-day="${day.key}"][data-field="openFlag"]`);
    const openInput = hoursForm?.querySelector(`input[type="time"][data-day="${day.key}"][data-field="open"]`);
    const closeInput = hoursForm?.querySelector(`input[type="time"][data-day="${day.key}"][data-field="close"]`);
    if (checkbox && openInput && closeInput) {
      checkbox.addEventListener('change', () => {
        const enabled = checkbox.checked;
        openInput.disabled = !enabled;
        closeInput.disabled = !enabled;
      });
    }
  });
}

function safeTime(value) {
  if (!value) return '';
  const str = String(value);
  const match = str.match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
  if (match) return `${match[1]}:${match[2]}`;
  const truncated = str.slice(0, 5);
  return truncated.includes(':') ? truncated : '';
}

function mergeHours(data) {
  const base = defaultHours();
  if (!data || typeof data !== 'object') {
    return base;
  }
  for (const day of DAYS) {
    if (data[day.key]) {
      const dayData = data[day.key];
      base[day.key] = {
        openFlag: Boolean(dayData.openFlag),
        open: safeTime(dayData.open),
        close: safeTime(dayData.close),
      };
    }
  }
  return base;
}

function renderHours(hours) {
  state.hours = mergeHours(hours);
  DAYS.forEach((day) => {
    const dayData = state.hours[day.key];
    const checkbox = hoursForm?.querySelector(`input[type="checkbox"][data-day="${day.key}"][data-field="openFlag"]`);
    const openInput = hoursForm?.querySelector(`input[type="time"][data-day="${day.key}"][data-field="open"]`);
    const closeInput = hoursForm?.querySelector(`input[type="time"][data-day="${day.key}"][data-field="close"]`);
    if (!checkbox || !openInput || !closeInput) return;
    checkbox.checked = Boolean(dayData.openFlag);
    openInput.value = safeTime(dayData.open);
    closeInput.value = safeTime(dayData.close);
    const enabled = checkbox.checked;
    openInput.disabled = !enabled;
    closeInput.disabled = !enabled;
  });
}

async function saveHours() {
  if (!state.pharmacyId) return;
  if (!hoursForm) return;

  const payload = {};
  for (const day of DAYS) {
    const checkbox = hoursForm.querySelector(`input[type="checkbox"][data-day="${day.key}"][data-field="openFlag"]`);
    const openInput = hoursForm.querySelector(`input[type="time"][data-day="${day.key}"][data-field="open"]`);
    const closeInput = hoursForm.querySelector(`input[type="time"][data-day="${day.key}"][data-field="close"]`);
    if (!checkbox || !openInput || !closeInput) continue;
    const openFlag = checkbox.checked;
    const open = safeTime(openInput.value);
    const close = safeTime(closeInput.value);
    if (openFlag) {
      if (!open || !close) {
        return displayHoursError('Συμπλήρωσε ώρα έναρξης και λήξης για κάθε ανοιχτή ημέρα.');
      }
      if (close <= open) {
        return displayHoursError('Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.');
      }
    }
    payload[day.key] = { openFlag, open, close };
  }

  displayHoursError('');
  try {
    const { error } = await supabase
      .from('pharmacies')
      .update({ hours: payload })
      .eq('id', state.pharmacyId);
    if (error) throw error;
    state.hours = payload;
    toast('Το ωράριο αποθηκεύτηκε.', 'success');
  } catch (err) {
    console.error(err);
    toast('Δεν ήταν δυνατή η αποθήκευση του ωραρίου.', 'error');
  }
}

function displayHoursError(message) {
  if (!hoursErrorEl) return;
  if (!message) {
    hoursErrorEl.textContent = '';
    hoursErrorEl.style.display = 'none';
    return;
  }
  hoursErrorEl.textContent = message;
  hoursErrorEl.style.display = 'block';
}

async function reloadHours() {
  if (!state.pharmacyId) return;
  try {
    const { data, error } = await supabase
      .from('pharmacies')
      .select('hours')
      .eq('id', state.pharmacyId)
      .maybeSingle();
    if (error) throw error;
    renderHours(data?.hours);
    toast('Το ωράριο ανανεώθηκε.', 'success');
  } catch (err) {
    console.error(err);
    toast('Δεν ήταν δυνατή η ανάκτηση ωραρίου.', 'error');
  }
}

async function reloadRequests() {
  if (!state.pharmacyId) return;
  if (!requestsListEl) return;

  if (requestsErrorEl) {
    requestsErrorEl.textContent = '';
    requestsErrorEl.style.display = 'none';
  }
  requestsListEl.innerHTML = '';

  const loading = document.createElement('div');
  loading.textContent = 'Φόρτωση αιτημάτων...';
  requestsListEl.appendChild(loading);

  const cityFilter = cityFilterInput?.value?.trim() || '';
  try {
    const { data, error } = await supabase
      .from('open_requests_for_pharmacies')
      .select('*')
      .ilike('city', cityFilter ? `%${cityFilter}%` : '%')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    renderRequests(data || []);
  } catch (err) {
    console.error(err);
    requestsListEl.innerHTML = '';
    if (requestsErrorEl) {
      requestsErrorEl.textContent = 'Δεν ήταν δυνατή η φόρτωση των αιτημάτων.';
      requestsErrorEl.style.display = 'block';
    }
  }
}

function renderRequests(requests) {
  if (!requestsListEl) return;
  requestsListEl.innerHTML = '';
  if (!requests || requests.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Δεν βρέθηκαν αιτήματα.';
    requestsListEl.appendChild(empty);
    return;
  }

  requests.forEach((request) => {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.requestId = request.id;

    const header = document.createElement('div');
    header.className = 'request-header';
    const title = document.createElement('strong');
    title.textContent = request.medicine_name || 'Χωρίς όνομα';
    header.appendChild(title);

    const statusSpan = document.createElement('span');
    statusSpan.textContent = request.status || 'pending';
    statusSpan.className = 'badge status-badge';
    header.appendChild(statusSpan);
    card.appendChild(header);

    const details = document.createElement('div');
    details.className = 'request-details';
    details.appendChild(makeDetail('Δραστική ουσία', request.substance));
    details.appendChild(makeDetail('Μορφή', request.type));
    details.appendChild(makeDetail('Ποσότητα', request.quantity));
    details.appendChild(makeDetail('Πόλη', request.city));
    if (request.pickup_until) {
      details.appendChild(makeDetail('Παραλαβή έως', formatDateTime(request.pickup_until)));
    }
    details.appendChild(makeDetail('Δημιουργήθηκε', formatRelative(request.created_at)));
    card.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'request-actions';

    const btnHave = document.createElement('button');
    btnHave.type = 'button';
    btnHave.className = 'available';
    btnHave.textContent = 'Το έχω';
    btnHave.addEventListener('click', () => respondToRequest(card, request.id, 'available', false, btnHave));

    const btnGeneric = document.createElement('button');
    btnGeneric.type = 'button';
    btnGeneric.className = 'generic';
    btnGeneric.textContent = 'Μόνο γενόσημο';
    btnGeneric.addEventListener('click', () => respondToRequest(card, request.id, 'available', true, btnGeneric));

    const btnNo = document.createElement('button');
    btnNo.type = 'button';
    btnNo.className = 'unavailable';
    btnNo.textContent = 'Δεν το έχω';
    btnNo.addEventListener('click', () => respondToRequest(card, request.id, 'unavailable', false, btnNo));

    actions.appendChild(btnHave);
    actions.appendChild(btnGeneric);
    actions.appendChild(btnNo);
    card.appendChild(actions);

    requestsListEl.appendChild(card);
  });
}

function makeDetail(label, value) {
  const row = document.createElement('div');
  row.className = 'request-detail-row';
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  row.appendChild(strong);
  const span = document.createElement('span');
  span.textContent = value !== undefined && value !== null && value !== '' ? value : '—';
  row.appendChild(span);
  return row;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('el-GR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  const now = Date.now();
  let diff = Math.round((date.getTime() - now) / 1000);
  const absDiff = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('el', { numeric: 'auto' });
  if (absDiff < 60) {
    return rtf.format(Math.round(diff), 'second');
  }
  diff = Math.round(diff / 60);
  if (Math.abs(diff) < 60) {
    return rtf.format(diff, 'minute');
  }
  diff = Math.round(diff / 60);
  if (Math.abs(diff) < 24) {
    return rtf.format(diff, 'hour');
  }
  diff = Math.round(diff / 24);
  if (Math.abs(diff) < 30) {
    return rtf.format(diff, 'day');
  }
  const months = Math.round(diff / 30);
  if (Math.abs(months) < 12) {
    return rtf.format(months, 'month');
  }
  const years = Math.round(months / 12);
  return rtf.format(years, 'year');
}

async function respondToRequest(card, requestId, kind, genericOnly, button) {
  if (!state.pharmacyId) return;
  if (!requestId) return;
  if (button) {
    button.disabled = true;
  }
  try {
    const payload = {
      request_id: requestId,
      pharmacy_id: state.pharmacyId,
      kind,
      generic_only: genericOnly,
    };
    const { error } = await supabase
      .from('responses')
      .insert(payload)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        const { error: updateError } = await supabase
          .from('responses')
          .update({ kind, generic_only: genericOnly })
          .eq('request_id', requestId)
          .eq('pharmacy_id', state.pharmacyId);
        if (updateError) throw updateError;
      } else {
        throw error;
      }
    }
    markRequestAnswered(card);
    toast('Η απάντηση καταχωρήθηκε.', 'success');
  } catch (err) {
    console.error(err);
    toast('Δεν ήταν δυνατή η αποστολή απάντησης.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function markRequestAnswered(card) {
  if (!card) return;
  let badge = card.querySelector('.badge.answer-badge');
  if (!badge) {
    const header = card.querySelector('.request-header');
    if (!header) return;
    badge = document.createElement('span');
    badge.className = 'badge answer-badge';
    badge.textContent = 'Απαντήθηκε';
    header.appendChild(badge);
  }
}

async function createDemoRequest() {
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user?.id;
  if (!userId) {
    toast('Πρέπει να είσαι συνδεδεμένος.', 'error');
    return;
  }
  try {
    demoBtn?.setAttribute('disabled', 'true');
    const { error } = await supabase.from('requests').insert({
      user_id: userId,
      city: 'DEMO CITY',
      medicine_name: 'Demozin 500mg tabs',
      substance: 'demo-cillin',
      type: 'tabs',
      quantity: 1,
      allow_generic: true,
      status: 'pending',
    });
    if (error) throw error;
    toast('Δημιουργήθηκε demo αίτημα.', 'success');
    await reloadRequests();
  } catch (err) {
    console.error(err);
    toast('Δεν ήταν δυνατή η δημιουργία demo αιτήματος.', 'error');
  } finally {
    demoBtn?.removeAttribute('disabled');
  }
}

function toast(message, type = 'info') {
  if (!toastContainer) return;
  const item = document.createElement('div');
  item.className = `toast${type === 'error' ? ' error' : type === 'success' ? ' success' : ''}`;
  item.textContent = message;
  toastContainer.appendChild(item);
  setTimeout(() => {
    item.remove();
  }, 4000);
}

async function ensurePharmacy(user) {
  const { data, error } = await supabase
    .from('pharmacies')
    .select('id, hours')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (data) {
    return data;
  }
  const { data: created, error: insertError } = await supabase
    .from('pharmacies')
    .insert({ owner_id: user.id, name: '', is_pro_active: false, hours: defaultHours() })
    .select('id, hours')
    .single();
  if (insertError) {
    throw insertError;
  }
  return created;
}

async function boot(user) {
  try {
    const pharmacy = await ensurePharmacy(user);
    state.pharmacyId = pharmacy.id;
    state.currentUserId = user.id;
    renderHours(pharmacy.hours);
    bindStaticListeners();
    await reloadRequests();
  } catch (err) {
    console.error(err);
    toast('Δεν ήταν δυνατή η φόρτωση δεδομένων φαρμακείου.', 'error');
  }
}

function handleSession(session) {
  const user = session?.user;
  if (user) {
    showPortal(true);
    showAuthCard(false);
    if (userEmailEl) {
      userEmailEl.textContent = user.email || '';
    }
    if (state.currentUserId !== user.id) {
      state.pharmacyId = null;
      resetPortalView();
      boot(user);
    } else {
      reloadRequests();
    }
  } else {
    state.currentUserId = null;
    state.pharmacyId = null;
    showPortal(false);
    showAuthCard(true);
    resetPortalView();
    if (userEmailEl) {
      userEmailEl.textContent = '';
    }
  }
}

async function init() {
  bindStaticListeners();
  const { data } = await supabase.auth.getSession();
  handleSession(data.session);
  supabase.auth.onAuthStateChange((_event, newSession) => {
    handleSession(newSession);
  });
}

init();
