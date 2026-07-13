/**
 * Study Command Center - Cloud Sync (optional)
 *
 * Strategy: IndexedDB/localStorage (js/storage.js) stays the source of truth
 * on every device. This file only mirrors Storage.exportAll() snapshots to
 * a single Firestore document per user, and pulls them back down on other
 * devices. It never talks to Firestore unless the user explicitly signs in.
 *
 * Conflict handling is whole-snapshot last-write-wins, compared by
 * `exportedAt`. Fine for one person using a couple of devices at different
 * times; simultaneous offline edits on two devices can overwrite each other.
 */

import { auth, db, provider } from './firebase-init.js';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const Sync = (() => {
  const DEBOUNCE_MS = 2000;

  let debounceTimer = null;
  let unsubscribeSnapshot = null;
  let currentUser = null;
  let lastSyncedAt = null;
  let pushInFlight = false;

  function snapshotRef(uid) {
    return doc(db, 'users', uid, 'data', 'snapshot');
  }

  function emitStatus(extra = {}) {
    document.dispatchEvent(new CustomEvent('scc:syncstatus', {
      detail: {
        signedIn: !!currentUser,
        email: currentUser?.email || null,
        lastSyncedAt,
        ...extra
      }
    }));
  }

  async function pushNow() {
    if (!currentUser || pushInFlight) return;
    pushInFlight = true;
    try {
      const data = await Storage.exportAll();
      data.exportedAt = new Date().toISOString();
      await setDoc(snapshotRef(currentUser.uid), {
        payload: data,
        updatedAt: serverTimestamp()
      });
      lastSyncedAt = data.exportedAt;
      emitStatus();
    } catch (err) {
      console.error('Sync push failed:', err);
      emitStatus({ error: 'Push failed. Will retry on next change.' });
    } finally {
      pushInFlight = false;
    }
  }

  function schedulePush() {
    if (!currentUser) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(pushNow, DEBOUNCE_MS);
  }

  async function pullOnce() {
    const snap = await getDoc(snapshotRef(currentUser.uid));
    if (!snap.exists()) {
      // Nothing in the cloud yet for this account — push what we have locally.
      await pushNow();
      return;
    }
    const remote = snap.data().payload;
    const local = await Storage.exportAll();
    const remoteTime = remote?.exportedAt ? new Date(remote.exportedAt).getTime() : 0;
    const localTime = local?.exportedAt ? new Date(local.exportedAt).getTime() : 0;

    if (remoteTime > localTime) {
      await Storage.importAll(remote);
      lastSyncedAt = remote.exportedAt;
      App.showToast('Synced latest data from the cloud', 'success');
      // Refresh whatever view is on screen since data changed under it.
      if (typeof App.refreshStudyViews === 'function') App.refreshStudyViews();
    } else {
      await pushNow();
    }
    emitStatus();
  }

  function watchRemote() {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = onSnapshot(snapshotRef(currentUser.uid), (snap) => {
      // Skip echoes of our own not-yet-server-confirmed writes.
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) return;
      const remote = snap.data().payload;
      if (remote?.exportedAt === lastSyncedAt) return; // already have this version
      Storage.importAll(remote).then(() => {
        lastSyncedAt = remote.exportedAt;
        App.showToast('Updated from another device', 'info');
        if (typeof App.refreshStudyViews === 'function') App.refreshStudyViews();
        emitStatus();
      });
    });
  }

  function stopWatching() {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }

  async function signIn() {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Sign-in failed:', err);
      App.showToast('Sign-in failed. Please try again.', 'error');
    }
  }

  async function signOutUser() {
    stopWatching();
    await signOut(auth);
  }

  function init() {
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        emitStatus();
        await pullOnce();
        watchRemote();
      } else {
        stopWatching();
        lastSyncedAt = null;
        emitStatus();
      }
    });

    document.addEventListener('scc:datachange', schedulePush);
  }

  function getStatus() {
    return {
      signedIn: !!currentUser,
      email: currentUser?.email || null,
      lastSyncedAt
    };
  }

  return { init, signIn, signOut: signOutUser, pushNow, getStatus };
})();

window.Sync = Sync;
