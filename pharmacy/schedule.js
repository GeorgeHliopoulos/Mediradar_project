import { supabaseClient } from '../firebase.js';

export const WEEK_DAYS = [
  { index: 0, key: 'sun', labels: { el: 'Κυριακή', en: 'Sunday' }, short: { el: 'Κυρ', en: 'Sun' } },
  { index: 1, key: 'mon', labels: { el: 'Δευτέρα', en: 'Monday' }, short: { el: 'Δευ', en: 'Mon' } },
  { index: 2, key: 'tue', labels: { el: 'Τρίτη', en: 'Tuesday' }, short: { el: 'Τρι', en: 'Tue' } },
  { index: 3, key: 'wed', labels: { el: 'Τετάρτη', en: 'Wednesday' }, short: { el: 'Τετ', en: 'Wed' } },
  { index: 4, key: 'thu', labels: { el: 'Πέμπτη', en: 'Thursday' }, short: { el: 'Πεμ', en: 'Thu' } },
  { index: 5, key: 'fri', labels: { el: 'Παρασκευή', en: 'Friday' }, short: { el: 'Παρ', en: 'Fri' } },
  { index: 6, key: 'sat', labels: { el: 'Σάββατο', en: 'Saturday' }, short: { el: 'Σαβ', en: 'Sat' } }
];

function ensureSupabase(client) {
  if (!client) {
    throw new Error('Supabase client is not configured');
  }
  return client;
}

function normalizeTime(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(part => Number.parseInt(part, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return '';
    if (h < 0 || h > 23 || m < 0 || m > 59) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (/^\d{3,4}$/.test(trimmed)) {
    const normalized = trimmed.padStart(4, '0');
    const h = Number.parseInt(normalized.slice(0, 2), 10);
    const m = Number.parseInt(normalized.slice(2), 10);
    if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return '';
}

function timeToMinutes(value) {
  const match = /^([0-2]?\d):([0-5]\d)$/.exec(value || '');
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23) return null;
  return hours * 60 + minutes;
}

function baseScheduleEntries() {
  return WEEK_DAYS.map(day => ({
    dayIndex: day.index,
    open: false,
    start: '',
    end: '',
    labels: { ...day.labels },
    short: { ...day.short }
  }));
}

export function createEmptySchedule() {
  return baseScheduleEntries();
}

export function cloneSchedule(schedule) {
  return (schedule || []).map(entry => {
    const day = WEEK_DAYS.find(d => d.index === entry.dayIndex);
    return {
      dayIndex: entry.dayIndex,
      open: !!entry.open,
      start: entry.start || '',
      end: entry.end || '',
      labels: entry.labels ? { ...entry.labels } : day ? { ...day.labels } : { el: '', en: '' },
      short: entry.short ? { ...entry.short } : day ? { ...day.short } : { el: '', en: '' }
    };
  });
}

export function validateSchedule(schedule) {
  const errors = [];
  (schedule || []).forEach(entry => {
    if (!entry || !entry.open) return;
    const start = normalizeTime(entry.start);
    const end = normalizeTime(entry.end);
    if (!start || !end) {
      errors.push({ dayIndex: entry.dayIndex, code: 'missing', message: 'Οι ώρες είναι υποχρεωτικές.' });
      return;
    }
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (startMinutes === null || endMinutes === null) {
      errors.push({ dayIndex: entry.dayIndex, code: 'invalid', message: 'Μη έγκυρη ώρα.' });
      return;
    }
    if (endMinutes <= startMinutes) {
      errors.push({ dayIndex: entry.dayIndex, code: 'order', message: 'Η ώρα λήξης πρέπει να είναι μετά την έναρξη.' });
    }
  });
  return errors;
}

function deserializeEntry(raw) {
  if (!raw || typeof raw !== 'object') return { open: false, start: '', end: '' };
  const range = typeof raw.range === 'string' ? raw.range.split('-').map(part => part.trim()) : null;
  const startCandidate = raw.start ?? raw.open ?? raw.open_time ?? (range ? range[0] : '');
  const endCandidate = raw.end ?? raw.close ?? raw.close_time ?? (range ? range[1] : '');
  const start = normalizeTime(startCandidate);
  const end = normalizeTime(endCandidate);
  const open = raw.open === false ? false : !!(start && end);
  return { open, start: open ? start : '', end: open ? end : '' };
}

export function deserializeSchedule(hoursJson) {
  const base = baseScheduleEntries();
  const metaSource = (hoursJson && typeof hoursJson === 'object' && hoursJson._meta) || {};
  base.forEach(entry => {
    const raw = hoursJson && typeof hoursJson === 'object' ? hoursJson[entry.dayIndex] : null;
    const parsed = deserializeEntry(raw);
    entry.open = parsed.open;
    entry.start = parsed.start;
    entry.end = parsed.end;
  });
  const meta = {
    updatedAt: typeof metaSource.updatedAt === 'string' ? metaSource.updatedAt : null,
    updatedBy: typeof metaSource.updatedBy === 'string' ? metaSource.updatedBy : null
  };
  return { schedule: base, meta };
}

function serializeSchedule(schedule, session) {
  const payload = {};
  (schedule || []).forEach(entry => {
    const start = normalizeTime(entry.start);
    const end = normalizeTime(entry.end);
    if (entry.open && start && end) {
      payload[entry.dayIndex] = {
        open: true,
        start,
        end,
        open_time: start,
        close_time: end,
        range: `${start}-${end}`
      };
    } else {
      payload[entry.dayIndex] = { open: false };
    }
  });
  payload._meta = {
    updatedAt: new Date().toISOString(),
    updatedBy: session?.user?.email || session?.user?.phone || session?.user?.user_metadata?.name || session?.user?.id || null
  };
  return payload;
}

export async function loadSchedule(pharmacyId, { client } = {}) {
  const supabase = ensureSupabase(client ?? supabaseClient);
  if (!pharmacyId) {
    return { schedule: createEmptySchedule(), meta: { updatedAt: null, updatedBy: null } };
  }
  const { data, error } = await supabase
    .from('pharmacies')
    .select('hours_json')
    .eq('id', pharmacyId)
    .maybeSingle();
  if (error) throw error;
  return deserializeSchedule(data?.hours_json || {});
}

export async function saveSchedule(pharmacyId, schedule, { client, session } = {}) {
  if (!pharmacyId) {
    throw new Error('Λείπει το αναγνωριστικό φαρμακείου.');
  }
  if (!session?.user) {
    throw new Error('Απαιτείται σύνδεση.');
  }
  const supabase = ensureSupabase(client ?? supabaseClient);
  const payload = serializeSchedule(schedule, session);
  const { error } = await supabase
    .from('pharmacies')
    .update({ hours_json: payload })
    .eq('id', pharmacyId);
  if (error) throw error;
  return deserializeSchedule(payload);
}

export function formatScheduleForDisplay(schedule, locale = 'el') {
  const dayMap = new Map(WEEK_DAYS.map(day => [day.index, day]));
  const normalized = WEEK_DAYS.map(day => {
    const entry = (schedule || []).find(item => item?.dayIndex === day.index) || {};
    const open = !!entry.open && !!normalizeTime(entry.start) && !!normalizeTime(entry.end);
    return {
      dayIndex: day.index,
      open,
      start: normalizeTime(entry.start),
      end: normalizeTime(entry.end),
      labels: day.labels,
      short: day.short
    };
  });

  const groups = [];
  normalized.forEach(entry => {
    const key = entry.open ? `${entry.start}-${entry.end}` : 'closed';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.days.push(entry.dayIndex);
    } else {
      groups.push({ key, open: entry.open, start: entry.start, end: entry.end, days: [entry.dayIndex] });
    }
  });

  return groups
    .map(group => {
      const firstDay = dayMap.get(group.days[0]);
      const lastDay = dayMap.get(group.days[group.days.length - 1]);
      const label = group.days.length === 1
        ? (firstDay?.labels?.[locale] || firstDay?.labels?.el || firstDay?.labels?.en || '')
        : `${firstDay?.short?.[locale] || firstDay?.short?.el || firstDay?.short?.en || ''} – ${lastDay?.short?.[locale] || lastDay?.short?.el || lastDay?.short?.en || ''}`;
      const hoursLabel = group.open
        ? `${group.start} – ${group.end}`
        : (locale === 'en' ? 'Closed' : 'Κλειστό');
      return { daysLabel: label, hoursLabel, open: group.open };
    })
    .filter(item => item.daysLabel);
}
