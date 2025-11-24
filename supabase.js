// supabase.js
(function() {
    // 1. Έλεγχος αν υπάρχει η βιβλιοθήκη Supabase (από το CDN στο index.html)
    if (!window.supabase) {
        console.error("❌ CRITICAL: Supabase library not found! Make sure you have the script tag in your HTML head.");
        return;
    }

    // 2. Έλεγχος αν υπάρχουν τα κλειδιά (από το env.js)
    if (!window.ENV || !window.ENV.SUPABASE_URL || !window.ENV.SUPABASE_ANON_KEY) {
        console.error("❌ CRITICAL: Missing Supabase keys in window.ENV. Make sure env.js is loaded first.");
        return;
    }

    // 3. Δημιουργία του Client
    console.log("🔵 Initializing Supabase Client...");
    
    const client = window.supabase.createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    // 4. Αποθήκευση σε global μεταβλητή για χρήση σε όλα τα αρχεία (index.html, pharmacy.html, κλπ)
    window.db = client;
    
    console.log("✅ Supabase Connected! You can now use 'window.db' to make queries.");
})();
