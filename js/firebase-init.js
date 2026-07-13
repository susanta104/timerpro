/**
 * Study Command Center - Firebase Initialization
 *
 * ONLY edit the firebaseConfig object below. Paste in the values
 * Firebase gives you when you register a Web App (Project Settings > Add App > Web).
 *
 * This file intentionally does nothing else — no auth logic, no Firestore
 * calls — so it's easy to see exactly what touches your Firebase credentials.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ============================================================
// PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAFp8M3GpEIb2mnIxrjpR5EBhchjIlU3Vw",
  authDomain: "study-command-center-38161.firebaseapp.com",
  projectId: "study-command-center-38161",
  storageBucket: "study-command-center-38161.firebasestorage.app",
  messagingSenderId: "466525188921",
  appId: "1:466525188921:web:a7bfb8a780d0535920aee8"
};
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Firestore with local caching so reads while offline don't count against
// quota and the app keeps working without a connection.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({})
});

export { app, auth, db, provider };
