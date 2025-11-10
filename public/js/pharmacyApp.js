import { init, client, requireAuth } from '/js/supabaseClient.js';

let sb;
let currentUser = null;
let pharmacyId = null;
let hoursMap = {};
let currentMonth = new Date();
let selectedDate = null;
let booting = false;

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let toastTimer = null;

const dom = {};

function cacheDom() {
  dom.authCard = document.getElementById('auth-card');
  dom.portal = document.getElementById('portal');
  dom.userEmail = document.getElementById('user-email');
  dom.magicLinkBtn = document.getElementById('magic-link-btn');
  dom.googleBtn = document.getElementById('google-btn');
  dom.signOutBtn = document.getElementById('sign-out');
  dom.authEmail = document.getElementById('auth-email');
  dom.toast = document.getElementById('toast');

  dom.phName = document.getElementById('ph-name');
  dom.phAddress = document.getElementById('ph-address');
  dom.phPhone = document.getElementById('ph-phone');
  dom.phLat = document.getElementById('ph-lat');
  dom.phLng = document.getElementById('ph-lng');
  dom.phSave = document.getElementById('ph-save');

  dom.monthLabel = document.getElementById('month-label');
  dom.calendar = document.getElementById('calendar');
  dom.prevMonth = document.getElementById('prev-month');
  dom.nextMonth = document.getElementById('next-month');
  dom.copyWeekday = document.getElementById('copy-weekday');
  dom.saveHours = document.getElementById('save-hours');

  dom.dayEditor = document.getElementById('day-editor');
  dom.dayEditorDate = document.getElementById('day-editor-date');
  dom.dayOk = document.getElementById('day-ok');
  dom.dayCancel = document.getElementById('day-cancel');
  dom.dayClear = document.getElementById('day-clear');
  dom.open1 = document.getElementById('open-1');
  dom.close1 = document.getElementById('close-1');
  dom.open2 = document.getElementById('open-2');
  dom.close2 = document.getElementById('close-2');

  dom.cityFilter = document.getElementById('city-filter');
  dom.loadRequests = document.getElementById('load-requests');
  dom.requestsList = document.getElementById('requests-list');
}

function toast(message, type = 'info') {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.className = `toast ${type}`;
  requestAnimationFrame(() => {
    dom.toast.classList.add('show');
  });
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 2500);
}

function showAuthCard() {
  dom.authCard.style.display = 'block';
  dom.portal.style.display = 'none';
}

function showPortal() {
  dom.authCard.style.display = 'none';
  dom.portal.style.display = 'block';
}

function resetPortal() {
  pharmacyId = null;
  hoursMap = {};
  selectedDate = null;
  dom.userEmail.textContent = '-';
  dom.requestsList.innerHTML = '';
  dom.calendar.innerHTML = '';
}

async function handleAuthState(user) {
  currentUser = user;
  if (!user) {
    showAuthCard();
    resetPortal();
    return;
  }
  showPortal();
  dom.userEmail.textContent = user.email || '—';
  await boot(user);
}

async function boot(user) {
  if (booting) return;
  booting = true;
  try {
    await ensurePharmacy(user);
    bindPharmacyForm();
    renderCalendar();
    await loadRequests();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Προέκυψε σφάλμα', 'error');
  } finally {
    booting = false;
  }
}

async function ensurePharmacy(user) {
  const { data, error } = await sb
    .from('pharmacies')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  let row = data;
  if (!row) {
    const { data: inserted, error: insertError } = await sb
      .from('pharmacies')
      .insert({
        owner_id: user.id,
        name: '',
        address: '',
        phone: '',
        lat: null,
        lng: null,
        hours: {}
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }
    row = inserted;
  }

  pharmacyId = row.id;
  hoursMap = row.hours || {};
  dom.phName.value = row.name || '';
  dom.phAddress.value = row.address || '';
  dom.phPhone.value = row.phone || '';
  dom.phLat.value = row.lat ?? '';
  dom.phLng.value = row.lng ?? '';
}

function bindPharmacyForm() {
  if (dom.phSave.dataset.bound) {
    return;
  }
  dom.phSave.dataset.bound = 'true';
  dom.phSave.addEventListener('click', async () => {
    if (!currentUser) {
      toast('Απαιτείται σύνδεση.', 'error');
      return;
    }
    const payload = {
      id: pharmacyId || undefined,
      owner_id: currentUser.id,
      name: dom.phName.value.trim(),
      address: dom.phAddress.value.trim(),
      phone: dom.phPhone.value.trim(),
      lat: parseNumber(dom.phLat.value),
      lng: parseNumber(dom.phLng.value),
      hours: hoursMap
    };

    try {
      const { data, error } = await sb
        .from('pharmacies')
        .upsert(payload, { onConflict: 'owner_id' })
        .select()
        .single();

      if (error) throw error;
      pharmacyId = data.id;
      toast('Αποθηκεύτηκαν τα στοιχεία.', 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Αποτυχία αποθήκευσης.', 'error');
    }
  });
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function renderCalendar() {
  if (!dom.calendar) return;
  dom.calendar.innerHTML = '';

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const firstDayIndex = monthStart.getDay();

  dom.monthLabel.textContent = `${capitalize(monthStart.toLocaleString('el-GR', { month: 'long' }))} ${monthStart.getFullYear()}`;

  weekdays.forEach((day) => {
    const header = document.createElement('div');
    header.className = 'weekday';
    header.textContent = day;
    dom.calendar.appendChild(header);
  });

  for (let i = 0; i < firstDayIndex; i++) {
    const filler = document.createElement('div');
    filler.style.visibility = 'hidden';
    dom.calendar.appendChild(filler);
  }

  for (let day = 1; day <= monthEnd.getDate(); day++) {
    const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const isoDate = toISODate(dateObj);
    const ranges = hoursMap[isoDate] || [];

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = isoDate;

    const numberEl = document.createElement('div');
    numberEl.className = 'day-number';
    numberEl.textContent = day;

    const hoursEl = document.createElement('div');
    hoursEl.className = 'day-hours';

    if (!ranges.length) {
      hoursEl.textContent = '—';
    } else {
      hoursEl.textContent = `${ranges[0].open}–${ranges[0].close}`;
      if (ranges.length > 1) {
        const extra = document.createElement('span');
        extra.className = 'badge';
        extra.textContent = `+${ranges.length - 1}`;
        hoursEl.appendChild(document.createTextNode(' '));
        hoursEl.appendChild(extra);
      }
    }

    cell.appendChild(numberEl);
    cell.appendChild(hoursEl);
    cell.addEventListener('click', () => openDayEditor(isoDate));
    dom.calendar.appendChild(cell);
  }
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function openDayEditor(dateStr) {
  selectedDate = dateStr;
  const ranges = hoursMap[dateStr] || [];
  dom.dayEditor.classList.add('active');
  const displayDate = new Date(`${dateStr}T00:00:00`);
  dom.dayEditorDate.textContent = displayDate.toLocaleDateString('el-GR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  dom.open1.value = ranges[0]?.open || '';
  dom.close1.value = ranges[0]?.close || '';
  dom.open2.value = ranges[1]?.open || '';
  dom.close2.value = ranges[1]?.close || '';
}

function closeDayEditor() {
  dom.dayEditor.classList.remove('active');
}

function bindDayEditor() {
  if (dom.dayEditor.dataset.bound) return;
  dom.dayEditor.dataset.bound = 'true';
  dom.dayEditor.addEventListener('click', (event) => {
    if (event.target === dom.dayEditor) {
      closeDayEditor();
    }
  });
  dom.dayCancel.addEventListener('click', () => {
    closeDayEditor();
  });
  dom.dayOk.addEventListener('click', () => {
    if (!selectedDate) return;
    const ranges = [];
    if (dom.open1.value && dom.close1.value) {
      ranges.push({ open: dom.open1.value, close: dom.close1.value });
    }
    if (dom.open2.value && dom.close2.value) {
      ranges.push({ open: dom.open2.value, close: dom.close2.value });
    }
    hoursMap[selectedDate] = ranges;
    closeDayEditor();
    renderCalendar();
  });
  dom.dayClear.addEventListener('click', () => {
    if (!selectedDate) return;
    hoursMap[selectedDate] = [];
    closeDayEditor();
    renderCalendar();
  });
}

function bindCalendarControls() {
  if (dom.prevMonth.dataset.bound) return;
  dom.prevMonth.dataset.bound = 'true';
  dom.prevMonth.addEventListener('click', () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  dom.nextMonth.addEventListener('click', () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  dom.copyWeekday.addEventListener('click', () => {
    if (!selectedDate) {
      toast('Επιλέξτε ημέρα από το ημερολόγιο.', 'error');
      return;
    }
    const source = (hoursMap[selectedDate] || []).map((r) => ({ ...r }));
    const weekdayIndex = new Date(`${selectedDate}T00:00:00`).getDay();
    const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      if (dateObj.getDay() === weekdayIndex) {
        hoursMap[toISODate(dateObj)] = source.map((r) => ({ ...r }));
      }
    }
    renderCalendar();
    toast('Το ωράριο αντιγράφηκε.', 'success');
  });
  dom.saveHours.addEventListener('click', async () => {
    if (!pharmacyId) {
      toast('Αποθηκεύστε πρώτα τα στοιχεία φαρμακείου.', 'error');
      return;
    }
    try {
      const { error } = await sb
        .from('pharmacies')
        .update({ hours: hoursMap })
        .eq('id', pharmacyId);
      if (error) throw error;
      toast('Το ωράριο αποθηκεύτηκε.', 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Αποτυχία αποθήκευσης ωραρίου.', 'error');
    }
  });
}

async function loadRequests() {
  if (!pharmacyId) {
    dom.requestsList.innerHTML = '';
    return;
  }
  const cityFilter = (dom.cityFilter.value || '').trim();
  try {
    let query = sb
      .from('open_requests_for_pharmacies')
      .select('id, city, medicine_name, substance, type, quantity, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (cityFilter) {
      query = query.ilike('city', `%${cityFilter}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    renderRequests(data || []);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία φόρτωσης αιτημάτων.', 'error');
  }
}

function renderRequests(requests) {
  dom.requestsList.innerHTML = '';
  if (!requests.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Δεν υπάρχουν αιτήματα.';
    dom.requestsList.appendChild(empty);
    return;
  }

  requests.forEach((req) => {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.requestId = req.id;

    const header = document.createElement('div');
    header.innerHTML = `<strong>${req.medicine_name}</strong> • ${req.type || ''}`;

    const details = document.createElement('div');
    const created = req.created_at ? new Date(req.created_at).toLocaleString('el-GR') : '';
    details.innerHTML = `Πόλη: <strong>${req.city || '—'}</strong><br/>Ποσότητα: ${req.quantity || '-'}<br/>Κατάσταση: ${req.status || '-'}<br/><small>${created}</small>`;

    const substance = document.createElement('div');
    substance.textContent = req.substance ? `Δραστική: ${req.substance}` : '';

    const actions = document.createElement('div');
    actions.className = 'request-actions';

    const btnHave = document.createElement('button');
    btnHave.textContent = 'Το έχω';
    btnHave.addEventListener('click', () => respond(req.id, 'available', false, card));

    const btnGeneric = document.createElement('button');
    btnGeneric.textContent = 'Μόνο γενόσημο';
    btnGeneric.addEventListener('click', () => respond(req.id, 'generic', true, card));

    const btnNo = document.createElement('button');
    btnNo.textContent = 'Δεν το έχω';
    btnNo.classList.add('outline');
    btnNo.addEventListener('click', () => respond(req.id, 'unavailable', false, card));

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Απαντήθηκε';
    badge.style.display = 'none';
    badge.dataset.role = 'response-badge';

    actions.appendChild(btnHave);
    actions.appendChild(btnGeneric);
    actions.appendChild(btnNo);

    card.appendChild(header);
    card.appendChild(details);
    if (substance.textContent) {
      card.appendChild(substance);
    }
    card.appendChild(actions);
    card.appendChild(badge);

    dom.requestsList.appendChild(card);
  });
}

async function respond(requestId, kind, genericOnly, card) {
  if (!pharmacyId) {
    toast('Δεν έχει καταχωρηθεί φαρμακείο.', 'error');
    return;
  }
  try {
    const payload = {
      request_id: requestId,
      pharmacy_id: pharmacyId,
      kind,
      generic_only: genericOnly
    };
    const { error } = await sb.from('responses').insert(payload).select().single();
    if (error) {
      if (error.code === '23505') {
        const { error: updateError } = await sb
          .from('responses')
          .update({ kind, generic_only: genericOnly })
          .eq('request_id', requestId)
          .eq('pharmacy_id', pharmacyId);
        if (updateError) throw updateError;
      } else {
        throw error;
      }
    }
    if (kind === 'available' || kind === 'generic') {
      const badge = card.querySelector('[data-role="response-badge"]');
      if (badge) {
        badge.style.display = 'inline-block';
        badge.classList.add('success');
      }
    }
    toast('Η απάντηση αποθηκεύτηκε.', 'success');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία αποθήκευσης απάντησης.', 'error');
  }
}

function bindRequestControls() {
  if (dom.loadRequests.dataset.bound) return;
  dom.loadRequests.dataset.bound = 'true';
  dom.loadRequests.addEventListener('click', () => {
    loadRequests();
  });
}

function bindAuthControls() {
  if (dom.magicLinkBtn.dataset.bound) return;
  dom.magicLinkBtn.dataset.bound = 'true';
  dom.magicLinkBtn.addEventListener('click', async () => {
    const email = (dom.authEmail.value || '').trim();
    if (!email) {
      toast('Συμπληρώστε email.', 'error');
      return;
    }
    try {
      await sb.auth.signInWithOtp({ email });
      toast('Στάλθηκε ο σύνδεσμος στο email σας.', 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Αποτυχία αποστολής συνδέσμου.', 'error');
    }
  });
  dom.googleBtn.addEventListener('click', async () => {
    try {
      await sb.auth.signInWithOAuth({ provider: 'google' });
    } catch (error) {
      console.error(error);
      toast(error.message || 'Αποτυχία σύνδεσης με Google.', 'error');
    }
  });
  dom.signOutBtn.addEventListener('click', async () => {
    try {
      await sb.auth.signOut();
      toast('Αποσυνδεθήκατε.', 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Αποτυχία αποσύνδεσης.', 'error');
    }
  });
}

function toISODate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function bindGlobalListeners() {
  bindDayEditor();
  bindCalendarControls();
  bindRequestControls();
  bindAuthControls();
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  bindGlobalListeners();
  try {
    await init();
    sb = client();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Αποτυχία αρχικοποίησης Supabase.', 'error');
    return;
  }

  const user = await requireAuth();
  await handleAuthState(user);

  sb.auth.onAuthStateChange((_event, session) => {
    handleAuthState(session?.user ?? null);
  });
});
