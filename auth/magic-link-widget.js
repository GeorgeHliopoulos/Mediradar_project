import { supabaseClient } from '../firebase.js';

const REDIRECT_URL = 'https://mediradar.gr/';

function createElement(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (typeof textContent === 'string') {
    el.textContent = textContent;
  }
  return el;
}

function normalizeTargets(target) {
  if (!target) return [];
  if (typeof target === 'string') {
    return Array.from(document.querySelectorAll(target));
  }
  if (target instanceof Element) {
    return [target];
  }
  if (target instanceof NodeList || Array.isArray(target)) {
    return Array.from(target).filter(node => node instanceof Element);
  }
  return [];
}

function updateStatus(statusEl, type, message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('is-error', 'is-success');
  if (type === 'success') {
    statusEl.classList.add('is-success');
  } else if (type === 'error') {
    statusEl.classList.add('is-error');
  }
}

function setLoading(button, isLoading) {
  if (!button) return;
  button.disabled = !!isLoading;
  button.classList.toggle('is-loading', !!isLoading);
  button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Sending…';
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

async function handleMagicLinkSubmit({
  emailInput,
  modeInputs,
  button,
  statusEl
}) {
  const email = emailInput?.value?.trim() || '';
  if (!email) {
    updateStatus(statusEl, 'error', 'Please enter your email.');
    emailInput?.setAttribute('aria-invalid', 'true');
    emailInput?.focus();
    return;
  }
  emailInput?.setAttribute('aria-invalid', 'false');
  const selectedMode = modeInputs?.find?.(input => input.checked)?.value || 'login';
  const shouldCreateUser = selectedMode !== 'login';

  if (!supabaseClient) {
    updateStatus(statusEl, 'error', 'Supabase is not configured.');
    return;
  }

  updateStatus(statusEl, null, '');
  setLoading(button, true);

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: REDIRECT_URL,
        shouldCreateUser,
        data: { flow: selectedMode }
      }
    });
    if (error) throw error;
    updateStatus(statusEl, 'success', 'Email sent! Check your inbox to log in.');
    emailInput?.setAttribute('aria-invalid', 'false');
  } catch (error) {
    const message = error?.message || 'Something went wrong. Please try again.';
    updateStatus(statusEl, 'error', message);
    emailInput?.setAttribute('aria-invalid', 'true');
  } finally {
    setLoading(button, false);
  }
}

export function initMagicLinkWidget(target = '[data-magic-link-root]') {
  const roots = normalizeTargets(target);
  if (!roots.length) return [];

  return roots.map(root => {
    root.classList.add('magic-link-card');

    const heading = createElement('h2', 'magic-link-title', 'Access your MediRadar account');
    const description = createElement('p', 'magic-link-description', 'Get a secure magic link in your inbox to log in or create an account.');

    const form = createElement('form', 'magic-link-form');
    form.setAttribute('novalidate', '');

    const emailInputId = `magic-link-email-${Math.random().toString(36).slice(2, 8)}`;

    const emailLabel = createElement('label', 'magic-link-label', 'Email address');
    emailLabel.setAttribute('for', emailInputId);

    const emailInput = createElement('input', 'magic-link-input');
    emailInput.type = 'email';
    emailInput.id = emailInputId;
    emailInput.name = 'email';
    emailInput.placeholder = 'you@example.com';
    emailInput.autocomplete = 'email';
    emailInput.required = true;

    const modeWrapper = createElement('div', 'magic-link-mode');
    const loginOption = createElement('label', 'magic-link-radio');
    const loginInput = createElement('input');
    loginInput.type = 'radio';
    loginInput.name = 'magic-link-mode';
    loginInput.value = 'login';
    loginInput.checked = true;
    const loginText = createElement('span', null, 'Log in');
    loginOption.append(loginInput, loginText);

    const signupOption = createElement('label', 'magic-link-radio');
    const signupInput = createElement('input');
    signupInput.type = 'radio';
    signupInput.name = 'magic-link-mode';
    signupInput.value = 'signup';
    const signupText = createElement('span', null, 'Sign up');
    signupOption.append(signupInput, signupText);
    modeWrapper.append(loginOption, signupOption);

    function updateModeStyles() {
      loginOption.classList.toggle('is-active', !!loginInput.checked);
      signupOption.classList.toggle('is-active', !!signupInput.checked);
    }

    loginInput.addEventListener('change', updateModeStyles);
    signupInput.addEventListener('change', updateModeStyles);
    updateModeStyles();

    const button = createElement('button', 'magic-link-button', 'Send magic link');
    button.type = 'submit';

    const statusEl = createElement('p', 'magic-link-status');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

    form.addEventListener('submit', event => {
      event.preventDefault();
      handleMagicLinkSubmit({
        emailInput,
        modeInputs: [loginInput, signupInput],
        button,
        statusEl
      });
    });

    form.append(emailLabel, emailInput, modeWrapper, button, statusEl);
    root.replaceChildren(heading, description, form);

    return {
      root,
      form,
      emailInput,
      modeInputs: [loginInput, signupInput],
      button,
      statusEl
    };
  });
}

