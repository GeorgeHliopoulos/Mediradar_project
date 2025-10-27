import {
  bookingAuthContext,
  signIn,
  signUp,
  signInWithProvider,
  sendSmsOtp,
  verifyOtp,
  sendMagicLink,
  refreshSession
} from './auth/service.js';

function setButtonLoading(button, isLoading) {
  if (!button) return;
  button.disabled = !!isLoading;
  button.classList.toggle('opacity-60', !!isLoading);
  button.classList.toggle('pointer-events-none', !!isLoading);
  button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

function resolveMessage(t, key, fallback) {
  if (typeof t === 'function') {
    try {
      const value = t(key);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    } catch { /* ignore */ }
  }
  return fallback;
}

function mergeAuthState(getAuthState, updateAuthState, patch) {
  if (typeof updateAuthState !== 'function') return;
  const prev = typeof getAuthState === 'function' ? (getAuthState() || {}) : {};
  updateAuthState(Object.assign({}, prev, patch));
}

export function initAuthFlows({
  elements,
  t,
  setStatus,
  markVerified,
  getAuthState,
  updateAuthState,
  availableProviders = []
}) {
  const {
    smsSendBtn,
    smsResendBtn,
    smsVerifyBtn,
    smsPhoneInput,
    smsCodeInput,
    smsStatusEl,
    emailInput,
    emailStatusEl,
    emailLoginBtn,
    emailRegisterBtn,
    emailConfirmBtn,
    ssoButtons,
    ssoStatusEl
  } = elements;

  const providerSet = new Set(
    (Array.isArray(availableProviders) ? availableProviders : [])
      .map((provider) =>
        typeof provider === 'string' ? provider.trim().toLowerCase() : ''
      )
      .filter(Boolean)
  );

  const genericErrorEl = resolveMessage(t, 'authErrorGeneric', 'Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά.');

  async function handleSmsSend() {
    const phone = smsPhoneInput?.value?.trim();
    const digits = phone ? phone.replace(/\D/g, '') : '';
    if (!phone || digits.length < 8) {
      setStatus?.(smsStatusEl, resolveMessage(t, 'authSmsStatusMissing', 'Συμπλήρωσε τον αριθμό τηλεφώνου.'), 'error');
      return;
    }
    setButtonLoading(smsSendBtn, true);
    setButtonLoading(smsResendBtn, true);
    try {
      await sendSmsOtp(phone);
      smsResendBtn?.classList.remove('hidden');
      mergeAuthState(getAuthState, updateAuthState, {
        sms: { phone, lastSentAt: Date.now() }
      });
      setStatus?.(
        smsStatusEl,
        resolveMessage(t, 'authSmsStatusSent', `Στάλθηκε κωδικός στο ${phone}.`).replace('%s', phone).replace('%s', '••••••'),
        'success'
      );
    } catch (error) {
      setStatus?.(smsStatusEl, error?.message || genericErrorEl, 'error');
    } finally {
      setButtonLoading(smsSendBtn, false);
      setButtonLoading(smsResendBtn, false);
    }
  }

  async function handleSmsVerify() {
    const authState = typeof getAuthState === 'function' ? (getAuthState() || {}) : {};
    const phone = authState.sms?.phone || smsPhoneInput?.value?.trim();
    if (!phone) {
      setStatus?.(smsStatusEl, resolveMessage(t, 'authSmsStatusMissing', 'Συμπλήρωσε τον αριθμό τηλεφώνου.'), 'error');
      return;
    }
    const code = smsCodeInput?.value?.trim();
    if (!code) {
      setStatus?.(smsStatusEl, resolveMessage(t, 'authSmsStatusMismatch', 'Ο κωδικός δεν είναι σωστός.'), 'error');
      return;
    }
    setButtonLoading(smsVerifyBtn, true);
    try {
      const { session } = await verifyOtp({ phone, token: code });
      setStatus?.(smsStatusEl, resolveMessage(t, 'authSmsStatusVerified', 'Η επαλήθευση ολοκληρώθηκε.'), 'success');
      mergeAuthState(getAuthState, updateAuthState, { verified: true, method: 'sms' });
      const normalizedSession = session || bookingAuthContext.getSession();
      markVerified?.('sms', { phone }, normalizedSession);
    } catch (error) {
      setStatus?.(smsStatusEl, error?.message || genericErrorEl, 'error');
    } finally {
      setButtonLoading(smsVerifyBtn, false);
    }
  }

  async function handleMagicLink(mode) {
    const email = emailInput?.value?.trim();
    const valid = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : false;
    if (!valid) {
      setStatus?.(emailStatusEl, resolveMessage(t, 'authEmailStatusMissing', 'Συμπλήρωσε το email σου.'), 'error');
      return;
    }
    const targetButton = mode === 'register' ? emailRegisterBtn : emailLoginBtn;
    setButtonLoading(targetButton, true);
    try {
      await sendMagicLink({ email, mode });
      mergeAuthState(getAuthState, updateAuthState, { email: { email, mode, sentAt: Date.now() } });
      const key = mode === 'register' ? 'authEmailStatusSentRegister' : 'authEmailStatusSentLogin';
      setStatus?.(emailStatusEl, resolveMessage(t, key, 'Στάλθηκε σύνδεσμος στο email.' ).replace('%s', email), 'success');
    } catch (error) {
      setStatus?.(emailStatusEl, error?.message || genericErrorEl, 'error');
    } finally {
      setButtonLoading(targetButton, false);
    }
  }

  async function handleEmailConfirm() {
    setButtonLoading(emailConfirmBtn, true);
    try {
      const session = await refreshSession();
      if (!session) {
        setStatus?.(emailStatusEl, resolveMessage(t, 'authEmailStatusPending', 'Πρώτα επέλεξε σύνδεση ή εγγραφή.'), 'error');
        return;
      }
      const authState = typeof getAuthState === 'function' ? (getAuthState() || {}) : {};
      const email = authState.email?.email || session.user?.email || '';
      setStatus?.(emailStatusEl, resolveMessage(t, 'authEmailStatusVerified', 'Η επιβεβαίωση email ολοκληρώθηκε.'), 'success');
      mergeAuthState(getAuthState, updateAuthState, { verified: true, method: 'email' });
      markVerified?.('email', { email, mode: authState.email?.mode || 'login' }, session);
    } catch (error) {
      setStatus?.(emailStatusEl, error?.message || genericErrorEl, 'error');
    } finally {
      setButtonLoading(emailConfirmBtn, false);
    }
  }

  function bindSsoButton(btn) {
    if (!btn) return;
    const providerKey = (btn.dataset.provider || '').toLowerCase();
    if (providerSet.size && !providerSet.has(providerKey)) {
      return;
    }
    btn.addEventListener('click', async () => {
      const provider = btn.dataset.provider || 'SSO';
      setButtonLoading(btn, true);
      try {
        const result = await signInWithProvider(provider);
        const session = result?.session || bookingAuthContext.getSession();
        setStatus?.(ssoStatusEl, resolveMessage(t, 'authSsoStatusSuccess', 'Σύνδεση επιτυχής με %s.').replace('%s', provider), 'success');
        mergeAuthState(getAuthState, updateAuthState, { verified: true, method: 'sso' });
        markVerified?.('sso', { provider }, session);
      } catch (error) {
        setStatus?.(ssoStatusEl, error?.message || genericErrorEl, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  smsSendBtn?.addEventListener('click', handleSmsSend);
  smsResendBtn?.addEventListener('click', handleSmsSend);
  smsVerifyBtn?.addEventListener('click', handleSmsVerify);
  emailLoginBtn?.addEventListener('click', () => handleMagicLink('login'));
  emailRegisterBtn?.addEventListener('click', () => handleMagicLink('register'));
  emailConfirmBtn?.addEventListener('click', handleEmailConfirm);
  (ssoButtons || []).forEach(bindSsoButton);

  return {
    refreshSession,
    get context() {
      return bookingAuthContext;
    }
  };
}

export function initProAuthFlows({
  elements,
  t,
  setStatus,
  onAuthenticated,
  availableProviders = []
}) {
  const {
    signinBtn,
    signinEmailInput,
    signinPasswordInput,
    statusEl,
    registerForm,
    registerSubmitBtn,
    registerPasswordInput,
    ssoButtons
  } = elements;

  const providerSet = new Set(
    (Array.isArray(availableProviders) ? availableProviders : [])
      .map((provider) =>
        typeof provider === 'string' ? provider.trim().toLowerCase() : ''
      )
      .filter(Boolean)
  );

  function updateStatus(message, tone = 'muted') {
    if (!statusEl) return;
    statusEl.classList.remove('hidden');
    setStatus?.(statusEl, message, tone);
  }

  function clearStatus() {
    if (!statusEl) return;
    statusEl.classList.add('hidden');
    statusEl.textContent = '';
  }

  const missingFieldsMessage = resolveMessage(t, 'proAuthMissingFields', 'Συμπλήρωσε όλα τα υποχρεωτικά πεδία.');
  const successMessage = resolveMessage(t, 'proAuthSuccess', 'Η σύνδεση ολοκληρώθηκε.');
  const registerMessage = resolveMessage(t, 'proAuthRegisterSuccess', 'Υποβάλαμε την εγγραφή σου — έλεγξε το email.');
  const genericError = resolveMessage(t, 'authErrorGeneric', 'Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά.');

  signinBtn?.addEventListener('click', async () => {
    const email = signinEmailInput?.value?.trim();
    const password = signinPasswordInput?.value || '';
    if (!email || !password) {
      updateStatus(missingFieldsMessage, 'error');
      return;
    }
    setButtonLoading(signinBtn, true);
    clearStatus();
    try {
      const { session } = await signIn({ email, password });
      updateStatus(successMessage, 'success');
      const normalizedSession = session || bookingAuthContext.getSession();
      onAuthenticated?.({ email, session: normalizedSession, mode: 'signin' });
    } catch (error) {
      updateStatus(error?.message || genericError, 'error');
    } finally {
      setButtonLoading(signinBtn, false);
    }
  });

  registerForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(registerForm);
    const email = (form.get('pro-field-email') || '').toString().trim();
    const password = registerPasswordInput?.value || '';
    if (!email || !password) {
      updateStatus(missingFieldsMessage, 'error');
      return;
    }
    const metadata = {
      business_name: (form.get('pro-field-business') || '').toString(),
      vat: (form.get('pro-field-vat') || '').toString(),
      license_number: (form.get('pro-field-license') || '').toString(),
      contact_name: (form.get('pro-field-contact') || '').toString(),
      contact_phone: (form.get('pro-field-phone') || '').toString(),
      address: (form.get('pro-field-address') || '').toString(),
      city: (form.get('pro-field-city') || '').toString()
    };
    setButtonLoading(registerSubmitBtn, true);
    clearStatus();
    try {
      const { session } = await signUp({ email, password, metadata });
      if (session) {
        updateStatus(successMessage, 'success');
        onAuthenticated?.({ email, session, mode: 'register', metadata });
      } else {
        updateStatus(registerMessage, 'success');
      }
      registerForm.reset();
    } catch (error) {
      updateStatus(error?.message || genericError, 'error');
    } finally {
      setButtonLoading(registerSubmitBtn, false);
    }
  });

  function bindProSso(btn) {
    if (!btn) return;
    const providerKey = (btn.dataset.provider || '').toLowerCase();
    if (providerSet.size && !providerSet.has(providerKey)) {
      return;
    }
    btn.addEventListener('click', async () => {
      const provider = btn.dataset.provider || 'SSO';
      setButtonLoading(btn, true);
      clearStatus();
      try {
        const result = await signInWithProvider(provider);
        const session = result?.session || bookingAuthContext.getSession();
        updateStatus(resolveMessage(t, 'authSsoStatusSuccess', 'Σύνδεση επιτυχής με %s.').replace('%s', provider), 'success');
        onAuthenticated?.({ provider, session, mode: 'sso' });
      } catch (error) {
        updateStatus(error?.message || genericError, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  (ssoButtons || []).forEach(bindProSso);

  return {
    clearStatus,
    setStatus: updateStatus
  };
}

function toRoleSet(value) {
  const roles = new Set();
  if (!value) return roles;
  const push = role => {
    if (typeof role === 'string' && role.trim()) {
      roles.add(role.trim().toLowerCase());
    }
  };
  if (Array.isArray(value)) {
    value.forEach(push);
  } else if (typeof value === 'string') {
    value.split(',').forEach(push);
  } else if (typeof value === 'object') {
    Object.values(value).forEach(push);
  }
  return roles;
}

function extractRolesFromSession(session) {
  const roles = new Set();
  if (!session?.user) return roles;
  const { user } = session;
  [
    user.app_metadata?.role,
    user.app_metadata?.roles,
    user.user_metadata?.role,
    user.user_metadata?.roles
  ].forEach(source => {
    toRoleSet(source).forEach(role => roles.add(role));
  });
  if (typeof user.role === 'string') {
    roles.add(user.role.trim().toLowerCase());
  }
  return roles;
}

export function getSessionRoles(session = bookingAuthContext.getSession()) {
  return extractRolesFromSession(session);
}

export async function guardRoute({
  roles = [],
  redirectTo = '/',
  onAuthorized,
  onUnauthorized
} = {}) {
  const required = Array.isArray(roles)
    ? roles.filter(Boolean).map(role => role.toString().toLowerCase())
    : [roles].filter(Boolean).map(role => role.toString().toLowerCase());

  let session = bookingAuthContext.getSession();
  if (!session) {
    try {
      session = await refreshSession();
    } catch (error) {
      console.warn('[guardRoute] refresh failed', error);
    }
  }

  const roleSet = extractRolesFromSession(session);
  const allowed = !required.length || required.some(role => roleSet.has(role));

  if (!allowed) {
    try { onUnauthorized?.({ session, roles: roleSet }); } catch { /* noop */ }
    if (redirectTo) {
      window.location.replace(redirectTo);
    }
    return { allowed: false, session: session || null, roles: roleSet };
  }

  try { onAuthorized?.({ session, roles: roleSet }); } catch { /* noop */ }
  return { allowed: true, session: session || null, roles: roleSet };
}

export { bookingAuthContext };
