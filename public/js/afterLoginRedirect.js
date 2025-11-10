import { init, client } from '/js/supabaseClient.js';

(async () => {
  try {
    await init();
    const sb = client();
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && window.location.pathname !== '/pharmacy.html') {
        window.location.href = '/pharmacy.html';
      }
    });
  } catch (error) {
    console.error('afterLoginRedirect init error:', error);
  }
})();
