// Placeholder for firebase.js
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    appId: "APP_ID"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  document.getElementById("google-login").addEventListener("click", () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        alert("Συνδέθηκε ο χρήστης: " + result.user.displayName);
      })
      .catch((error) => {
        console.error("Σφάλμα σύνδεσης:", error);
      });
  });
</script>
