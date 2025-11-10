const ENV = window.ENV || {};
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;

if (!window.supabase) {
  throw new Error('Supabase library not loaded');
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase configuration missing');
}

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { auth: { persistSession: true } }
);

const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const dayLabels = {
  mon: 'Δευτέρα',
  tue: 'Τρίτη',
  wed: 'Τετάρτη',
  thu: 'Πέμπτη',
  fri: 'Παρασκευή',
  sat: 'Σάββατο',
  sun: 'Κυριακή'
};

const els = {
  authCard: document.getElementById('auth-card'),
  portal: document.getElementById('portal'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  btnLoginPassword: document.getElementById('btn-login-password'),
  btnLoginMagic: document.getElementById('btn-login-magic'),
  btnLoginGoogle: document.getElementById('btn-login-google'),
  btnSignout: document.getElementById('btn-signout'),
  userEmail: document.getElementById('user-email'),
  cityFilter: document.getElementById('city-filter'),
  btnLoad: document.getElementById('btn-load'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnDemo: document.getElementById('btn-demo'),
  requestsError: document.getElementById('requests-error'),
  requestsList: document.getElementById('requests-list'),
  hoursForm: document.getElementById('hours-form'),
  btnHoursSave: document.getElementById('btn-hours-save'),
  btnHoursReload: document.getElementById('btn-hours-reload'),
  toast: document.getElementById('toast')
};

days.forEach((day) => {
  els[`row_${day}`] = document.getElementById(`day-${day}`);
});

const state = {
  session: null,
  user: null,
  pharmacyId: null,
  hoursMap: createEmptyHoursMap(),
  bootPromise: null
};

let toastTimer = null;

function createEmptyDay() {
  return { openFlag: false, open: '', close: '' };
}

function createEmptyHoursMap() {
  return days.reduce((acc, day) => {
    acc[day] = createEmptyDay();
    return acc;
  }, {});
}

function normalizeHoursMap(source) {
  const hours = createEmptyHoursMap();
  if (!source || typeof source !== 'object') {
    return hours;
  }
  days.forEach((day) => {
    const entry = source[day];
    if (entry && typeof entry === 'object') {
      hours[day] = {
        openFlag: Boolean(entry.openFlag),
        open: entry.open || '',
        close: entry.close || ''
      };
    }
  });
  return hours;
}

function cloneHoursMap(map) {
  return JSON.parse(JSON.stringify(map));
}

function showAuth() {
  if (els.portal) {
    els.portal.classList.add('hidden');
    els.portal.style.display = 'none';
  }
  if (els.authCard) {
    els.authCard.classList.remove('hidden');
    els.authCard.style.display = '';
  }
}

function showPortal(user) {
  if (els.authCard) {
    els.authCard.classList.add('hidden');
    els.authCard.style.display = 'none';
  }
  if (els.portal) {
    els.portal.classList.remove('hidden');
    els.portal.style.display = '';
  }
  if (els.userEmail) {
    els.userEmail.textContent = user?.email || '';
  }
}

function toast(message, type = 'info') {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.dataset.type = type;
  els.toast.classList.remove('info', 'success', 'error', 'show');
  els.toast.classList.add(type);
  void els.toast.offsetWidth;
  els.toast.classList.add('show');
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2500);
}

function relTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'πριν λίγα δευτερόλεπτα';
  if (diffMinutes < 60) return `πριν ${diffMinutes} λεπτά`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `πριν ${diffHours} ώρες`;
  const diffDays = Math.floor(diffHours / 24);
  return `πριν ${diffDays} ημέρες`;
}

function setRequestsError(message) {
  if (!els.requestsError) return;
  els.requestsError.textContent = message || '';
  if (message) {
    els.requestsError.classList.remove('hidden');
    els.requestsError.style.display = '';
  } else {
    els.requestsError.classList.add('hidden');
    els.requestsError.style.display = 'none';
  }
}

function clearRequestsList() {
  if (els.requestsList) {
    els.requestsList.innerHTML = '';
  }
}

function renderRequests(rows = []) {
  clearRequestsList();
  if (!els.requestsList) return;
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'text-slate-500';
    empty.textContent = 'Δεν βρέθηκαν αιτήματα.';
    els.requestsList.appendChild(empty);
    return;
  }
  rows.forEach((row) => {
    const card = document.createElement('article');
    card.className = 'request-card';
    card.dataset.requestId = row.id;

    const header = document.createElement('header');
    header.className = 'request-card__header';
    const title = document.createElement('h3');
    title.textContent = row.medicine_name || '—';
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'request-card__subtitle';
    subtitle.textContent = row.substance ? `${row.substance} • ${row.type || ''}` : (row.type || '');

    const details = document.createElement('ul');
    details.className = 'request-card__meta';
    const items = [
      { label: 'Ποσότητα', value: row.quantity },
      { label: 'Πόλη', value: row.city },
      { label: 'Κατάσταση', value: row.status },
      { label: 'Ημ/νία', value: relTime(row.created_at) }
    ];
    items.forEach((item) => {
      if (item.value === undefined || item.value === null || item.value === '') return;
      const li = document.createElement('li');
      li.innerHTML = `<strong>${item.label}:</strong> ${item.value}`;
      details.appendChild(li);
    });

    const actions = document.createElement('div');
    actions.className = 'request-card__actions';

    const btnHave = document.createElement('button');
    btnHave.type = 'button';
    btnHave.textContent = 'Το έχω';
    btnHave.className = 'btn-request btn-positive';
    btnHave.addEventListener('click', () => respond(row.id, 'available', false, card));

    const btnGeneric = document.createElement('button');
    btnGeneric.type = 'button';
    btnGeneric.textContent = 'Μόνο γενόσημο';
    btnGeneric.className = 'btn-request btn-generic';
    btnGeneric.addEventListener('click', () => respond(row.id, 'generic', true, card));

    const btnNo = document.createElement('button');
    btnNo.type = 'button';
    btnNo.textContent = 'Δεν το έχω';
    btnNo.className = 'btn-request btn-negative';
    btnNo.addEventListener('click', () => respond(row.id, 'unavailable', false, card));

    actions.appendChild(btnHave);
    actions.appendChild(btnGeneric);
    actions.appendChild(btnNo);

    card.appendChild(header);
    card.appendChild(subtitle);
    card.appendChild(details);
    card.appendChild(actions);

    els.requestsList.appendChild(card);
  });
}

function markCardAnswered(card, kind) {
  if (!card) return;
  card.classList.add('answered');
  const existing = card.querySelector('.request-card__status');
  if (existing) {
    existing.textContent = `Απαντήθηκε: ${kind}`;
  } else {
    const status = document.createElement('p');
    status.className = 'request-card__status';
    status.textContent = `Απαντήθηκε: ${kind}`;
    card.appendChild(status);
  }
  card.querySelectorAll('button').forEach((btn) => {
    btn.disabled = true;
  });
}

function getHoursInputs(day) {
  const row = els[`row_${day}`];
  if (!row) return {};
  const selector = `[data-day="${day}"]`;
  return {
    openFlag: row.querySelector(`${selector}[data-field="openFlag"]`),
    open: row.querySelector(`${selector}[data-field="open"]`),
    close: row.querySelector(`${selector}[data-field="close"]`)
  };
}

function renderHours() {
  days.forEach((day) => {
    const entry = state.hoursMap[day] || createEmptyDay();
    const inputs = getHoursInputs(day);
    if (!inputs.openFlag || !inputs.open || !inputs.close) {
      return;
    }
    inputs.openFlag.checked = Boolean(entry.openFlag);
    inputs.open.value = entry.open || '';
    inputs.close.value = entry.close || '';
    inputs.open.disabled = !inputs.openFlag.checked;
    inputs.close.disabled = !inputs.openFlag.checked;
  });
}

function handleHoursInput(event) {
  const target = event.target;
  if (!target || !target.dataset) return;
  const day = target.dataset.day;
  const field = target.dataset.field;
  if (!day || !field || !state.hoursMap[day]) return;

  const entry = state.hoursMap[day];
  if (field === 'openFlag') {
    entry.openFlag = target.checked;
    const inputs = getHoursInputs(day);
    if (inputs.open) inputs.open.disabled = !entry.openFlag;
    if (inputs.close) inputs.close.disabled = !entry.openFlag;
  } else if (field === 'open' || field === 'close') {
    entry[field] = target.value || '';
  }
}

function validateHours(map) {
  for (const day of days) {
    const entry = map[day];
    if (!entry || !entry.openFlag) continue;
    if (!entry.open || !entry.close) {
      throw new Error(`Συμπληρώστε ώρες για ${dayLabels[day]}.`);
    }
    if (entry.close <= entry.open) {
      throw new Error(`Η ώρα κλεισίματος πρέπει να είναι μετά την ώρα ανοίγματος για ${dayLabels[day]}.`);
    }
  }
}

async function saveHours() {
  if (!state.pharmacyId) {
    toast('Δεν βρέθηκε φαρμακείο.', 'error');
    return;
  }
  const payload = cloneHoursMap(state.hoursMap);
  try {
    validateHours(payload);
    const { error } = await sb
      .from('pharmacies')
      .update({ hours: payload })
      .eq('id', state.pharmacyId);
    if (error) throw error;
    toast('Το ωράριο αποθηκεύτηκε.', 'success');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία αποθήκευσης ωραρίου.', 'error');
  }
}

async function reloadHoursFromDB() {
  if (!state.user) return;
  try {
    const { data, error } = await sb
      .from('pharmacies')
      .select('id,hours')
      .eq('owner_id', state.user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      state.pharmacyId = data.id;
      state.hoursMap = normalizeHoursMap(data.hours);
      renderHours();
      toast('Το ωράριο ενημερώθηκε.', 'success');
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία φόρτωσης ωραρίου.', 'error');
  }
}

async function ensurePharmacy(user) {
  const { data, error } = await sb
    .from('pharmacies')
    .select('id,hours,name')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: inserted, error: insertError } = await sb
    .from('pharmacies')
    .insert({ owner_id: user.id, name: '', hours: {} })
    .select('id,hours,name')
    .single();
  if (insertError) throw insertError;
  return inserted;
}

async function reloadRequests() {
  if (!state.user) return;
  setRequestsError('');
  clearRequestsList();
  const city = (els.cityFilter?.value || '').trim();
  try {
    let query = sb
      .from('open_requests_for_pharmacies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    renderRequests(data || []);
  } catch (error) {
    console.error(error);
    setRequestsError(error.message || 'Αποτυχία φόρτωσης αιτημάτων.');
  }
}

async function respond(requestId, kind, genericOnly, card) {
  if (!state.pharmacyId) {
    toast('Δεν έχει καταχωρηθεί φαρμακείο.', 'error');
    return;
  }
  try {
    const payload = {
      request_id: requestId,
      pharmacy_id: state.pharmacyId,
      kind,
      generic_only: genericOnly
    };
    const insertResult = await sb
      .from('responses')
      .insert(payload)
      .select()
      .single();
    if (insertResult.error && insertResult.error.code !== '23505') {
      throw insertResult.error;
    }
    if (insertResult.error && insertResult.error.code === '23505') {
      const { error: updateError } = await sb
        .from('responses')
        .update({ kind, generic_only: genericOnly })
        .eq('request_id', requestId)
        .eq('pharmacy_id', state.pharmacyId);
      if (updateError) throw updateError;
    }
    toast('Η απάντηση καταχωρήθηκε.', 'success');
    markCardAnswered(card || document.querySelector(`[data-request-id="${requestId}"]`), kind);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία καταχώρησης απάντησης.', 'error');
  }
}

async function insertDemoRequest() {
  if (!state.user) {
    toast('Απαιτείται σύνδεση.', 'error');
    return;
  }
  try {
    const payload = {
      user_id: state.user.id,
      city: 'DEMO CITY',
      medicine_name: 'Demozin 500mg tabs',
      substance: 'demo-cillin',
      type: 'tabs',
      quantity: 1,
      allow_generic: true,
      status: 'pending'
    };
    const { error } = await sb
      .from('requests')
      .insert(payload);
    if (error) throw error;
    toast('Προστέθηκε demo αίτημα.', 'success');
    await reloadRequests();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία δημιουργίας demo αιτήματος.', 'error');
  }
}

async function boot(user) {
  if (state.bootPromise) {
    return state.bootPromise;
  }
  state.bootPromise = (async () => {
    try {
      const pharmacy = await ensurePharmacy(user);
      state.pharmacyId = pharmacy.id;
      state.hoursMap = normalizeHoursMap(pharmacy.hours);
      renderHours();
      await reloadRequests();
    } finally {
      state.bootPromise = null;
    }
  })();
  return state.bootPromise;
}

function resetState() {
  state.session = null;
  state.user = null;
  state.pharmacyId = null;
  state.hoursMap = createEmptyHoursMap();
  renderHours();
  clearRequestsList();
  setRequestsError('');
}

function bindEvents() {
  if (els.hoursForm) {
    els.hoursForm.addEventListener('change', handleHoursInput);
    els.hoursForm.addEventListener('input', handleHoursInput);
  }
  if (els.btnHoursSave) {
    els.btnHoursSave.addEventListener('click', (event) => {
      event.preventDefault();
      saveHours();
    });
  }
  if (els.btnHoursReload) {
    els.btnHoursReload.addEventListener('click', (event) => {
      event.preventDefault();
      reloadHoursFromDB();
    });
  }
  if (els.btnLoad) {
    els.btnLoad.addEventListener('click', (event) => {
      event.preventDefault();
      reloadRequests();
    });
  }
  if (els.btnRefresh) {
    els.btnRefresh.addEventListener('click', (event) => {
      event.preventDefault();
      reloadRequests();
    });
  }
  if (els.btnDemo) {
    els.btnDemo.addEventListener('click', (event) => {
      event.preventDefault();
      insertDemoRequest();
    });
  }
  if (els.btnSignout) {
    els.btnSignout.addEventListener('click', async (event) => {
      event.preventDefault();
      await sb.auth.signOut();
    });
  }
  if (els.btnLoginPassword) {
    els.btnLoginPassword.addEventListener('click', async (event) => {
      event.preventDefault();
      const email = els.authEmail?.value?.trim();
      const password = els.authPassword?.value || '';
      if (!email || !password) {
        toast('Συμπληρώστε email και κωδικό.', 'error');
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        console.error(error);
        toast(error.message || 'Αποτυχία σύνδεσης.', 'error');
      }
    });
  }
  if (els.btnLoginMagic) {
    els.btnLoginMagic.addEventListener('click', async (event) => {
      event.preventDefault();
      const email = els.authEmail?.value?.trim();
      if (!email) {
        toast('Συμπληρώστε email.', 'error');
        return;
      }
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/pharmacy.html`
        }
      });
      if (error) {
        console.error(error);
        toast(error.message || 'Αποτυχία αποστολής magic link.', 'error');
      } else {
        toast('Στάλθηκε email με σύνδεσμο.', 'success');
      }
    });
  }
  if (els.btnLoginGoogle) {
    els.btnLoginGoogle.addEventListener('click', async (event) => {
      event.preventDefault();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/pharmacy.html`
        }
      });
      if (error) {
        console.error(error);
        toast(error.message || 'Αποτυχία σύνδεσης με Google.', 'error');
      }
    });
  }
}

async function exchangeCodeIfPresent() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return;
  try {
    await sb.auth.exchangeCodeForSession({ code });
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία ολοκλήρωσης σύνδεσης.', 'error');
  } finally {
    url.searchParams.delete('code');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

async function initAuth() {
  await exchangeCodeIfPresent();
  const { data } = await sb.auth.getSession();
  const session = data?.session || null;
  state.session = session;
  state.user = session?.user || null;
  if (state.user) {
    showPortal(state.user);
    await boot(state.user);
  } else {
    showAuth();
  }
  sb.auth.onAuthStateChange(async (event, sessionInfo) => {
    if (event === 'SIGNED_IN') {
      state.session = sessionInfo;
      state.user = sessionInfo?.user || null;
      if (state.user) {
        showPortal(state.user);
        await boot(state.user);
      }
    } else if (event === 'SIGNED_OUT') {
      resetState();
      showAuth();
    }
  });
}

function main() {
  bindEvents();
  renderHours();
  initAuth().catch((error) => {
    console.error(error);
    toast(error.message || 'Σφάλμα αρχικοποίησης.', 'error');
  });
}

main();
