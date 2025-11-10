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
  weekAnchor: null,
  bootPromises: Object.create(null),
  subs: []
};

function resetState() {
  state.activeUserId = null;
  state.pharmacyId = null;
  state.hoursMap = null;
  state.weekAnchor = null;
  state.subs.forEach((sub) => {
    try {
      sub?.unsubscribe?.();
    } catch (err) {
      console.error('unsubscribe failed', err);
    }
  });
  state.subs = [];
  state.bootPromises = Object.create(null);
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
  const p = doBoot(user).catch((err) => {
    console.error(err);
  });
  state.bootPromises[user.id] = p;
  return p;
}

const el = (id) => document.getElementById(id);

function showAuth() {
  el('auth-card')?.classList.remove('hidden');
  el('portal')?.classList.add('hidden');
}

function showPortal(user) {
  state.activeUserId = user.id;
  el('auth-card')?.classList.add('hidden');
  el('portal')?.classList.remove('hidden');
  const emailSpan = el('user-email');
  if (emailSpan) {
    emailSpan.textContent = user.email || '';
  }
}

function mondayOf(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function weekLabel(from) {
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = {
  mon: 'Δευτέρα',
  tue: 'Τρίτη',
  wed: 'Τετάρτη',
  thu: 'Πέμπτη',
  fri: 'Παρασκευή',
  sat: 'Σάββατο',
  sun: 'Κυριακή'
};

const RE_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

function parseTimeToMinutes(t) {
  if (!t) return null;
  if (!RE_TIME.test(t)) return null;
  if (t === '24:00') return 1440;
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function normTime(t) {
  if (!t) return '';
  if (!RE_TIME.test(t)) return '';
  return t;
}

function ensureHoursShape() {
  if (!state.hoursMap) {
    state.hoursMap = {};
  }
  for (const d of DAYS) {
    if (!state.hoursMap[d]) {
      state.hoursMap[d] = { openFlag: false, open: '', close: '' };
    }
    state.hoursMap[d].open = normTime(state.hoursMap[d].open);
    state.hoursMap[d].close = normTime(state.hoursMap[d].close);
    state.hoursMap[d].openFlag = !!state.hoursMap[d].openFlag;
  }
}

function renderWeekDates() {
  if (!state.weekAnchor) {
    state.weekAnchor = mondayOf(new Date());
  }
  const anchor = state.weekAnchor;
  const labelEl = el('week-label');
  if (labelEl) {
    labelEl.textContent = weekLabel(anchor);
  }
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    const key = DAYS[i];
    const tag = document.querySelector(`.date-tag[data-day="${key}"]`);
    if (tag) {
      tag.textContent = fmtDate(d);
    }
  }
}

function renderHours() {
  ensureHoursShape();
  renderWeekDates();
  for (const d of DAYS) {
    const row = document.querySelector(`#day-${d}`);
    if (!row) continue;
    const flag = row.querySelector(`[data-day="${d}"][data-field="openFlag"]`);
    const open = row.querySelector(`[data-day="${d}"][data-field="open"]`);
    const close = row.querySelector(`[data-day="${d}"][data-field="close"]`);
    if (flag) flag.checked = !!state.hoursMap[d].openFlag;
    if (open) open.value = state.hoursMap[d].open || '';
    if (close) close.value = state.hoursMap[d].close || '';
  }
}

function collectHours() {
  const out = {};
  for (const d of DAYS) {
    const flagEl = document.querySelector(`[data-day="${d}"][data-field="openFlag"]`);
    const openEl = document.querySelector(`[data-day="${d}"][data-field="open"]`);
    const closeEl = document.querySelector(`[data-day="${d}"][data-field="close"]`);
    const flag = !!flagEl?.checked;
    const open = normTime((openEl?.value || '').trim());
    const close = normTime((closeEl?.value || '').trim());
    out[d] = { openFlag: flag, open, close };
  }
  return out;
}

function validateHours(map) {
  for (const d of DAYS) {
    const v = map[d];
    if (!v.openFlag) continue;
    const mo = parseTimeToMinutes(v.open);
    const mc = parseTimeToMinutes(v.close);
    if (mo === null || mc === null) {
      return { ok: false, msg: `Λάθος ώρα στη ${DAY_LABELS[d]} (χρησιμοποίησε HH:MM ή 24:00).` };
    }
    if (mo === mc) {
      return { ok: false, msg: `Ίδιες ώρες στη ${DAY_LABELS[d]}.` };
    }
    const span = mc >= mo ? mc - mo : 1440 - mo + mc;
    if (span <= 0 || span > 1440) {
      return { ok: false, msg: `Μη έγκυρο διάστημα στη ${DAY_LABELS[d]}.` };
    }
  }
  return { ok: true };
}

async function reloadRequests() {
  const cityEl = el('city-filter');
  const city = (cityEl?.value || '').trim();
  let query = state.sb
    .from('open_requests_for_pharmacies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (city) {
    query = query.ilike('city', `%${city}%`);
  }
  const { data, error } = await query;
  if (error) {
    const errEl = el('requests-error');
    if (errEl) {
      errEl.textContent = error.message;
      errEl.classList.remove('hidden');
    }
    return;
  }
  const errEl = el('requests-error');
  if (errEl) {
    errEl.classList.add('hidden');
    errEl.textContent = '';
  }
  renderRequestCards(data || []);
}

function relTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `πριν ${minutes}′`;
  const hours = Math.floor(minutes / 60);
  return `πριν ${hours}ω`;
}

function renderRequestCards(rows) {
  const list = el('requests-list');
  if (!list) return;
  list.innerHTML = '';
  if (!rows.length) {
    list.innerHTML = '<p>Δεν υπάρχουν αιτήματα.</p>';
    return;
  }
  for (const r of rows) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="row"><strong>${r.medicine_name || '-'}</strong> <span style="color:#666">(${r.type || '-'})</span></div>
      <div class="row"><span>${r.substance || ''}</span></div>
      <div class="row">Πόλη: <strong>${r.city || '-'}</strong> • Ποσ.: <strong>${r.quantity || 1}</strong> • Κατάσταση: <strong>${r.status || ''}</strong> • ${relTime(r.created_at)}</div>
      <div class="row">
        <button class="btn-have">Το έχω</button>
        <button class="btn-generic">Μόνο γενόσημο</button>
        <button class="btn-no">Δεν το έχω</button>
        <span class="badge" style="display:none;margin-left:8px;color:#0a5c2c">Απαντήθηκε</span>
      </div>
    `;
    const badge = card.querySelector('.badge');
    card.querySelector('.btn-have')?.addEventListener('click', () => respond(r.id, 'available', false, badge));
    card.querySelector('.btn-generic')?.addEventListener('click', () => respond(r.id, 'generic', true, badge));
    card.querySelector('.btn-no')?.addEventListener('click', () => respond(r.id, 'unavailable', false, badge));
    list.appendChild(card);
  }
}

async function respond(requestId, kind, genericOnly, badgeEl) {
  if (!state.pharmacyId) {
    alert('Δεν βρέθηκε φαρμακείο.');
    return;
  }
  try {
    const { error: insertError } = await state.sb
      .from('responses')
      .insert({
        request_id: requestId,
        pharmacy_id: state.pharmacyId,
        kind,
        generic_only: genericOnly
      })
      .select()
      .single();
    if (insertError) {
      if (insertError.code === '23505') {
        const { error: updateError } = await state.sb
          .from('responses')
          .update({ kind, generic_only: genericOnly })
          .eq('request_id', requestId)
          .eq('pharmacy_id', state.pharmacyId)
          .select()
          .single();
        if (updateError) throw updateError;
      } else {
        throw insertError;
      }
    }
    if (badgeEl) {
      badgeEl.style.display = 'inline';
    }
  } catch (err) {
    console.error(err);
    alert(err.message || 'Σφάλμα');
  }
}

async function createDemoAndReload() {
  if (!state.activeUserId) {
    alert('Δεν βρέθηκε χρήστης.');
    return;
  }
  const { error } = await state.sb.from('requests').insert({
    user_id: state.activeUserId,
    city: 'DEMO CITY',
    medicine_name: 'Demozin 500mg tabs',
    substance: 'demo-cillin',
    type: 'tabs',
    quantity: 1,
    allow_generic: true,
    status: 'pending'
  });
  if (error) {
    alert(error.message);
    return;
  }
  await reloadRequests();
}

async function saveHours() {
  if (!state.pharmacyId) {
    alert('Δεν βρέθηκε φαρμακείο.');
    return;
  }
  const map = collectHours();
  const validation = validateHours(map);
  if (!validation.ok) {
    alert(validation.msg);
    return;
  }
  const { error } = await state.sb
    .from('pharmacies')
    .update({ hours: map })
    .eq('id', state.pharmacyId);
  if (error) {
    alert(error.message);
    return;
  }
  state.hoursMap = map;
  alert('Αποθηκεύτηκε.');
}

async function reloadHoursFromDB() {
  if (!state.pharmacyId) return;
  const { data, error } = await state.sb
    .from('pharmacies')
    .select('id,hours,is_pro_active')
    .eq('id', state.pharmacyId)
    .single();
  if (error) {
    console.error(error);
    return;
  }
  state.hoursMap = data?.hours || {};
  renderHours();
}

async function doBoot(user) {
  guard(user.id);
  console.log('PharmacyApp hours-24h-weekdates-1', user.email);
  const existing = await state.sb
    .from('pharmacies')
    .select('id,hours,is_pro_active,name')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST116') {
    throw existing.error;
  }
  let row = existing.data;
  if (!row) {
    const created = await state.sb
      .from('pharmacies')
      .insert({ owner_id: user.id, name: '', is_pro_active: false, hours: {} })
      .select('id,hours,is_pro_active')
      .single();
    if (created.error) {
      throw created.error;
    }
    row = created.data;
  }
  state.pharmacyId = row.id;
  state.hoursMap = row.hours || {};

  const banner = el('pro-banner');
  if (banner) {
    if (!row.is_pro_active) {
      banner.textContent = 'Ο λογαριασμός φαρμακείου δεν έχει ενεργοποιηθεί ακόμα. Βλέπετε δοκιμαστικό περιβάλλον.';
      banner.classList.remove('hidden');
    } else {
      banner.textContent = '';
      banner.classList.add('hidden');
    }
  }

  state.weekAnchor = mondayOf(new Date());
  renderHours();

  const weekPrev = el('week-prev');
  if (weekPrev) {
    weekPrev.onclick = () => {
      if (!state.weekAnchor) {
        state.weekAnchor = mondayOf(new Date());
      }
      state.weekAnchor.setDate(state.weekAnchor.getDate() - 7);
      renderWeekDates();
    };
  }
  const weekNext = el('week-next');
  if (weekNext) {
    weekNext.onclick = () => {
      if (!state.weekAnchor) {
        state.weekAnchor = mondayOf(new Date());
      }
      state.weekAnchor.setDate(state.weekAnchor.getDate() + 7);
      renderWeekDates();
    };
  }

  const saveBtn = el('btn-hours-save');
  if (saveBtn) saveBtn.onclick = saveHours;
  const reloadBtn = el('btn-hours-reload');
  if (reloadBtn) reloadBtn.onclick = reloadHoursFromDB;

  const refreshBtn = el('btn-refresh');
  if (refreshBtn) refreshBtn.onclick = reloadRequests;
  const loadBtn = el('btn-load');
  if (loadBtn) loadBtn.onclick = reloadRequests;
  const demoBtn = el('btn-demo');
  if (demoBtn) demoBtn.onclick = createDemoAndReload;

  await reloadRequests();
}

function bindAuthButtons() {
  const emailEl = el('auth-email');
  const passEl = el('auth-password');
  const btnPassword = el('btn-login-password');
  const btnMagic = el('btn-login-magic');
  const btnGoogle = el('btn-login-google');
  const btnSignout = el('btn-signout');

  if (btnPassword) {
    btnPassword.onclick = async () => {
      try {
        const { error } = await sb.auth.signInWithPassword({
          email: (emailEl?.value || '').trim(),
          password: passEl?.value || ''
        });
        if (error) throw error;
      } catch (err) {
        alert(err.message || 'Σφάλμα σύνδεσης');
      }
    };
  }

  if (btnMagic) {
    btnMagic.onclick = async () => {
      try {
        const { error } = await sb.auth.signInWithOtp({
          email: (emailEl?.value || '').trim(),
          options: {
            emailRedirectTo: `${window.location.origin}/pharmacy.html`
          }
        });
        if (error) throw error;
        alert('Σου στείλαμε link. Άνοιξέ το στον ίδιο browser.');
      } catch (err) {
        alert(err.message || 'Σφάλμα');
      }
    };
  }

  if (btnGoogle) {
    btnGoogle.onclick = async () => {
      try {
        const { error } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/pharmacy.html`
          }
        });
        if (error) throw error;
      } catch (err) {
        alert(err.message || 'Σφάλμα');
      }
    };
  }

  if (btnSignout) {
    btnSignout.onclick = () => {
      sb.auth.signOut();
    };
  }
}

bindAuthButtons();

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    showPortal(session.user);
    getBootPromise(session.user);
  }
  if (event === 'SIGNED_OUT') {
    resetState();
    showAuth();
  }
});

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    try {
      await sb.auth.exchangeCodeForSession({ code });
    } catch (err) {
      console.error('exchangeCodeForSession failed', err);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    const cleanSearch = url.searchParams.toString();
    const newUrl = cleanSearch ? `${url.pathname}?${cleanSearch}` : url.pathname;
    window.history.replaceState(null, '', newUrl + url.hash);
  }

  const {
    data: { session }
  } = await sb.auth.getSession();
  if (session?.user) {
    showPortal(session.user);
    await getBootPromise(session.user);
  } else {
    showAuth();
  }
}

bootstrap().catch((err) => {
  console.error('bootstrap failed', err);
});

