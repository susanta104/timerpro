/**
 * Study Command Center - Storage Layer
 * IndexedDB with LocalStorage fallback
 */
const Storage = (() => {
  const DB_NAME = 'StudyCommandCenterDB';
  const DB_VERSION = 1;
  const LS_PREFIX = 'scc_';
  let db = null;
  let useLocalStorage = false;

  const STORES = {
    sessions: 'sessions',
    syllabus: 'syllabus',
    exams: 'exams',
    settings: 'settings',
    subjects: 'subjects',
    timerState: 'timerState',
    analytics: 'analytics'
  };

  const DEFAULT_SETTINGS = {
    theme: 'auto',
    sound: 'bell',
    notifications: 'enabled',
    dailyGoal: 6,
    weeklyGoal: 40
  };

  const DEFAULT_SUBJECTS = {
    Medicine: { weeklyTarget: 15 },
    Surgery: { weeklyTarget: 12 },
    OBGYN: { weeklyTarget: 10 }
  };

  function openDB() {
    return new Promise((resolve, reject) => {
      if (useLocalStorage) {
        resolve(null);
        return;
      }
      if (db) {
        resolve(db);
        return;
      }
      if (!window.indexedDB) {
        useLocalStorage = true;
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        useLocalStorage = true;
        resolve(null);
      };
      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORES.sessions)) {
          const sessionStore = database.createObjectStore(STORES.sessions, { keyPath: 'id', autoIncrement: true });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('subject', 'subject', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.syllabus)) {
          const syllabusStore = database.createObjectStore(STORES.syllabus, { keyPath: 'id', autoIncrement: true });
          syllabusStore.createIndex('subject', 'subject', { unique: false });
          syllabusStore.createIndex('status', 'status', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.exams)) {
          database.createObjectStore(STORES.exams, { keyPath: 'id', autoIncrement: true });
        }
        if (!database.objectStoreNames.contains(STORES.settings)) {
          database.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(STORES.subjects)) {
          database.createObjectStore(STORES.subjects, { keyPath: 'name' });
        }
        if (!database.objectStoreNames.contains(STORES.timerState)) {
          database.createObjectStore(STORES.timerState, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(STORES.analytics)) {
          database.createObjectStore(STORES.analytics, { keyPath: 'key' });
        }
      };
    });
  }

  function lsGet(key) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function lsRemove(key) {
    localStorage.removeItem(LS_PREFIX + key);
  }

  async function getAll(storeName) {
    await openDB();
    if (useLocalStorage) {
      return lsGet(storeName) || [];
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function getById(storeName, id) {
    await openDB();
    if (useLocalStorage) {
      const items = lsGet(storeName) || [];
      return items.find(item => String(item.id) === String(id)) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      // IndexedDB auto-increment keys are numbers; coerce string ids from
      // dataset attributes back to numbers so the lookup succeeds.
      const numericId = Number(id);
      const lookupId = Number.isFinite(numericId) ? numericId : id;
      const request = tx.objectStore(storeName).get(lookupId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function add(storeName, item) {
    await openDB();
    const cleanItem = { ...item };
    delete cleanItem.id;

    if (useLocalStorage) {
      const items = lsGet(storeName) || [];
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newItem = { ...cleanItem, id };
      items.push(newItem);
      lsSet(storeName, items);
      return newItem;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(cleanItem);
      request.onsuccess = () => {
        resolve({ ...cleanItem, id: request.result });
      };
      request.onerror = () => reject(request.error || new Error('Failed to add record'));
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
    });
  }

  async function addSession(session) {
    const subject = session.subject || 'Medicine';
    const duration = Number(session.duration);
    if (!subject || !duration || duration <= 0) {
      throw new Error('Invalid session: subject and duration are required');
    }
    return add(STORES.sessions, {
      date: session.date || new Date().toISOString(),
      subject,
      topic: session.topic || '',
      duration: Math.round(duration * 10) / 10,
      notes: session.notes || '',
      source: session.source || 'timer'
    });
  }

  async function put(storeName, item) {
    await openDB();
    if (useLocalStorage) {
      const items = lsGet(storeName) || [];
      const idx = items.findIndex(i => String(i.id) === String(item.id));
      if (idx >= 0) {
        items[idx] = item;
      } else {
        items.push(item);
      }
      lsSet(storeName, items);
      return item;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async function remove(storeName, id) {
    await openDB();
    if (useLocalStorage) {
      const items = (lsGet(storeName) || []).filter(i => String(i.id) !== String(id));
      lsSet(storeName, items);
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      // IndexedDB auto-increment keys are numbers; coerce string ids from
      // dataset attributes back to numbers so the delete succeeds.
      const numericId = Number(id);
      const lookupId = Number.isFinite(numericId) ? numericId : id;
      const request = tx.objectStore(storeName).delete(lookupId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async function clearStore(storeName) {
    await openDB();
    if (useLocalStorage) {
      lsRemove(storeName);
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async function getSetting(key) {
    await openDB();
    if (useLocalStorage) {
      const settings = lsGet('settings') || DEFAULT_SETTINGS;
      return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.settings, 'readonly');
      const request = tx.objectStore(STORES.settings).get(key);
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : DEFAULT_SETTINGS[key]);
      };
      request.onerror = () => resolve(DEFAULT_SETTINGS[key]);
    });
  }

  async function setSetting(key, value) {
    await openDB();
    if (useLocalStorage) {
      const settings = lsGet('settings') || { ...DEFAULT_SETTINGS };
      settings[key] = value;
      lsSet('settings', settings);
      return value;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.settings, 'readwrite');
      const request = tx.objectStore(STORES.settings).put({ key, value });
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllSettings() {
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      settings[key] = await getSetting(key);
    }
    return settings;
  }

  async function getSubjectTarget(name) {
    await openDB();
    if (useLocalStorage) {
      const subjects = lsGet('subjects') || DEFAULT_SUBJECTS;
      return subjects[name]?.weeklyTarget ?? DEFAULT_SUBJECTS[name]?.weeklyTarget ?? 10;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.subjects, 'readonly');
      const request = tx.objectStore(STORES.subjects).get(name);
      request.onsuccess = () => {
        resolve(request.result?.weeklyTarget ?? DEFAULT_SUBJECTS[name]?.weeklyTarget ?? 10);
      };
      request.onerror = () => resolve(10);
    });
  }

  async function setSubjectTarget(name, weeklyTarget) {
    await openDB();
    const data = { name, weeklyTarget };
    if (useLocalStorage) {
      const subjects = lsGet('subjects') || { ...DEFAULT_SUBJECTS };
      subjects[name] = { weeklyTarget };
      lsSet('subjects', subjects);
      return data;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.subjects, 'readwrite');
      const request = tx.objectStore(STORES.subjects).put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async function getTimerState() {
    await openDB();
    if (useLocalStorage) {
      return lsGet('timerState') || null;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.timerState, 'readonly');
      const request = tx.objectStore(STORES.timerState).get('current');
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  }

  async function setTimerState(state) {
    await openDB();
    if (useLocalStorage) {
      lsSet('timerState', state);
      return state;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.timerState, 'readwrite');
      const request = tx.objectStore(STORES.timerState).put({ key: 'current', value: state });
      request.onsuccess = () => resolve(state);
      request.onerror = () => reject(request.error);
    });
  }

  async function clearTimerState() {
    await openDB();
    if (useLocalStorage) {
      lsRemove('timerState');
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.timerState, 'readwrite');
      const request = tx.objectStore(STORES.timerState).delete('current');
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async function exportAll() {
    const [sessions, syllabus, exams, settings, subjects] = await Promise.all([
      getAll(STORES.sessions),
      getAll(STORES.syllabus),
      getAll(STORES.exams),
      getAllSettings(),
      useLocalStorage ? (lsGet('subjects') || DEFAULT_SUBJECTS) : getAll(STORES.subjects)
    ]);
    const timerState = await getTimerState();
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessions,
      syllabus,
      exams,
      settings,
      subjects,
      timerState
    };
  }

  async function importAll(data) {
    if (!data || !data.version) throw new Error('Invalid backup file');
    if (data.sessions) {
      await clearStore(STORES.sessions);
      for (const session of data.sessions) {
        await put(STORES.sessions, session);
      }
    }
    if (data.syllabus) {
      await clearStore(STORES.syllabus);
      for (const topic of data.syllabus) {
        await put(STORES.syllabus, topic);
      }
    }
    if (data.exams) {
      await clearStore(STORES.exams);
      for (const exam of data.exams) {
        await put(STORES.exams, exam);
      }
    }
    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        await setSetting(key, value);
      }
    }
    if (data.subjects) {
      if (Array.isArray(data.subjects)) {
        for (const sub of data.subjects) {
          await setSubjectTarget(sub.name, sub.weeklyTarget);
        }
      } else {
        for (const [name, val] of Object.entries(data.subjects)) {
          await setSubjectTarget(name, val.weeklyTarget);
        }
      }
    }
    if (data.timerState) {
      await setTimerState(data.timerState);
    }
    return true;
  }

  async function init() {
    await openDB();
    const settings = await getAllSettings();
    for (const name of ['Medicine', 'Surgery', 'OBGYN']) {
      const target = await getSubjectTarget(name);
      if (!target) {
        await setSubjectTarget(name, DEFAULT_SUBJECTS[name].weeklyTarget);
      }
    }
    return settings;
  }

  function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function formatHours(minutes) {
    const hours = minutes / 60;
    if (hours < 1) return `${Math.round(minutes)}m`;
    return `${hours.toFixed(1)}h`;
  }

  function getDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  }

  function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getStartOfMonth(date = new Date()) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isSameDay(d1, d2) {
    return getDateKey(d1) === getDateKey(d2);
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  return {
    STORES,
    DEFAULT_SETTINGS,
    DEFAULT_SUBJECTS,
    init,
    getAll,
    getById,
    add,
    addSession,
    put,
    remove,
    clearStore,
    getSetting,
    setSetting,
    getAllSettings,
    getSubjectTarget,
    setSubjectTarget,
    getTimerState,
    setTimerState,
    clearTimerState,
    exportAll,
    importAll,
    formatDuration,
    formatHours,
    getDateKey,
    getStartOfWeek,
    getStartOfMonth,
    isSameDay,
    generateId,
    isUsingLocalStorage: () => useLocalStorage
  };
})();
