const ENV = window.ENV || {};
if (!window.supabase) {
  throw new Error('Supabase library not loaded');
}
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration');
}
const sb = supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});

const state = {
  sb,
  activeUserId: null,
  pharmacyId: null,
  hoursMap: null,
  bootPromises: Object.create(null),
  subs: []
};

const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const ui = {
  authCard: document.getElementById('auth-card'),
  portal: document.getElementById('portal'),
  userEmail: document.getElementById('user-email'),
  proBanner: document.getElementById('pro-banner'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  btnLoginPassword: document.getElementById('btn-login-password'),
  btnLoginMagic: document.getElementById('btn-login-magic'),
  btnLoginGoogle: document.getElementById('btn-login-google'),
  btnSignout: document.getElementById('btn-signout'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnDemo: document.getElementById('btn-demo'),
  btnLoad: document.getElementById('btn-load'),
  cityFilter: document.getElementById('city-filter'),
  requestsError: document.getElementById('requests-error'),
  requestsList: document.getElementById('requests-list'),
  hoursForm: document.getElementById('hours-form'),
  btnHoursSave: document.getElementById('btn-hours-save'),
  btnHoursReload: document.getElementById('btn-hours-reload'),
  toastHost: document.getElementById('toast')
};

function ensureSupabase() {
  if (!window.supabase || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration missing');
  }
}

function resetState() {
  state.activeUserId = null;
  state.pharmacyId = null;
  state.hoursMap = null;
  state.bootPromises = Object.create(null);
  state.subs.forEach((sub) => {
    try {
      sub?.unsubscribe?.();
    } catch (err) {
      console.warn('unsubscribe failed', err);
    }
  });
  state.subs = [];

  if (ui.userEmail) {
    ui.userEmail.textContent = '';
  }
  if (ui.requestsList) {
    ui.requestsList.innerHTML = '';
  }
  if (ui.requestsError) {
    ui.requestsError.textContent = '';
    ui.requestsError.classList.add('hidden');
  }
  if (ui.proBanner) {
    ui.proBanner.textContent = '';
    ui.proBanner.classList.add('hidden');
  }
  if (ui.hoursForm) {
    ui.hoursForm
      .querySelectorAll('[data-day][data-field]')
      .forEach((input) => {
        if (input.type === 'checkbox') {
          input.checked = false;
        } else {
          input.value = '';
        }
        if (input.type === 'time') {
          input.disabled = true;
        }
      });
  }
}

function guard(uid) {
  if (state.activeUserId !== uid) {
    throw new Error('session changed');
  }
}

async function getBootPromise(user) {
  if (state.bootPromises[user.id]) {
    return state.bootPromises[user.id];
  }
  const boot = doBoot(user).catch((error) => {
    delete state.bootPromises[user.id];
    throw error;
  });
  state.bootPromises[user.id] = boot;
  return boot;
}

function showAuth() {
  ui.authCard?.classList.remove('hidden');
  ui.portal?.classList.add('hidden');
}

function showPortal(user) {
  state.activeUserId = user.id;
  if (ui.userEmail) {
    ui.userEmail.textContent = user.email || '';
  }
  ui.authCard?.classList.add('hidden');
  ui.portal?.classList.remove('hidden');
}

function toast(message, type = 'info') {
  console[type === 'error' ? 'error' : 'log']('[toast]', message);
  const host = ui.toastHost;
  if (!host) return;
  host.textContent = message;
  host.classList.remove('hidden');
  host.dataset.type = type;
  setTimeout(() => {
    host.classList.add('hidden');
  }, 3000);
}

function relTime(iso) {
  if (!iso) return '';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'πριν λίγα δευτερόλεπτα';
  if (minutes < 60) return `πριν ${minutes} λεπτά`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `πριν ${hours} ώρες`;
  const daysDiff = Math.floor(hours / 24);
  if (daysDiff < 7) return `πριν ${daysDiff} ημέρες`;
  const weeks = Math.floor(daysDiff / 7);
  if (weeks < 4) return `πριν ${weeks} εβδομάδες`;
  const months = Math.floor(daysDiff / 30);
  if (months < 12) return `πριν ${months} μήνες`;
  const years = Math.floor(daysDiff / 365);
  return `πριν ${years} χρόνια`;
}

function toggleDayInputs(day, enabled) {
  if (!ui.hoursForm) return;
  ui.hoursForm
    .querySelectorAll(`[data-day="${day}"][data-field]`)
    .forEach((input) => {
      if (input.type === 'time') {
        input.disabled = !enabled;
      }
    });
}

function renderHours() {
  if (!ui.hoursForm || !state.hoursMap) return;
  const inputs = ui.hoursForm.querySelectorAll('[data-day][data-field]');
  inputs.forEach((input) => {
    const day = input.dataset.day;
    const field = input.dataset.field;
    const info = state.hoursMap[day] || { openFlag: false, open: '', close: '' };
    if (field === 'openFlag') {
      input.checked = !!info.openFlag;
      toggleDayInputs(day, !!info.openFlag);
    } else if (field === 'open') {
      input.value = info.open || '';
    } else if (field === 'close') {
      input.value = info.close || '';
    }
  });
}

function collectHours() {
  const map = {};
  if (!ui.hoursForm) return map;
  const inputs = ui.hoursForm.querySelectorAll('[data-day][data-field]');
  inputs.forEach((input) => {
    const day = input.dataset.day;
    const field = input.dataset.field;
    if (!map[day]) {
      map[day] = { openFlag: false, open: '', close: '' };
    }
    if (field === 'openFlag') {
      map[day].openFlag = input.checked;
    } else if (field === 'open') {
      map[day].open = input.value;
    } else if (field === 'close') {
      map[day].close = input.value;
    }
  });
  return map;
}

function validateHours(map) {
  for (const day of days) {
    const info = map[day];
    if (!info) continue;
    if (info.openFlag) {
      if (!info.open || !info.close) {
        return `Συμπληρώστε ώρες για ${day}`;
      }
      if (info.close <= info.open) {
        return `Οι ώρες για ${day} δεν είναι έγκυρες`;
      }
    }
  }
  return null;
}

async function saveHours() {
  if (!state.pharmacyId) return;
  try {
    const map = collectHours();
    const errorMessage = validateHours(map);
    if (errorMessage) {
      toast(errorMessage, 'error');
      return;
    }
    const { data, error } = await state.sb
      .from('pharmacies')
      .update({ hours: map })
      .eq('id', state.pharmacyId)
      .select('hours')
      .single();
    if (error) throw error;
    state.hoursMap = data?.hours || map;
    renderHours();
    toast('Αποθηκεύτηκε');
  } catch (error) {
    console.error('saveHours failed', error);
    toast('Αποτυχία αποθήκευσης', 'error');
  }
}

async function reloadHoursFromDB() {
  if (!state.pharmacyId) return;
  try {
    const { data, error } = await state.sb
      .from('pharmacies')
      .select('hours')
      .eq('id', state.pharmacyId)
      .single();
    if (error) throw error;
    state.hoursMap = data?.hours || {};
    for (const day of days) {
      if (!state.hoursMap[day]) {
        state.hoursMap[day] = { openFlag: false, open: '', close: '' };
      }
    }
    renderHours();
    toast('Επαναφόρτωση ολοκληρώθηκε');
  } catch (error) {
    console.error('reloadHoursFromDB failed', error);
    toast('Αποτυχία επαναφόρτωσης ωραρίου', 'error');
  }
}

async function reloadRequests() {
  if (!state.activeUserId) return;
  const guardId = state.activeUserId;
  try {
    const city = (ui.cityFilter?.value || '').trim();
    let query = state.sb
      .from('open_requests_for_pharmacies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    const { data, error } = await query;
    guard(guardId);
    if (error) throw error;
    renderRequestCards(data || []);
    if (ui.requestsError) {
      ui.requestsError.textContent = '';
      ui.requestsError.classList.add('hidden');
    }
  } catch (error) {
    console.error('reloadRequests failed', error);
    if (error?.message === 'session changed') {
      return;
    }
    if (ui.requestsError) {
      ui.requestsError.textContent = 'Σφάλμα φόρτωσης αιτημάτων';
      ui.requestsError.classList.remove('hidden');
    }
  }
}

function renderRequestCards(rows) {
  if (!ui.requestsList) return;
  ui.requestsList.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'request-card empty';
    empty.textContent = 'Δεν υπάρχουν αιτήματα.';
    ui.requestsList.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'request-card';

    const header = document.createElement('h3');
    header.textContent = row.medicine_name || 'Άγνωστο φάρμακο';
    card.appendChild(header);

    const details = document.createElement('p');
    details.textContent = [row.substance, row.type, row.quantity]
      .filter(Boolean)
      .join(' • ');
    card.appendChild(details);

    const cityEl = document.createElement('p');
    cityEl.textContent = `Πόλη: ${row.city || '—'}`;
    card.appendChild(cityEl);

    const statusEl = document.createElement('p');
    statusEl.textContent = `Κατάσταση: ${row.status || '—'}`;
    card.appendChild(statusEl);

    const timeEl = document.createElement('p');
    timeEl.textContent = relTime(row.created_at);
    card.appendChild(timeEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'request-actions';

    const btnHave = document.createElement('button');
    btnHave.textContent = 'Το έχω';
    btnHave.addEventListener('click', () => respond(row.id, 'available', false));

    const btnGeneric = document.createElement('button');
    btnGeneric.textContent = 'Μόνο γενόσημο';
    btnGeneric.addEventListener('click', () => respond(row.id, 'generic', true));

    const btnNo = document.createElement('button');
    btnNo.textContent = 'Δεν το έχω';
    btnNo.addEventListener('click', () => respond(row.id, 'unavailable', false));

    btnRow.append(btnHave, btnGeneric, btnNo);
    card.appendChild(btnRow);

    frag.appendChild(card);
  });

  ui.requestsList.appendChild(frag);
}

async function respond(requestId, kind, genericOnly) {
  if (!state.pharmacyId) {
    toast('Δεν υπάρχει φαρμακείο', 'error');
    return;
  }
  const guardId = state.activeUserId;
  try {
    const payload = {
      request_id: requestId,
      pharmacy_id: state.pharmacyId,
      kind,
      generic_only: genericOnly
    };
    const insertResult = await state.sb
      .from('responses')
      .insert(payload)
      .select()
      .single();
    if (insertResult.error && insertResult.error.code !== '23505') {
      throw insertResult.error;
    }
    if (insertResult.error && insertResult.error.code === '23505') {
      const { error } = await state.sb
        .from('responses')
        .update({ kind, generic_only: genericOnly })
        .eq('request_id', requestId)
        .eq('pharmacy_id', state.pharmacyId)
        .select()
        .single();
      if (error) throw error;
    }
    guard(guardId);
    toast('Απαντήθηκε');
    await reloadRequests();
  } catch (error) {
    console.error('respond failed', error);
    toast('Αποτυχία αποστολής απάντησης', 'error');
  }
}

async function createDemoAndReload() {
  if (!state.activeUserId) return;
  try {
    await state.sb.from('requests').insert({
      user_id: state.activeUserId,
      city: 'DEMO CITY',
      medicine_name: 'Demozin 500mg tabs',
      substance: 'demo-cillin',
      type: 'tabs',
      quantity: 1,
      allow_generic: true,
      status: 'pending'
    });
    await reloadRequests();
  } catch (error) {
    console.error('createDemoAndReload failed', error);
    toast('Αποτυχία δημιουργίας demo', 'error');
  }
}

async function doBoot(user) {
  guard(user.id);
  console.log('PharmacyApp pro-bypass-1', user.email);
  try {
    let { data: pharmacyRow, error } = await state.sb
      .from('pharmacies')
      .select('id,hours,is_pro_active,name')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!pharmacyRow) {
      const insert = await state.sb
        .from('pharmacies')
        .insert({
          owner_id: user.id,
          name: '',
          is_pro_active: false,
          hours: {}
        })
        .select('id,hours,is_pro_active')
        .single();
      if (insert.error) throw insert.error;
      pharmacyRow = insert.data;
    }
    state.pharmacyId = pharmacyRow.id;
    state.hoursMap = pharmacyRow.hours || {};
    for (const day of days) {
      if (!state.hoursMap[day]) {
        state.hoursMap[day] = { openFlag: false, open: '', close: '' };
      }
    }
    guard(user.id);

    if (ui.proBanner) {
      if (!pharmacyRow.is_pro_active) {
        ui.proBanner.textContent = 'Ο λογαριασμός φαρμακείου δεν έχει ενεργοποιηθεί ακόμα. Βλέπετε δοκιμαστικό περιβάλλον.';
        ui.proBanner.classList.remove('hidden');
      } else {
        ui.proBanner.classList.add('hidden');
        ui.proBanner.textContent = '';
      }
    }

    renderHours();
    if (ui.btnHoursSave) ui.btnHoursSave.onclick = saveHours;
    if (ui.btnHoursReload) ui.btnHoursReload.onclick = reloadHoursFromDB;

    if (ui.btnRefresh) ui.btnRefresh.onclick = reloadRequests;
    if (ui.btnLoad) ui.btnLoad.onclick = reloadRequests;
    if (ui.btnDemo) ui.btnDemo.onclick = createDemoAndReload;

    await reloadRequests();
  } catch (error) {
    console.error('doBoot failed', error);
    toast('Σφάλμα αρχικοποίησης', 'error');
    throw error;
  }
}

function setupStaticListeners() {
  if (ui.btnLoginPassword) {
    ui.btnLoginPassword.addEventListener('click', async () => {
      const email = ui.authEmail?.value?.trim();
      const password = ui.authPassword?.value || '';
      if (!email || !password) {
        toast('Συμπληρώστε email και κωδικό', 'error');
        return;
      }
      try {
        const { error } = await state.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (error) {
        console.error('signInWithPassword failed', error);
        toast('Αποτυχία σύνδεσης', 'error');
      }
    });
  }

  if (ui.btnLoginMagic) {
    ui.btnLoginMagic.addEventListener('click', async () => {
      const email = ui.authEmail?.value?.trim();
      if (!email) {
        toast('Συμπληρώστε email', 'error');
        return;
      }
      try {
        const { error } = await state.sb.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/pharmacy.html`
          }
        });
        if (error) throw error;
        toast('Ελέγξτε το email σας για σύνδεσμο');
      } catch (error) {
        console.error('signInWithOtp failed', error);
        toast('Αποτυχία αποστολής email', 'error');
      }
    });
  }

  if (ui.btnLoginGoogle) {
    ui.btnLoginGoogle.addEventListener('click', async () => {
      try {
        const { error } = await state.sb.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/pharmacy.html`
          }
        });
        if (error) throw error;
      } catch (error) {
        console.error('signInWithOAuth failed', error);
        toast('Αποτυχία σύνδεσης Google', 'error');
      }
    });
  }

  if (ui.btnSignout) {
    ui.btnSignout.addEventListener('click', async () => {
      try {
        await state.sb.auth.signOut();
      } catch (error) {
        console.error('signOut failed', error);
        toast('Αποτυχία αποσύνδεσης', 'error');
      }
    });
  }

  if (ui.hoursForm) {
    ui.hoursForm
      .querySelectorAll('input[type="checkbox"][data-field="openFlag"]')
      .forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
          const cb = event.currentTarget;
          if (!(cb instanceof HTMLInputElement)) return;
          toggleDayInputs(cb.dataset.day, cb.checked);
        });
      });
  }
}

async function init() {
  try {
    ensureSupabase();
  } catch (error) {
    console.error(error);
    toast('Ρύθμιση Supabase αποτυχημένη', 'error');
    return;
  }

  setupStaticListeners();

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (code) {
    try {
      await state.sb.auth.exchangeCodeForSession({ code });
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      console.error('exchangeCodeForSession failed', error);
      toast('Αποτυχία επαλήθευσης κωδικού', 'error');
    }
  }

  try {
    const {
      data: { session }
    } = await state.sb.auth.getSession();
    if (session?.user) {
      showPortal(session.user);
      await getBootPromise(session.user);
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('getSession failed', error);
    showAuth();
  }

  state.sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      showPortal(session.user);
      await getBootPromise(session.user);
    } else if (event === 'SIGNED_OUT') {
      resetState();
      showAuth();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);

export {};
