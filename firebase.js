import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAJ6Ne7omGaFr7Giw0lP5kvojBZetSqjiE",
  authDomain: "mediradar-wpa.firebaseapp.com",
  projectId: "mediradar-wpa",
  storageBucket: "mediradar-wpa.firebasestorage.app",
  messagingSenderId: "837076454271",
  appId: "1:837076454271:web:3c337f450b908011af684a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Monitor user authentication state
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Ο χρήστης είναι συνδεδεμένος:", user.email);
    document.getElementById("user-info").textContent = `Καλωσήρθες, ${user.displayName}`;
    document.getElementById("logout-btn").style.display = "inline-block";
  } else {
    console.log("Ο χρήστης δεν είναι συνδεδεμένος.");
    document.getElementById("user-info").textContent = "";
    document.getElementById("logout-btn").style.display = "none";
  }
});

// Google login button
document.getElementById("google-login").addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      alert("Συνδέθηκε ο χρήστης: " + result.user.displayName);
    })
    .catch((error) => {
      console.error("Σφάλμα σύνδεσης:", error);
    });
});

// Logout button
document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth).then(() => {
    alert("Αποσυνδεθήκατε με επιτυχία.");
  }).catch((error) => {
    console.error("Σφάλμα αποσύνδεσης:", error);
  });
});

// Submit medicine request form
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
