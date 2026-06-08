/**
 * Study Command Center - Notifications & Sounds
 */
const Notifications = (() => {
  let permissionGranted = false;
  const audioCache = {};

  const SOUND_FILES = {
    bell: ['assets/sounds/bell.mp3', 'assets/sounds/bell.wav'],
    soft: ['assets/sounds/soft.mp3', 'assets/sounds/soft.wav'],
    digital: ['assets/sounds/digital.mp3', 'assets/sounds/digital.wav']
  };

  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      permissionGranted = true;
      return true;
    }
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      permissionGranted = result === 'granted';
      return permissionGranted;
    }
    return false;
  }

  async function isEnabled() {
    const setting = await Storage.getSetting('notifications');
    return setting === 'enabled';
  }

  async function show(title, options = {}) {
    const enabled = await isEnabled();
    if (!enabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-192.png',
        ...options
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      setTimeout(() => notification.close(), 8000);
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          icon: 'assets/icons/icon-192.png',
          badge: 'assets/icons/icon-192.png',
          ...options
        });
      } catch {
        App.showToast(title, 'info');
      }
    } else {
      App.showToast(title, 'info');
    }
  }

  async function notifySessionComplete(subject, duration) {
    await show('Study Session Complete! 🎉', {
      body: `${subject} — ${Storage.formatDuration(duration)} of focused study. Great work!`,
      tag: 'session-complete',
      requireInteraction: false
    });
    vibrate();
  }

  async function notifyBreakComplete() {
    await show('Break Over!', {
      body: 'Time to get back to studying. You can do this!',
      tag: 'break-complete'
    });
    vibrate();
  }

  async function notifyDailyGoalReached(hours) {
    await show('Daily Goal Achieved! 🏆', {
      body: `You've studied ${hours} hours today. Keep up the momentum!`,
      tag: 'daily-goal'
    });
  }

  async function notifyDailyGoalReminder(remaining) {
    await show('Daily Goal Reminder', {
      body: `You have ${remaining} hours left to reach your daily study goal.`,
      tag: 'daily-reminder'
    });
  }

  function vibrate(pattern = [200, 100, 200]) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Vibration not supported
      }
    }
  }

  function playWebAudioFallback(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const configs = {
        bell: { freq: 830, type: 'sine', duration: 0.8, gain: 0.3 },
        soft: { freq: 440, type: 'triangle', duration: 1.2, gain: 0.2 },
        digital: { freq: 1200, type: 'square', duration: 0.15, gain: 0.15 }
      };
      const cfg = configs[type] || configs.bell;

      osc.type = cfg.type;
      osc.frequency.setValueAtTime(cfg.freq, ctx.currentTime);
      gain.gain.setValueAtTime(cfg.gain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.duration);

      if (type === 'digital') {
        osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.3);
      }

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + cfg.duration + 0.1);
    } catch {
      // Audio not available
    }
  }

  async function playSound(soundType) {
    const type = soundType || await Storage.getSetting('sound') || 'bell';
    const sources = SOUND_FILES[type] || SOUND_FILES.bell;

    if (!audioCache[type]) {
      const paths = Array.isArray(sources) ? sources : [sources];
      audioCache[type] = new Audio(paths[0]);
      audioCache[type].preload = 'auto';
      audioCache[type]._fallbackPaths = paths.slice(1);
    }

    const audio = audioCache[type];
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      if (audio._fallbackPaths?.length) {
        audio.src = audio._fallbackPaths[0];
        audio._fallbackPaths = audio._fallbackPaths.slice(1);
        try {
          await audio.play();
          return;
        } catch {
          // fall through to Web Audio
        }
      }
      playWebAudioFallback(type);
    }
  }

  async function playTimerComplete() {
    const sound = await Storage.getSetting('sound');
    await playSound(sound);
    vibrate([300, 100, 300, 100, 300]);
  }

  function scheduleDailyReminder() {
    if (!('serviceWorker' in navigator)) return;

    const now = new Date();
    const reminder = new Date();
    reminder.setHours(20, 0, 0, 0);

    if (now >= reminder) {
      reminder.setDate(reminder.getDate() + 1);
    }

    const msUntilReminder = reminder - now;

    setTimeout(async () => {
      const enabled = await isEnabled();
      if (!enabled) return;

      const sessions = await Storage.getAll(Storage.STORES.sessions);
      const today = Storage.getDateKey(new Date());
      const todayMinutes = sessions
        .filter(s => Storage.getDateKey(s.date) === today)
        .reduce((sum, s) => sum + (s.duration || 0), 0);

      const dailyGoal = await Storage.getSetting('dailyGoal');
      const goalMinutes = dailyGoal * 60;
      const remaining = Math.max(0, (goalMinutes - todayMinutes) / 60);

      if (remaining > 0) {
        await notifyDailyGoalReminder(remaining.toFixed(1));
      }

      scheduleDailyReminder();
    }, msUntilReminder);
  }

  async function init() {
    await requestPermission();
    scheduleDailyReminder();
  }

  return {
    init,
    requestPermission,
    isEnabled,
    show,
    notifySessionComplete,
    notifyBreakComplete,
    notifyDailyGoalReached,
    notifyDailyGoalReminder,
    playSound,
    playTimerComplete,
    vibrate
  };
})();
