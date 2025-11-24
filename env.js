// env.js
(function () {
    // Έλεγχος αν έχει φορτώσει ήδη για να μην τρέχει διπλά
    if (window.__MEDIRADAR_ENV_LOADED__) return;
    window.__MEDIRADAR_ENV_LOADED__ = true;

    console.log("Loading Environment Variables...");

    // 🔐 ΤΑ ΚΛΕΙΔΙΑ ΣΟΥ (Από το μήνυμά σου)
    window.ENV = {
        SUPABASE_URL: "https://qzerrisyowkfkmcyxmav.supabase.co",
        SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZXJyaXN5b3drZmttY3l4bWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMTcxODQsImV4cCI6MjA3NTU5MzE4NH0.alkvHkOQPBTwY3daUcKAEsf4nt0kizuU3rYI2c2InPk"
    };
})();
