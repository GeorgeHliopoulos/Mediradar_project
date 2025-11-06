const WORK_DAYS = [
  { key: 'monday', label: 'Δευτέρα' },
  { key: 'tuesday', label: 'Τρίτη' },
  { key: 'wednesday', label: 'Τετάρτη' },
  { key: 'thursday', label: 'Πέμπτη' },
  { key: 'friday', label: 'Παρασκευή' }
];

const STATUS_TONES = ['info', 'success', 'error'];

function setElementTone(element, tone = 'info') {
  if (!element) return;
  const resolved = STATUS_TONES.includes(tone) ? tone : 'info';
  element.dataset.tone = resolved;
}

function createSpan(text, className) {
  const span = document.createElement('span');
  if (className) span.className = className;
  span.textContent = text;
  return span;
}

function createFieldWrapper(className) {
  const wrapper = document.createElement('label');
  wrapper.className = className;
  return wrapper;
}

function minutesFromTime(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(part => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export const WEEK_DAYS = WORK_DAYS.map(day => day.label);

export class ScheduleManager {
  constructor({ section, supabase } = {}) {
    this.section = section || null;
    this.supabase = supabase || null;
    this.statusEl = this.section?.querySelector('[data-schedule-status]') || null;
    this.formHost = this.section?.querySelector('[data-schedule-form]') || this.section || null;
    this.form = null;
    this.saveButton = null;
    this.refreshButton = null;
    this.dayControls = new Map();
    this.user = null;
    this.loading = false;
    this.dirty = false;

    if (this.formHost) {
      this.render();
      this.updateFormAccessibility();
    } else {
      console.warn('[schedule] Missing container for schedule manager');
    }
  }

  setSupabase(client) {
    this.supabase = client || null;
    this.updateFormAccessibility();
  }

  setUser(user) {
    this.user = user || null;
    this.updateFormAccessibility();
    if (this.user && this.supabase) {
      this.loadSchedule();
    } else if (!this.supabase) {
      this.showStatus('Δεν εντοπίστηκε σύνδεση Supabase για τη διαχείριση ωραρίου.', 'error');
    } else {
      this.showStatus('Συνδεθείτε για να επεξεργαστείτε το ωράριο λειτουργίας.', 'info');
      this.clearFormValues();
    }
  }

  render() {
    if (!this.formHost || this.form) return;

    const form = document.createElement('form');
    form.className = 'schedule-form';
    form.autocomplete = 'off';

    WORK_DAYS.forEach(day => {
      const row = document.createElement('div');
      row.className = 'schedule-row';
      row.dataset.day = day.label;

      const dayLabel = document.createElement('div');
      dayLabel.className = 'schedule-day';
      dayLabel.textContent = day.label;

      const openWrapper = createFieldWrapper('schedule-toggle');
      const openInput = document.createElement('input');
      openInput.type = 'checkbox';
      openInput.checked = false;
      openWrapper.append(openInput, createSpan('Ανοιχτό'));

      const startWrapper = createFieldWrapper('schedule-field');
      startWrapper.append(createSpan('Ώρα έναρξης', 'schedule-field-label'));
      const startInput = document.createElement('input');
      startInput.type = 'time';
      startInput.step = 300;
      startInput.className = 'schedule-input';
      startWrapper.append(startInput);

      const endWrapper = createFieldWrapper('schedule-field');
      endWrapper.append(createSpan('Ώρα λήξης', 'schedule-field-label'));
      const endInput = document.createElement('input');
      endInput.type = 'time';
      endInput.step = 300;
      endInput.className = 'schedule-input';
      endWrapper.append(endInput);

      const emergencyWrapper = createFieldWrapper('schedule-toggle');
      const emergencyInput = document.createElement('input');
      emergencyInput.type = 'checkbox';
      emergencyWrapper.append(emergencyInput, createSpan('Εφημερία / ειδικό ωράριο'));

      const dateWrapper = createFieldWrapper('schedule-field');
      dateWrapper.append(createSpan('Ειδική ημερομηνία (προαιρετική)', 'schedule-field-label'));
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'schedule-input';
      dateWrapper.append(dateInput);

      const controls = {
        row,
        isOpen: openInput,
        start: startInput,
        end: endInput,
        isEmergency: emergencyInput,
        effectiveDate: dateInput
      };

      openInput.addEventListener('change', () => {
        this.toggleAvailability(day.label);
        this.markDirty();
      });
      [startInput, endInput, emergencyInput, dateInput].forEach(input => {
        input.addEventListener('input', () => this.markDirty());
      });

      this.dayControls.set(day.label, controls);
      this.toggleAvailability(day.label);

      row.append(dayLabel, openWrapper, startWrapper, endWrapper, emergencyWrapper, dateWrapper);
      form.append(row);
    });

    const actions = document.createElement('div');
    actions.className = 'schedule-actions';

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'submit';
    this.saveButton.className = 'schedule-action schedule-action--primary';
    this.saveButton.textContent = 'Αποθήκευση Ωραρίου';

    this.refreshButton = document.createElement('button');
    this.refreshButton.type = 'button';
    this.refreshButton.className = 'schedule-action schedule-action--secondary';
    this.refreshButton.textContent = 'Επαναφορά από Supabase';
    this.refreshButton.addEventListener('click', () => {
      if (!this.supabase || !this.user) {
        this.showStatus('Δεν είναι δυνατή η ανανέωση χωρίς σύνδεση χρήστη.', 'error');
        return;
      }
      this.loadSchedule();
    });

    actions.append(this.saveButton, this.refreshButton);
    form.append(actions);

    form.addEventListener('submit', event => {
      event.preventDefault();
      this.saveSchedule();
    });

    form.addEventListener('input', () => this.markDirty());

    this.formHost.innerHTML = '';
    this.formHost.append(form);
    this.form = form;
  }

  markDirty() {
    if (!this.loading) {
      this.dirty = true;
    }
  }

  toggleAvailability(dayLabel) {
    const controls = this.dayControls.get(dayLabel);
    if (!controls) return;
    const enabled = !!controls.isOpen.checked;
    controls.start.disabled = !enabled;
    controls.end.disabled = !enabled;
    controls.row.classList.toggle('schedule-row--closed', !enabled);
  }

  updateFormAccessibility() {
    if (!this.form) return;
    const disabled = !this.supabase || !this.user;
    const focusable = this.form.querySelectorAll('input, button, select, textarea');
    focusable.forEach(element => {
      if (element === this.refreshButton) {
        element.disabled = !this.supabase || !this.user;
      } else {
        element.disabled = disabled;
      }
    });
  }

  showStatus(message, tone = 'info') {
    if (!this.statusEl) return;
    this.statusEl.textContent = message || '';
    setElementTone(this.statusEl, tone);
  }

  setLoading(isLoading, label) {
    this.loading = !!isLoading;
    if (this.saveButton) {
      this.saveButton.disabled = isLoading || !this.supabase || !this.user;
      this.saveButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      if (label && isLoading) {
        this.saveButton.dataset.originalText = this.saveButton.dataset.originalText || this.saveButton.textContent;
        this.saveButton.textContent = label;
      } else if (!isLoading && this.saveButton.dataset.originalText) {
        this.saveButton.textContent = this.saveButton.dataset.originalText;
        delete this.saveButton.dataset.originalText;
      }
    }
    if (this.refreshButton) {
      this.refreshButton.disabled = isLoading || !this.supabase || !this.user;
    }
  }

  clearFormValues() {
    this.dayControls.forEach((controls, day) => {
      controls.isOpen.checked = false;
      controls.start.value = '';
      controls.end.value = '';
      controls.isEmergency.checked = false;
      controls.effectiveDate.value = '';
      this.toggleAvailability(day);
    });
    this.dirty = false;
  }

  applyScheduleData(rows) {
    const byDay = new Map();
    rows.forEach(row => {
      const key = row.day_of_week;
      if (!key) return;
      const current = byDay.get(key);
      if (!current || current.effective_date === null) {
        byDay.set(key, row);
      }
    });

    this.dayControls.forEach((controls, day) => {
      const entry = byDay.get(day) || null;
      controls.isOpen.checked = entry ? entry.is_open !== false : false;
      controls.start.value = entry?.start_time || '';
      controls.end.value = entry?.end_time || '';
      controls.isEmergency.checked = entry?.is_emergency || false;
      controls.effectiveDate.value = entry?.effective_date || '';
      this.toggleAvailability(day);
    });

    this.dirty = false;
  }

  buildPayload() {
    if (!this.user) return [];
    const payload = [];
    this.dayControls.forEach((controls, day) => {
      const isOpen = !!controls.isOpen.checked;
      const startTime = controls.start.value ? controls.start.value : null;
      const endTime = controls.end.value ? controls.end.value : null;
      const effectiveDate = controls.effectiveDate.value ? controls.effectiveDate.value : null;
      payload.push({
        pharmacy_user_id: this.user.id,
        day_of_week: day,
        start_time: isOpen ? startTime : null,
        end_time: isOpen ? endTime : null,
        is_open: isOpen,
        is_emergency: !!controls.isEmergency.checked,
        effective_date: effectiveDate
      });
    });
    return payload;
  }

  validatePayload(payload) {
    const errors = [];
    payload.forEach(item => {
      if (item.is_open) {
        if (!item.start_time || !item.end_time) {
          errors.push(`Συμπληρώστε ώρες για την ημέρα ${item.day_of_week}.`);
          return;
        }
        const startMinutes = minutesFromTime(item.start_time);
        const endMinutes = minutesFromTime(item.end_time);
        if (startMinutes === null || endMinutes === null) {
          errors.push(`Μη έγκυρες ώρες για ${item.day_of_week}.`);
          return;
        }
        if (endMinutes <= startMinutes) {
          errors.push(`Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης (${item.day_of_week}).`);
        }
      }
    });
    return { valid: errors.length === 0, errors };
  }

  async loadSchedule() {
    if (!this.supabase || !this.user) {
      return;
    }
    this.setLoading(true, 'Φόρτωση…');
    this.showStatus('Φόρτωση ωραρίου…', 'info');
    try {
      const { data, error } = await this.supabase
        .from('pharmacy_schedule')
        .select('*')
        .eq('pharmacy_user_id', this.user.id)
        .is('effective_date', null)
        .order('day_of_week', { ascending: true });
      if (error) {
        throw error;
      }
      this.applyScheduleData(Array.isArray(data) ? data : []);
      this.showStatus('Το ωράριο ενημερώθηκε.', 'success');
    } catch (error) {
      console.warn('[schedule] loadSchedule failed', error);
      this.showStatus(`Αποτυχία φόρτωσης ωραρίου: ${error.message || error}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async saveSchedule() {
    if (!this.supabase || !this.user) {
      this.showStatus('Δεν υπάρχει ενεργή σύνδεση Supabase ή χρήστης.', 'error');
      return;
    }
    const payload = this.buildPayload();
    const { valid, errors } = this.validatePayload(payload);
    if (!valid) {
      this.showStatus(errors.join(' '), 'error');
      return;
    }
    this.setLoading(true, 'Αποθήκευση…');
    this.showStatus('Αποθήκευση ωραρίου…', 'info');
    let success = false;
    try {
      const { error: deleteError } = await this.supabase
        .from('pharmacy_schedule')
        .delete()
        .eq('pharmacy_user_id', this.user.id)
        .is('effective_date', null);
      if (deleteError) {
        throw deleteError;
      }
      if (payload.length) {
        const { error } = await this.supabase.from('pharmacy_schedule').insert(payload);
        if (error) {
          throw error;
        }
      }
      success = true;
      this.dirty = false;
    } catch (error) {
      console.warn('[schedule] saveSchedule failed', error);
      this.showStatus(`Αποτυχία αποθήκευσης ωραρίου: ${error.message || error}`, 'error');
    } finally {
      this.setLoading(false);
    }
    if (success) {
      await this.loadSchedule();
      this.showStatus('Το ωράριο αποθηκεύτηκε.', 'success');
    }
  }
}
