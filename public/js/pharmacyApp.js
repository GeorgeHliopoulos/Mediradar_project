const ENV = window.ENV || {};
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;

if (!window.supabase) {
  throw new Error('Supabase library not loaded');
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
});

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = {
  mon: 'Δευτέρα',
  tue: 'Τρίτη',
  wed: 'Τετάρτη',
  thu: 'Πέμπτη',
  fri: 'Παρασκευή',
  sat: 'Σάββατο',
  sun: 'Κυριακή',
};

const state = {
  sb,
  activeUserId: null,
  pharmacyId: null,
  hoursMap: null,
  bootPromises: Object.create(null),
  subs: [],
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
};

const dayRows = DAYS.reduce((acc, key) => {
  acc[key] = document.getElementById(`day-${key}`);
  return acc;
}, {});

let listenersBound = false;

function guard(userId) {
  if (!userId || state.activeUserId !== userId) {
    throw new Error('Session changed');
  }
}

function resetState() {
  state.activeUserId = null;
  state.pharmacyId = null;
  state.hoursMap = null;
  state.subs.forEach((unsubscribe) => {
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
    } catch (error) {
      console.warn('Failed to unsubscribe', error);
    }
  });
  state.subs.length = 0;
  state.bootPromises = Object.create(null);
  if (els.userEmail) {
    els.userEmail.textContent = '';
  }
  if (els.requestsList) {
    els.requestsList.innerHTML = '';
  }
  if (els.requestsError) {
    els.requestsError.textContent = '';
    els.requestsError.classList.add('hidden');
  }
  if (els.hoursForm) {
    const inputs = els.hoursForm.querySelectorAll('[data-day][data-field]');
    inputs.forEach((input) => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });
  }
}

function getBootPromise(user) {
  const key = user.id;
  if (!state.bootPromises[key]) {
    state.bootPromises[key] = (async () => {
      try {
        await doBoot(user);
      } catch (error) {
        if (error && error.message === 'Session changed') {
          return;
        }
        console.error('Boot failed', error);
        toast('Αποτυχία φόρτωσης δεδομένων.', 'error');
        delete state.bootPromises[key];
      }
    })();
  }
  return state.bootPromises[key];
}

function createEmptyDay() {
  return { openFlag: false, open: '', close: '' };
}

function createDefaultHoursMap() {
  return DAYS.reduce((acc, day) => {
    acc[day] = createEmptyDay();
    return acc;
  }, {});
}

function normalizeHoursMap(source) {
  const normalized = createDefaultHoursMap();
  if (!source || typeof source !== 'object') {
    return normalized;
  }
  DAYS.forEach((day) => {
    const entry = source[day];
    if (entry && typeof entry === 'object') {
      normalized[day] = {
        openFlag: Boolean(entry.openFlag),
        open: typeof entry.open === 'string' ? entry.open : '',
        close: typeof entry.close === 'string' ? entry.close : '',
      };
    }
  });
  return normalized;
}

function showAuth() {
  if (els.portal) {
    els.portal.classList.add('hidden');
  }
  if (els.authCard) {
    els.authCard.classList.remove('hidden');
    els.authCard.style.display = '';
  }
}

function showPortal(user) {
  if (els.userEmail) {
    els.userEmail.textContent = user.email || '';
  }
  if (els.authCard) {
    els.authCard.classList.add('hidden');
  }
  if (els.portal) {
    els.portal.classList.remove('hidden');
    els.portal.style.display = '';
  }
}

function toast(message, type = 'info') {
  const prefix = type === 'error' ? '[Error]' : type === 'success' ? '[OK]' : '[Info]';
  console.log(`${prefix} ${message}`);
}

function relTime(iso) {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  const diffInSeconds = (value.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('el', { numeric: 'auto' });
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Infinity, unit: 'year' },
  ];
  let duration = diffInSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return '';
}

async function handleOAuthCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (code) {
    try {
      const { error } = await sb.auth.exchangeCodeForSession({ code });
      if (error) throw error;
    } catch (error) {
      console.error('OAuth exchange failed', error);
      toast('Η σύνδεση απέτυχε.', 'error');
    }
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    const cleaned = `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}${url.hash}`;
    window.history.replaceState({}, document.title, cleaned);
  }
}

function renderHours(userId) {
  guard(userId);
  if (!els.hoursForm || !state.hoursMap) return;
  DAYS.forEach((day) => {
    const row = dayRows[day];
    if (!row) return;
    const openFlagEl = row.querySelector(`[data-day="${day}"][data-field="openFlag"]`);
    const openEl = row.querySelector(`[data-day="${day}"][data-field="open"]`);
    const closeEl = row.querySelector(`[data-day="${day}"][data-field="close"]`);
    const dayData = state.hoursMap[day] || createEmptyDay();
    if (openFlagEl) openFlagEl.checked = Boolean(dayData.openFlag);
    if (openEl) openEl.value = dayData.open || '';
    if (closeEl) closeEl.value = dayData.close || '';
  });
}

function collectHours() {
  const hours = createDefaultHoursMap();
  DAYS.forEach((day) => {
    const row = dayRows[day];
    if (!row) return;
    const openFlagEl = row.querySelector(`[data-day="${day}"][data-field="openFlag"]`);
    const openEl = row.querySelector(`[data-day="${day}"][data-field="open"]`);
    const closeEl = row.querySelector(`[data-day="${day}"][data-field="close"]`);
    hours[day] = {
      openFlag: Boolean(openFlagEl && openFlagEl.checked),
      open: openEl && openEl.value ? openEl.value : '',
      close: closeEl && closeEl.value ? closeEl.value : '',
    };
  });
  return hours;
}

function validateHours(hours) {
  for (const day of DAYS) {
    const entry = hours[day];
    if (!entry) continue;
    if (entry.openFlag) {
      if (!entry.open || !entry.close) {
        return { valid: false, message: `Συμπληρώστε ώρες για ${DAY_LABELS[day]}.` };
      }
      if (entry.close <= entry.open) {
        return { valid: false, message: `Η ώρα κλεισίματος πρέπει να είναι μετά την ώρα ανοίγματος για ${DAY_LABELS[day]}.` };
      }
    }
  }
  return { valid: true };
}

async function ensurePharmacy(user) {
  guard(user.id);
  const { data, error } = await sb
    .from('pharmacies')
    .select('id, hours')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    state.pharmacyId = data.id;
    state.hoursMap = normalizeHoursMap(data.hours);
    return;
  }
  const { data: insertData, error: insertError } = await sb
    .from('pharmacies')
    .insert({ owner_id: user.id, name: '', hours: createDefaultHoursMap() })
    .select('id, hours')
    .single();
  if (insertError) throw insertError;
  state.pharmacyId = insertData.id;
  state.hoursMap = normalizeHoursMap(insertData.hours);
}

async function saveHours(user) {
  guard(user.id);
  const newHours = collectHours();
  const { valid, message } = validateHours(newHours);
  if (!valid) {
    toast(message, 'error');
    return;
  }
  const { error } = await sb
    .from('pharmacies')
    .update({ hours: newHours })
    .eq('id', state.pharmacyId);
  if (error) {
    console.error('Failed to update hours', error);
    toast('Αποτυχία αποθήκευσης ωραρίου.', 'error');
    return;
  }
  state.hoursMap = newHours;
  toast('Το ωράριο αποθηκεύτηκε.', 'success');
}

async function reloadHours(user) {
  guard(user.id);
  const { data, error } = await sb
    .from('pharmacies')
    .select('id, hours')
    .eq('id', state.pharmacyId)
    .maybeSingle();
  if (error) {
    console.error('Failed to reload hours', error);
    toast('Αποτυχία φόρτωσης ωραρίου.', 'error');
    return;
  }
  if (data) {
    state.hoursMap = normalizeHoursMap(data.hours);
    renderHours(user.id);
  }
}

function setRequestsError(message) {
  if (!els.requestsError) return;
  if (!message) {
    els.requestsError.textContent = '';
    els.requestsError.classList.add('hidden');
    return;
  }
  els.requestsError.textContent = message;
  els.requestsError.classList.remove('hidden');
}

function buildRequestCard(req) {
  const card = document.createElement('article');
  card.className = 'request-card';
  card.dataset.requestId = req.id;

  const header = document.createElement('header');
  header.textContent = req.medicine_name || 'Χωρίς τίτλο';
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'request-meta';
  meta.innerHTML = `Δραστική: <strong>${req.substance || '—'}</strong> · Τύπος: ${
    req.type || '—'
  } · Ποσότητα: ${req.quantity || '—'} · Πόλη: ${req.city || '—'} · Κατάσταση: ${
    req.status || '—'
  } · ${relTime(req.created_at)}`;
  card.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'request-actions';

  const btnAvailable = document.createElement('button');
  btnAvailable.type = 'button';
  btnAvailable.textContent = 'Το έχω';
  btnAvailable.addEventListener('click', () => respond(req.id, 'available', false));

  const btnGeneric = document.createElement('button');
  btnGeneric.type = 'button';
  btnGeneric.textContent = 'Μόνο γενόσημο';
  btnGeneric.addEventListener('click', () => respond(req.id, 'generic', true));

  const btnUnavailable = document.createElement('button');
  btnUnavailable.type = 'button';
  btnUnavailable.textContent = 'Δεν το έχω';
  btnUnavailable.addEventListener('click', () => respond(req.id, 'unavailable', false));

  actions.append(btnAvailable, btnGeneric, btnUnavailable);
  card.appendChild(actions);

  return card;
}

async function reloadRequests() {
  if (!state.activeUserId) return;
  guard(state.activeUserId);
  if (!els.requestsList) return;
  setRequestsError('');
  els.requestsList.textContent = '';
  let query = sb
    .from('open_requests_for_pharmacies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  const city = (els.cityFilter?.value || '').trim();
  if (city) {
    query = query.ilike('city', `%${city}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Failed to load requests', error);
    setRequestsError('Αποτυχία φόρτωσης αιτημάτων.');
    return;
  }
  const fragment = document.createDocumentFragment();
  (data || []).forEach((item) => {
    fragment.appendChild(buildRequestCard(item));
  });
  els.requestsList.appendChild(fragment);
  if (!data || data.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'Δεν υπάρχουν αιτήματα.';
    els.requestsList.appendChild(empty);
  }
}

async function respond(requestId, kind, genericOnly) {
  if (!state.activeUserId) return;
  guard(state.activeUserId);
  if (!state.pharmacyId) {
    toast('Δεν βρέθηκε φαρμακείο.', 'error');
    return;
  }
  const payload = {
    request_id: requestId,
    pharmacy_id: state.pharmacyId,
    kind,
    generic_only: genericOnly,
  };
  try {
    const { error, data } = await sb
      .from('responses')
      .insert(payload)
      .select()
      .single();
    if (error && error.code !== '23505') {
      throw error;
    }
    if (error && error.code === '23505') {
      const { error: updateError } = await sb
        .from('responses')
        .update({ kind, generic_only: genericOnly })
        .eq('request_id', requestId)
        .eq('pharmacy_id', state.pharmacyId);
      if (updateError) throw updateError;
    }
    markRequestResponded(requestId);
    toast('Η απάντηση καταχωρήθηκε.', 'success');
  } catch (error) {
    console.error('Failed to submit response', error);
    toast('Αποτυχία καταχώρησης απάντησης.', 'error');
  }
}

function markRequestResponded(requestId) {
  if (!els.requestsList) return;
  const card = els.requestsList.querySelector(`[data-request-id="${requestId}"]`);
  if (!card) return;
  const banner = document.createElement('div');
  banner.textContent = 'Απαντήθηκε';
  banner.style.marginTop = '0.75rem';
  banner.style.fontWeight = '600';
  card.appendChild(banner);
  card.querySelectorAll('button').forEach((btn) => {
    btn.disabled = true;
  });
}

async function insertDemoRequest(user) {
  guard(user.id);
  const demo = {
    user_id: user.id,
    medicine_name: 'Demo Φάρμακο',
    substance: 'Demo Substance',
    type: 'Δισκία',
    quantity: '1',
    city: 'Αθήνα',
    status: 'open',
  };
  const { error } = await sb.from('requests').insert(demo);
  if (error) {
    console.error('Failed to insert demo request', error);
    toast('Η δημιουργία demo αιτήματος απέτυχε.', 'error');
    return;
  }
  toast('Δημιουργήθηκε demo αίτημα.', 'success');
  await reloadRequests();
}

async function doBoot(user) {
  guard(user.id);
  await ensurePharmacy(user);
  guard(user.id);
  if (!state.hoursMap) {
    state.hoursMap = createDefaultHoursMap();
  }
  renderHours(user.id);
  await reloadRequests();
  console.log('PharmacyApp v=2025-11-10-1', user.email);
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  if (els.btnLoginPassword) {
    els.btnLoginPassword.addEventListener('click', async () => {
      const email = els.authEmail?.value?.trim();
      const password = els.authPassword?.value || '';
      if (!email || !password) {
        toast('Συμπληρώστε email και κωδικό.', 'error');
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Password login failed', error);
        toast('Η σύνδεση με κωδικό απέτυχε.', 'error');
      }
    });
  }

  if (els.btnLoginMagic) {
    els.btnLoginMagic.addEventListener('click', async () => {
      const email = els.authEmail?.value?.trim();
      if (!email) {
        toast('Συμπληρώστε email.', 'error');
        return;
      }
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/pharmacy.html`,
        },
      });
      if (error) {
        console.error('Magic link failed', error);
        toast('Αποστολή magic link απέτυχε.', 'error');
        return;
      }
      toast('Στάλθηκε magic link στο email σας.', 'success');
    });
  }

  if (els.btnLoginGoogle) {
    els.btnLoginGoogle.addEventListener('click', async () => {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/pharmacy.html`,
        },
      });
      if (error) {
        console.error('Google OAuth failed', error);
        toast('Η σύνδεση με Google απέτυχε.', 'error');
      }
    });
  }

  if (els.btnSignout) {
    els.btnSignout.addEventListener('click', async () => {
      const { error } = await sb.auth.signOut();
      if (error) {
        console.error('Sign out failed', error);
        toast('Η αποσύνδεση απέτυχε.', 'error');
      }
    });
  }

  if (els.btnRefresh) {
    els.btnRefresh.addEventListener('click', () => {
      reloadRequests();
    });
  }

  if (els.btnLoad) {
    els.btnLoad.addEventListener('click', () => {
      reloadRequests();
    });
  }

  if (els.btnDemo) {
    els.btnDemo.addEventListener('click', async () => {
      if (!state.activeUserId) return;
      const { data } = await sb.auth.getUser();
      const user = data?.user;
      if (!user) return;
      try {
        await insertDemoRequest(user);
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (els.btnHoursSave) {
    els.btnHoursSave.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!state.activeUserId) return;
      const { data } = await sb.auth.getUser();
      const user = data?.user;
      if (!user) return;
      try {
        await saveHours(user);
      } catch (error) {
        if (error && error.message === 'Session changed') return;
        console.error(error);
      }
    });
  }

  if (els.btnHoursReload) {
    els.btnHoursReload.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!state.activeUserId) return;
      const { data } = await sb.auth.getUser();
      const user = data?.user;
      if (!user) return;
      try {
        await reloadHours(user);
      } catch (error) {
        if (error && error.message === 'Session changed') return;
        console.error(error);
      }
    });
  }
}

async function boot(user) {
  state.activeUserId = user.id;
  await getBootPromise(user);
}

async function init() {
  bindListeners();
  await handleOAuthCallback();

  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData?.session;
  if (session?.user) {
    state.activeUserId = session.user.id;
    showPortal(session.user);
    await boot(session.user);
  } else {
    showAuth();
  }

  const { data: listener } = sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      state.activeUserId = session.user.id;
      showPortal(session.user);
      await boot(session.user);
    }
    if (event === 'SIGNED_OUT') {
      resetState();
      showAuth();
    }
  });
  if (listener?.subscription) {
    state.subs.push(() => listener.subscription.unsubscribe());
  }
}

init().catch((error) => {
  console.error('Initialization failed', error);
  toast('Κάτι πήγε στραβά κατά την εκκίνηση.', 'error');
});
