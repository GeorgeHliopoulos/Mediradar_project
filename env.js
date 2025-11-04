// env.js
// Φορτώνεται ΜΟΝΟ μία φορά, ακόμα κι αν το βάλεις σε πολλά HTML

(function () {
  // αν έχει ήδη φορτωθεί, βγες
  if (window.__MEDIRADAR_ENV_LOADED__) return;
  window.__MEDIRADAR_ENV_LOADED__ = true;

  // 🔐 ΒΑΛΕ ΕΔΩ ΤΑ ΔΙΚΑ ΣΟΥ
  const SUPABASE_URL = "https://qzerrisyowkfkmcyxmav.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZXJyaXN5b3drZmttY3l4bWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTcxODQsImV4cCI6MjA3NTU5MzE4NH0.alkvHkOQPBTwY3daUcKAEsf4nt0kizuU3rYI2c2InPk";

  // διαθέσιμα global
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  window.DEMO_EMAIL = window.DEMO_EMAIL || (window.ENV?.DEMO_EMAIL ?? 'demo@mediradar.test');
  window.DEMO_PASSWORD = window.DEMO_PASSWORD || (window.ENV?.DEMO_PASSWORD ?? 'demo1234!');

  // αν έχει ήδη φορτωθεί το supabase-js από το HTML, φτιάξε client ΜΙΑ φορά
  if (window.supabase && !window.mediradarSupabase) {
    window.mediradarSupabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }
})();
