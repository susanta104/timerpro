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
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME"
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
