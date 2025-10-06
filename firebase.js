import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase configuration (βάλε τα δικά σου στοιχεία από Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Παρακολούθηση κατάστασης χρήστη
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Ο χρήστης είναι συνδεδεμένος:", user.email);
    document.getElementById("google-login").style.display = "none";
    document.getElementById("logout-btn").style.display = "block";
  } else {
    console.log("Ο χρήστης δεν είναι συνδεδεμένος.");
    document.getElementById("google-login").style.display = "block";
    document.getElementById("logout-btn").style.display = "none";
  }
});

// Σύνδεση με Google
document.getElementById("google-login").addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      alert("Συνδέθηκε ο χρήστης: " + result.user.displayName);
    })
    .catch((error) => {
      console.error("Σφάλμα σύνδεσης:", error);
    });
});

// Αποσύνδεση
document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      alert("Αποσυνδεθήκατε με επιτυχία.");
    })
    .catch((error) => {
      console.error("Σφάλμα αποσύνδεσης:", error);
    });
});

// Υποβολή φόρμας φαρμάκου στο Firestore
document.getElementById("medicine-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = {
    medicineName: document.getElementById("medicine-name").value,
    activeSubstance: document.getElementById("active-substance").value,
    medicineType: document.getElementById("medicine-type").value,
    quantity: document.getElementById("quantity").value,
    allowGeneric: document.querySelector('input[name="allow-generic"]:checked')?.value,
    city: document.getElementById("city").value,
    gdprAccepted: document.getElementById("gdpr-checkbox").checked,
    timestamp: new Date()
  };

  try {
    await addDoc(collection(db, "medicine_requests"), formData);
    alert("Η αίτηση καταχωρήθηκε με επιτυχία!");
    document.getElementById("medicine-form").reset();
  } catch (error) {
    console.error("Σφάλμα κατά την υποβολή:", error);
    alert("Παρουσιάστηκε σφάλμα κατά την υποβολή.");
  }
});
