/**
 * Study Command Center - Notifications & Sounds
 * Uses Web Audio API (primary) with WAV file fallback.
 */
const Notifications = (() => {
  let permissionGranted = false;
  let audioCtx = null;
  let audioUnlocked = false;
  const wavBuffers = {};

  const SOUND_WAV = {
    bell: 'assets/sounds/bell.wav',
    soft: 'assets/sounds/soft.wav',
    digital: 'assets/sounds/digital.wav'
  };

  function assetUrl(path) {
    return new URL(path, window.location.href).href;
  }

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  }

  async function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    if (!audioUnlocked) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      source.stop(0);
      audioUnlocked = true;
    }

    return ctx.state === 'running';
  }

  function setupAudioUnlock() {
    const unlock = () => {
      unlockAudio();
    };
    const events = ['click', 'touchstart', 'keydown', 'pointerdown'];
    events.forEach((evt) => {
      document.addEventListener(evt, unlock, { once: false, passive: true });
    });
  }

  async function loadWavBuffer(type) {
    if (wavBuffers[type]) return wavBuffers[type];

    const ctx = getAudioContext();
    if (!ctx) return null;

    try {
      const response = await fetch(assetUrl(SOUND_WAV[type]));
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      wavBuffers[type] = await ctx.decodeAudioData(arrayBuffer);
      return wavBuffers[type];
    } catch {
      return null;
    }
  }

  async function preloadSounds() {
    await unlockAudio();
    await Promise.all(
      Object.keys(SOUND_WAV).map((type) => loadWavBuffer(type).catch(() => null))
    );
  }

  function playBuffer(buffer, volume = 0.7) {
    const ctx = getAudioContext();
    if (!ctx || !buffer) return false;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  }

  function playBellSynth(ctx, startTime) {
    const notes = [
      { freq: 830, delay: 0, duration: 0.9 },
      { freq: 1245, delay: 0.15, duration: 0.85 }
    ];
    notes.forEach(({ freq, delay, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + delay);
      gain.gain.setValueAtTime(0.0001, startTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.45, startTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime + delay);
      osc.stop(startTime + delay + duration + 0.05);
    });
  }

  function playSoftSynth(ctx, startTime) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, startTime);
    osc.frequency.exponentialRampToValueAtTime(392, startTime + 1.4);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 1.6);
  }

  function playDigitalSynth(ctx, startTime) {
    const beeps = [0, 0.22, 0.44];
    beeps.forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, startTime + delay);
      gain.gain.setValueAtTime(0.0001, startTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.2, startTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + delay + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime + delay);
      osc.stop(startTime + delay + 0.16);
    });
  }

  const SYNTH_PLAYERS = {
    bell: playBellSynth,
    soft: playSoftSynth,
    digital: playDigitalSynth
  };

  async function playSound(soundType) {
    const type = soundType || (await Storage.getSetting('sound')) || 'bell';
    const sound = SYNTH_PLAYERS[type] ? type : 'bell';

    const unlocked = await unlockAudio();
    if (!unlocked) {
      App.showToast('Tap anywhere on the app to enable sounds', 'info');
      return;
    }

    const buffer = await loadWavBuffer(sound);
    if (buffer && playBuffer(buffer, 0.75)) {
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const player = SYNTH_PLAYERS[sound] || SYNTH_PLAYERS.bell;
    player(ctx, ctx.currentTime);
  }

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
        icon: assetUrl('assets/icons/icon-192.png'),
        badge: assetUrl('assets/icons/icon-192.png'),
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
          icon: assetUrl('assets/icons/icon-192.png'),
          badge: assetUrl('assets/icons/icon-192.png'),
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
  }

  async function notifyBreakComplete() {
    await show('Break Over!', {
      body: 'Time to get back to studying. You can do this!',
      tag: 'break-complete'
    });
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

  async function playTimerComplete() {
    const sound = await Storage.getSetting('sound');
    await playSound(sound);
    vibrate([300, 100, 300, 100, 300]);
  }

  async function testSound() {
    const sound = document.getElementById('setting-sound')?.value
      || (await Storage.getSetting('sound'))
      || 'bell';
    await unlockAudio();
    await playSound(sound);
    App.showToast(`Playing "${sound}" sound`, 'info');
  }

  function scheduleDailyReminder() {
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
        .filter((s) => Storage.getDateKey(s.date) === today)
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
    setupAudioUnlock();
    await requestPermission();
    scheduleDailyReminder();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        unlockAudio();
      }
    });
  }

  return {
    init,
    unlockAudio,
    preloadSounds,
    requestPermission,
    isEnabled,
    show,
    notifySessionComplete,
    notifyBreakComplete,
    notifyDailyGoalReached,
    notifyDailyGoalReminder,
    playSound,
    playTimerComplete,
    testSound,
    vibrate
  };
})();
