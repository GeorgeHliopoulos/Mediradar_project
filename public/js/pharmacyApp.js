const ENV = window.ENV || {};
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;

if (!window.supabase) {
  throw new Error('Supabase library not loaded');
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration');
}

const state = {
  sb: window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true }
  }),
  activeUserId: null,
  pharmacyId: null,
  hoursMap: null,
  bootPromises: Object.create(null),
  subs: []
};

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

let toastTimer = null;

function resetState() {
  state.activeUserId = null;
  state.pharmacyId = null;
  state.hoursMap = null;
  state.subs.forEach((unsub) => {
    try {
      if (typeof unsub === 'function') {
        unsub();
      }
    } catch (err) {
      console.warn('Failed to unsubscribe listener', err);
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
    els.hoursForm
      .querySelectorAll('[data-day][data-field]')
      .forEach((input) => {
        if (input.type === 'checkbox') {
          input.checked = false;
        } else {
          input.value = '';
        }
      });
  }
}

function guarded(userId) {
  return () => {
    if (state.activeUserId !== userId) {
      throw new Error('Session changed');
    }
  };
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
        toast('Αποτυχία φόρτωσης του portal', 'error');
        delete state.bootPromises[key];
      }
    })();
  }
  return state.bootPromises[key];
}

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
  const target = createEmptyHoursMap();
  if (!source || typeof source !== 'object') {
    return target;
  }
  days.forEach((day) => {
    const entry = source[day];
    if (entry && typeof entry === 'object') {
      target[day] = {
        openFlag: Boolean(entry.openFlag),
        open: entry.open || '',
        close: entry.close || ''
      };
    }
  });
  return target;
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
  state.activeUserId = user?.id || null;
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
  els.toast.classList.remove('show', 'info', 'success', 'error');
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
  if (Number.isNaN(date.getTime())) return '';
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

function handleAsync(fn) {
  return (...args) => {
    Promise.resolve(fn(...args)).catch((error) => {
      if (error && error.message === 'Session changed') {
        return;
      }
      console.error(error);
      toast('Παρουσιάστηκε σφάλμα', 'error');
    });
  };
}

function bind(el, event, handler, options) {
  if (!el) return;
  el.addEventListener(event, handler, options);
  state.subs.push(() => {
    el.removeEventListener(event, handler, options);
  });
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

function renderHours(guard) {
  guard();
  if (!els.hoursForm) return;
  const map = state.hoursMap || createEmptyHoursMap();
  els.hoursForm
    .querySelectorAll('[data-day][data-field]')
    .forEach((input) => {
      const day = input.dataset.day;
      const field = input.dataset.field;
      const entry = map[day] || createEmptyDay();
      if (field === 'openFlag') {
        input.checked = Boolean(entry.openFlag);
      } else if (field === 'open') {
        input.value = entry.open || '';
      } else if (field === 'close') {
        input.value = entry.close || '';
      }
    });
}

function validateHours(map) {
  for (const day of days) {
    const entry = map[day] || createEmptyDay();
    if (!entry.openFlag) continue;
    if (!entry.open || !entry.close) {
      return `Συμπληρώστε ώρες για ${dayLabels[day]}`;
    }
    if (entry.close <= entry.open) {
      return `Η ώρα κλεισίματος πρέπει να είναι μετά την ώρα ανοίγματος (${dayLabels[day]})`;
    }
  }
  return null;
}

function attachHoursInputs(guard) {
  if (!els.hoursForm) return;
  els.hoursForm
    .querySelectorAll('[data-day][data-field]')
    .forEach((input) => {
      const handler = () => {
        try {
          guard();
        } catch (error) {
          return;
        }
        const day = input.dataset.day;
        const field = input.dataset.field;
        if (!state.hoursMap) {
          state.hoursMap = createEmptyHoursMap();
        }
        const entry = { ...(state.hoursMap[day] || createEmptyDay()) };
        if (field === 'openFlag') {
          entry.openFlag = input.checked;
        } else if (field === 'open' || field === 'close') {
          entry[field] = input.value || '';
        }
        state.hoursMap[day] = entry;
      };
      bind(input, input.type === 'checkbox' ? 'change' : 'input', handler);
    });
}

async function saveHours(guard) {
  guard();
  if (!state.pharmacyId) {
    throw new Error('Missing pharmacy id');
  }
  const map = state.hoursMap || createEmptyHoursMap();
  const validationError = validateHours(map);
  if (validationError) {
    toast(validationError, 'error');
    return;
  }
  const { error } = await state.sb
    .from('pharmacies')
    .update({ hours: map })
    .eq('id', state.pharmacyId);
  guard();
  if (error) {
    throw error;
  }
  toast('Οι ώρες αποθηκεύτηκαν', 'success');
}

async function reloadHoursFromDB(guard) {
  guard();
  if (!state.pharmacyId) {
    throw new Error('Missing pharmacy id');
  }
  const { data, error } = await state.sb
    .from('pharmacies')
    .select('hours')
    .eq('id', state.pharmacyId)
    .single();
  guard();
  if (error) {
    throw error;
  }
  state.hoursMap = normalizeHoursMap(data?.hours);
  renderHours(guard);
  toast('Οι ώρες ενημερώθηκαν', 'success');
}

function markRequestAnswered(card, kind) {
  if (!card) return;
  card.dataset.answered = kind;
  card.classList.add('answered');
  card.querySelectorAll('button').forEach((btn) => {
    btn.disabled = true;
  });
}

async function respondToRequest(guard, requestId, kind, genericOnly) {
  guard();
  if (!state.pharmacyId) {
    throw new Error('Missing pharmacy context');
  }
  const payload = {
    request_id: requestId,
    pharmacy_id: state.pharmacyId,
    kind,
    generic_only: genericOnly
  };
  let card;
  if (els.requestsList) {
    card = els.requestsList.querySelector(`[data-request-id="${requestId}"]`);
  }
  const insertResult = await state.sb
    .from('responses')
    .insert(payload)
    .select()
    .single();
  guard();
  if (insertResult.error) {
    if (insertResult.error.code === '23505') {
      const { error: updateError } = await state.sb
        .from('responses')
        .update({ kind, generic_only: genericOnly })
        .eq('request_id', requestId)
        .eq('pharmacy_id', state.pharmacyId);
      guard();
      if (updateError) {
        throw updateError;
      }
    } else {
      throw insertResult.error;
    }
  }
  markRequestAnswered(card, kind);
  toast('Η απάντηση καταχωρήθηκε', 'success');
}

function renderRequests(requests, guard) {
  guard();
  if (!els.requestsList) return;
  els.requestsList.innerHTML = '';
  if (!Array.isArray(requests) || requests.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Δεν υπάρχουν αιτήματα.';
    els.requestsList.appendChild(empty);
    return;
  }

  requests.forEach((request) => {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.requestId = String(request.id);
    card.innerHTML = `
      <h5>${request.medicine_name || ''}</h5>
      <p><strong>Δραστική:</strong> ${request.substance || '-'}</p>
      <p><strong>Μορφή:</strong> ${request.type || '-'}</p>
      <p><strong>Ποσότητα:</strong> ${request.quantity ?? '-'}</p>
      <p><strong>Πόλη:</strong> ${request.city || '-'}</p>
      <p><strong>Κατάσταση:</strong> ${request.status || '-'}</p>
      <p><small>${relTime(request.created_at)}</small></p>
      <div class="request-actions">
        <button type="button" class="btn btn-success" data-action="available">Το έχω</button>
        <button type="button" class="btn btn-warning" data-action="generic">Μόνο γενόσημο</button>
        <button type="button" class="btn btn-secondary" data-action="unavailable">Δεν το έχω</button>
      </div>
    `;

    const buttons = card.querySelectorAll('button[data-action]');
    buttons.forEach((button) => {
      const action = button.dataset.action;
      const handler = handleAsync(async () => {
        guard();
        const kind = action === 'available' ? 'available' : action === 'generic' ? 'generic' : 'unavailable';
        const genericOnly = action === 'generic';
        await respondToRequest(guard, request.id, kind, genericOnly);
      });
      button.addEventListener('click', handler);
    });

    els.requestsList.appendChild(card);
  });
}

async function reloadRequests(guard) {
  guard();
  const cityValue = (els.cityFilter?.value || '').trim();
  let query = state.sb
    .from('open_requests_for_pharmacies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (cityValue) {
    query = query.ilike('city', `%${cityValue}%`);
  }
  const { data, error } = await query;
  guard();
  if (error) {
    setRequestsError('Αποτυχία φόρτωσης αιτημάτων');
    throw error;
  }
  setRequestsError('');
  renderRequests(data || [], guard);
}

async function insertDemoRequest(guard, userId) {
  guard();
  const { error } = await state.sb
    .from('requests')
    .insert({
      user_id: userId,
      city: 'DEMO CITY',
      medicine_name: 'Demozin 500mg tabs',
      substance: 'demo-cillin',
      type: 'tabs',
      quantity: 1,
      allow_generic: true,
      status: 'pending'
    });
  guard();
  if (error) {
    throw error;
  }
  toast('Δημιουργήθηκε demo αίτημα', 'success');
  await reloadRequests(guard);
}

function setupHoursControls(guard) {
  if (!els.btnHoursSave || !els.btnHoursReload) return;
  bind(els.btnHoursSave, 'click', handleAsync(() => saveHours(guard)));
  bind(els.btnHoursReload, 'click', handleAsync(() => reloadHoursFromDB(guard)));
}

function setupRequestControls(guard, userId) {
  if (els.btnLoad) {
    bind(els.btnLoad, 'click', handleAsync(() => reloadRequests(guard)));
  }
  if (els.btnRefresh) {
    bind(els.btnRefresh, 'click', handleAsync(() => reloadRequests(guard)));
  }
  if (els.btnDemo) {
    bind(els.btnDemo, 'click', handleAsync(() => insertDemoRequest(guard, userId)));
  }
}

async function ensurePharmacy(user, guard) {
  const { data, error } = await state.sb
    .from('pharmacies')
    .select('id,hours')
    .eq('owner_id', user.id)
    .maybeSingle();
  guard();
  if (error) {
    throw error;
  }
  if (data) {
    return data;
  }
  const insertResult = await state.sb
    .from('pharmacies')
    .insert({ owner_id: user.id, name: '', hours: {} })
    .select('id,hours')
    .single();
  guard();
  if (insertResult.error) {
    throw insertResult.error;
  }
  return insertResult.data;
}

async function doBoot(user) {
  const guard = guarded(user.id);
  guard();

  const pharmacyRow = await ensurePharmacy(user, guard);
  guard();

  state.pharmacyId = pharmacyRow.id;
  state.hoursMap = normalizeHoursMap(pharmacyRow.hours);
  renderHours(guard);
  attachHoursInputs(guard);
  setupHoursControls(guard);
  setupRequestControls(guard, user.id);

  await reloadRequests(guard);
}

function setupAuthHandlers() {
  if (els.btnLoginPassword) {
    els.btnLoginPassword.addEventListener('click', handleAsync(async (event) => {
      event.preventDefault();
      const email = els.authEmail?.value?.trim();
      const password = els.authPassword?.value || '';
      if (!email || !password) {
        toast('Συμπληρώστε email και κωδικό', 'error');
        return;
      }
      const { error } = await state.sb.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      toast('Επιτυχής σύνδεση', 'success');
    }));
  }

  if (els.btnLoginMagic) {
    els.btnLoginMagic.addEventListener('click', handleAsync(async (event) => {
      event.preventDefault();
      const email = els.authEmail?.value?.trim();
      if (!email) {
        toast('Συμπληρώστε email', 'error');
        return;
      }
      const { error } = await state.sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/pharmacy.html`
        }
      });
      if (error) {
        throw error;
      }
      toast('Στάλθηκε σύνδεσμος στο email σας', 'success');
    }));
  }

  if (els.btnLoginGoogle) {
    els.btnLoginGoogle.addEventListener('click', handleAsync(async (event) => {
      event.preventDefault();
      const { error } = await state.sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/pharmacy.html`
        }
      });
      if (error) {
        throw error;
      }
    }));
  }

  if (els.btnSignout) {
    els.btnSignout.addEventListener('click', handleAsync(async (event) => {
      event.preventDefault();
      const { error } = await state.sb.auth.signOut();
      if (error) {
        throw error;
      }
    }));
  }
}

async function bootstrap() {
  setupAuthHandlers();

  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    try {
      await state.sb.auth.exchangeCodeForSession({ code: params.get('code') });
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      console.error('Code exchange failed', error);
      toast('Αποτυχία σύνδεσης', 'error');
    }
  }

  try {
    const { data, error } = await state.sb.auth.getSession();
    if (error) {
      throw error;
    }
    const session = data?.session;
    if (session?.user) {
      showPortal(session.user);
      await getBootPromise(session.user);
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('Session fetch failed', error);
    showAuth();
    toast('Δεν ήταν δυνατή η φόρτωση συνεδρίας', 'error');
  }

  state.sb.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
      if (state.activeUserId && state.activeUserId !== session.user.id) {
        resetState();
      }
      showPortal(session.user);
      getBootPromise(session.user);
      return;
    }
    if (event === 'SIGNED_OUT') {
      showAuth();
      resetState();
      return;
    }
    if (!session?.user) {
      showAuth();
      resetState();
    }
  });
}

bootstrap().catch((error) => {
  if (error && error.message === 'Session changed') {
    return;
  }
  console.error('Bootstrap failure', error);
  toast('Παρουσιάστηκε σφάλμα εκκίνησης', 'error');
});
