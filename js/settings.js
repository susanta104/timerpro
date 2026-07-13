/**
 * Study Command Center - Settings
 */
const Settings = (() => {
  async function render() {
    const settings = await Storage.getAllSettings();
    document.getElementById('setting-theme').value = settings.theme;
    document.getElementById('setting-sound').value = settings.sound;
    document.getElementById('setting-notifications').value = settings.notifications;
    document.getElementById('setting-daily-goal').value = settings.dailyGoal;
    document.getElementById('setting-weekly-goal').value = settings.weeklyGoal;
    renderSyncStatus();
  }

  function renderSyncStatus(detail) {
    const status = detail || (window.Sync ? Sync.getStatus() : { signedIn: false });
    const text = document.getElementById('sync-status-text');
    const signInBtn = document.getElementById('sync-signin-btn');
    const signOutBtn = document.getElementById('sync-signout-btn');
    const syncNowBtn = document.getElementById('sync-now-btn');

    if (!window.Sync) {
      text.textContent = 'Cloud sync is not set up yet.';
      signInBtn.classList.add('hidden');
      signOutBtn.classList.add('hidden');
      syncNowBtn.classList.add('hidden');
      return;
    }

    if (status.signedIn) {
      const when = status.lastSyncedAt
        ? new Date(status.lastSyncedAt).toLocaleString()
        : 'not yet';
      text.textContent = `Signed in as ${status.email}. Last synced: ${when}.${status.error ? ' ' + status.error : ''}`;
      signInBtn.classList.add('hidden');
      signOutBtn.classList.remove('hidden');
      syncNowBtn.classList.remove('hidden');
    } else {
      text.textContent = 'Not signed in. Your data stays only on this device.';
      signInBtn.classList.remove('hidden');
      signOutBtn.classList.add('hidden');
      syncNowBtn.classList.add('hidden');
    }
  }

  async function savePreferences() {
    const theme = document.getElementById('setting-theme').value;
    const sound = document.getElementById('setting-sound').value;
    const notifications = document.getElementById('setting-notifications').value;
    const dailyGoal = parseInt(document.getElementById('setting-daily-goal').value);
    const weeklyGoal = parseInt(document.getElementById('setting-weekly-goal').value);

    if (dailyGoal < 1 || dailyGoal > 24) {
      App.showToast('Daily goal must be between 1 and 24 hours', 'error');
      return;
    }
    if (weeklyGoal < 1 || weeklyGoal > 168) {
      App.showToast('Weekly goal must be between 1 and 168 hours', 'error');
      return;
    }

    await Storage.setSetting('theme', theme);
    await Storage.setSetting('sound', sound);
    await Storage.setSetting('notifications', notifications);
    await Storage.setSetting('dailyGoal', dailyGoal);
    await Storage.setSetting('weeklyGoal', weeklyGoal);

    App.applyTheme(theme);

    if (notifications === 'enabled') {
      await Notifications.requestPermission();
    }

    App.showToast('Preferences saved', 'success');
  }

  async function exportAll() {
    const data = await Storage.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-command-center-backup-${Storage.getDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('Backup exported successfully', 'success');
  }

  async function importAll(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await Storage.importAll(data);
      App.showToast('Data imported successfully', 'success');
      if (window.Sync && Sync.getStatus().signedIn) Sync.pushNow();
      render();
      Dashboard.render();
    } catch (e) {
      App.showToast('Failed to import: Invalid backup file', 'error');
    }
  }

  async function handleDangerAction(action) {
    const messages = {
      sessions: {
        title: 'Clear All Sessions',
        message: 'This will permanently delete all study sessions. Are you sure?'
      },
      analytics: {
        title: 'Clear Analytics Data',
        message: 'This will clear all session data used for analytics. Sessions will be deleted. Continue?'
      },
      syllabus: {
        title: 'Reset Syllabus',
        message: 'This will delete all syllabus topics. Are you sure?'
      },
      everything: {
        title: 'Reset Everything',
        message: 'This will delete ALL data including sessions, syllabus, exams, and settings. This cannot be undone!'
      }
    };

    const msg = messages[action];
    if (!msg) return;

    App.showConfirm(msg.title, msg.message, async () => {
      switch (action) {
        case 'sessions':
        case 'analytics':
          await Storage.clearStore(Storage.STORES.sessions);
          break;
        case 'syllabus':
          await Storage.clearStore(Storage.STORES.syllabus);
          break;
        case 'everything':
          await Storage.clearStore(Storage.STORES.sessions);
          await Storage.clearStore(Storage.STORES.syllabus);
          await Storage.clearStore(Storage.STORES.exams);
          await Storage.clearTimerState();
          for (const key of Object.keys(Storage.DEFAULT_SETTINGS)) {
            await Storage.setSetting(key, Storage.DEFAULT_SETTINGS[key]);
          }
          for (const [name, val] of Object.entries(Storage.DEFAULT_SUBJECTS)) {
            await Storage.setSubjectTarget(name, val.weeklyTarget);
          }
          App.applyTheme('auto');
          break;
      }
      App.showToast('Data cleared successfully', 'success');
      render();
      if (App.getCurrentView() === 'dashboard') Dashboard.render();
    });
  }

  function setupEvents() {
    document.getElementById('settings-save').addEventListener('click', savePreferences);
    document.getElementById('settings-test-sound').addEventListener('click', () => {
      Notifications.testSound();
    });
    document.getElementById('setting-sound').addEventListener('change', async () => {
      await Notifications.unlockAudio();
    });
    document.getElementById('settings-export-all').addEventListener('click', exportAll);
    document.getElementById('settings-import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importAll(file);
        e.target.value = '';
      }
    });

    document.querySelectorAll('[data-danger]').forEach(btn => {
      btn.addEventListener('click', () => handleDangerAction(btn.dataset.danger));
    });

    document.getElementById('sync-signin-btn').addEventListener('click', () => {
      if (window.Sync) Sync.signIn();
    });
    document.getElementById('sync-signout-btn').addEventListener('click', () => {
      if (window.Sync) Sync.signOut();
    });
    document.getElementById('sync-now-btn').addEventListener('click', () => {
      if (window.Sync) {
        Sync.pushNow();
        App.showToast('Sync started', 'info');
      }
    });

    document.addEventListener('scc:syncstatus', (e) => renderSyncStatus(e.detail));
  }

  setupEvents();

  return { render };
})();
