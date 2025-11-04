(function () {
  const client = (function () {
    if (window.mediradarSupabase && typeof window.mediradarSupabase.auth?.signInWithPassword === 'function') {
      return window.mediradarSupabase;
    }
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.auth?.signInWithPassword === 'function') {
      return window.supabase;
    }
    return null;
  })();

  if (!client) {
    console.warn('[demo-login] supabase client not found; skipping bind');
    return;
  }

  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const demoBtns = () => $$('[data-demo-login]');
  const credHints = () => $$('[data-demo-credentials]');

  function currentEmail() {
    return (window.DEMO_EMAIL || 'demo@mediradar.test').trim();
  }

  function currentPassword() {
    return (window.DEMO_PASSWORD || 'demo1234!').trim();
  }

  function setLoading(v) {
    demoBtns().forEach((b) => {
      b.disabled = !!v;
      if (v) {
        b.dataset.loading = '1';
      } else {
        delete b.dataset.loading;
      }
    });
  }

  function renderCredentialHints() {
    const email = currentEmail();
    const password = currentPassword();
    credHints().forEach((el) => {
      el.innerHTML = `Demo: <code>${email}</code> / <code>${password}</code>`;
    });
  }

  async function handleDemoLogin(ev) {
    try {
      ev?.preventDefault?.();
    } catch (_) {}
    setLoading(true);
    const email = currentEmail();
    const password = currentPassword();
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.session) {
        throw new Error('Missing session after sign-in');
      }
      localStorage.setItem('mediradar.demo', '1');
      console.log('[demo-login] signed in as demo');
      location.href = 'pharmacy.html';
    } catch (err) {
      console.error('[demo-login] failed', err);
      alert('Demo login failed: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  function bind() {
    demoBtns().forEach((btn) => {
      if (!btn.__demoBound) {
        btn.addEventListener('click', handleDemoLogin);
        btn.__demoBound = true;
      }
    });
  }

  async function refreshVisibility() {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const loggedIn = !!data?.session;
      demoBtns().forEach((b) => {
        b.hidden = loggedIn;
      });
      credHints().forEach((el) => {
        el.hidden = loggedIn;
      });
    } catch (e) {
      console.warn('[demo-login] getSession failed', e);
    }
  }

  function ready() {
    renderCredentialHints();
    bind();
    refreshVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }

  try {
    client.auth.onAuthStateChange(() => refreshVisibility());
  } catch (err) {
    console.warn('[demo-login] onAuthStateChange unavailable', err);
  }
})();
