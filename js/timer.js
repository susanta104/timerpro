/**
 * Study Command Center - Pomodoro Timer
 */
const Timer = (() => {
  const RING_CIRCUMFERENCE = 2 * Math.PI * 90;

  let mode = 'pomodoro';
  let workMinutes = 25;
  let shortBreakMinutes = 5;
  let longBreakMinutes = 15;
  let totalSeconds = 25 * 60;
  let remainingSeconds = totalSeconds;
  let isRunning = false;
  let isPaused = false;
  let intervalId = null;
  let endTimestamp = null;
  let wakeLock = null;
  let pomodoroCount = 0;

  const modeLabels = {
    'pomodoro': 'Focus Time',
    'short-break': 'Short Break',
    'long-break': 'Long Break',
    'custom': 'Custom Timer'
  };

  function getElements() {
    return {
      display: document.getElementById('timer-display'),
      modeLabel: document.getElementById('timer-mode-label'),
      ring: document.getElementById('timer-ring-progress'),
      startBtn: document.getElementById('timer-start'),
      pauseBtn: document.getElementById('timer-pause'),
      resumeBtn: document.getElementById('timer-resume'),
      resetBtn: document.getElementById('timer-reset'),
      presets: document.getElementById('timer-presets'),
      customInputs: document.getElementById('custom-timer-inputs')
    };
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateDisplay() {
    const els = getElements();
    els.display.textContent = formatTime(remainingSeconds);
    els.modeLabel.textContent = modeLabels[mode] || 'Timer';

    const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    els.ring.style.strokeDashoffset = offset;
    els.ring.style.strokeDasharray = RING_CIRCUMFERENCE;
  }

  function updateControls() {
    const els = getElements();
    els.startBtn.classList.toggle('hidden', isRunning || isPaused);
    els.pauseBtn.classList.toggle('hidden', !isRunning);
    els.resumeBtn.classList.toggle('hidden', !isPaused);
    document.querySelector('.timer-container')?.classList.toggle('timer-running', isRunning);
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });

    const els = getElements();
    els.presets.classList.toggle('hidden', mode === 'custom');
    els.customInputs.classList.toggle('hidden', mode !== 'custom');

    if (mode === 'pomodoro') {
      totalSeconds = workMinutes * 60;
    } else if (mode === 'short-break') {
      totalSeconds = shortBreakMinutes * 60;
    } else if (mode === 'long-break') {
      totalSeconds = longBreakMinutes * 60;
    } else if (mode === 'custom') {
      const mins = parseInt(document.getElementById('custom-minutes').value) || 25;
      const secs = parseInt(document.getElementById('custom-seconds').value) || 0;
      totalSeconds = mins * 60 + secs;
    }

    if (!isRunning && !isPaused) {
      remainingSeconds = totalSeconds;
    }
    updateDisplay();
    saveState();
  }

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch {
        // Wake lock not available
      }
    }
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch {
        // Already released
      }
      wakeLock = null;
    }
  }

  async function saveState() {
    if (isRunning || isPaused) {
      await Storage.setTimerState({
        mode,
        workMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        totalSeconds,
        remainingSeconds,
        isRunning,
        isPaused,
        endTimestamp,
        subject: document.getElementById('timer-subject').value,
        topic: document.getElementById('timer-topic').value,
        pomodoroCount
      });
    }
  }

  async function loadState() {
    const state = await Storage.getTimerState();
    if (!state) return;

    mode = state.mode || 'pomodoro';
    workMinutes = state.workMinutes || 25;
    shortBreakMinutes = state.shortBreakMinutes || 5;
    longBreakMinutes = state.longBreakMinutes || 15;
    totalSeconds = state.totalSeconds;
    pomodoroCount = state.pomodoroCount || 0;

    if (state.subject) document.getElementById('timer-subject').value = state.subject;
    if (state.topic) document.getElementById('timer-topic').value = state.topic;

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (state.isRunning && state.endTimestamp) {
      const now = Date.now();
      remainingSeconds = Math.max(0, Math.ceil((state.endTimestamp - now) / 1000));
      if (remainingSeconds > 0) {
        isRunning = true;
        endTimestamp = state.endTimestamp;
        startInterval();
        requestWakeLock();
        App.showToast('Timer resumed from previous session', 'info');
      } else {
        await onComplete();
      }
    } else if (state.isPaused) {
      remainingSeconds = state.remainingSeconds;
      isPaused = true;
    } else {
      remainingSeconds = state.remainingSeconds || totalSeconds;
    }

    updateDisplay();
    updateControls();
  }

  function startInterval() {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
      const now = Date.now();
      remainingSeconds = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
      updateDisplay();
      saveState();

      if (remainingSeconds <= 0) {
        onComplete();
      }
    }, 200);
  }

  function start() {
    if (isRunning) return;

    if (!isPaused) {
      setMode(mode);
    }

    isRunning = true;
    isPaused = false;
    endTimestamp = Date.now() + remainingSeconds * 1000;

    startInterval();
    requestWakeLock();
    updateControls();
    saveState();
  }

  function pause() {
    if (!isRunning) return;
    isRunning = false;
    isPaused = true;
    clearInterval(intervalId);
    remainingSeconds = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
    releaseWakeLock();
    updateControls();
    saveState();
  }

  function resume() {
    if (!isPaused) return;
    isRunning = true;
    isPaused = false;
    endTimestamp = Date.now() + remainingSeconds * 1000;
    startInterval();
    requestWakeLock();
    updateControls();
    saveState();
  }

  async function reset() {
    isRunning = false;
    isPaused = false;
    clearInterval(intervalId);
    releaseWakeLock();
    setMode(mode);
    updateControls();
    await Storage.clearTimerState();
  }

  async function onComplete() {
    isRunning = false;
    isPaused = false;
    clearInterval(intervalId);
    releaseWakeLock();
    updateControls();

    await Notifications.playTimerComplete();

    if (mode === 'pomodoro') {
      const subject = document.getElementById('timer-subject').value;
      const topic = document.getElementById('timer-topic').value;
      const duration = workMinutes;

      await Storage.add(Storage.STORES.sessions, {
        date: new Date().toISOString(),
        subject,
        topic: topic || '',
        duration,
        notes: `Pomodoro session (${workMinutes} min)`
      });

      pomodoroCount++;
      await Notifications.notifySessionComplete(subject, duration);

      const sessions = await Storage.getAll(Storage.STORES.sessions);
      const today = Storage.getDateKey(new Date());
      const todayMinutes = sessions
        .filter(s => Storage.getDateKey(s.date) === today)
        .reduce((sum, s) => sum + (s.duration || 0), 0);
      const dailyGoal = await Storage.getSetting('dailyGoal');
      if (todayMinutes / 60 >= dailyGoal) {
        await Notifications.notifyDailyGoalReached((todayMinutes / 60).toFixed(1));
      }

      if (pomodoroCount % 4 === 0) {
        mode = 'long-break';
        App.showToast('Great work! Time for a long break.', 'success');
      } else {
        mode = 'short-break';
        App.showToast('Pomodoro complete! Take a short break.', 'success');
      }
    } else {
      await Notifications.notifyBreakComplete();
      mode = 'pomodoro';
      App.showToast('Break over! Ready for another session?', 'info');
    }

    setMode(mode);
    await Storage.clearTimerState();
    renderStats();

    if (App.getCurrentView() === 'dashboard') Dashboard.render();
  }

  async function renderStats() {
    const sessions = await Storage.getAll(Storage.STORES.sessions);
    const now = new Date();
    const today = Storage.getDateKey(now);
    const weekStart = Storage.getStartOfWeek();

    const todayMin = sessions
      .filter(s => Storage.getDateKey(s.date) === today)
      .reduce((sum, s) => sum + (s.duration || 0), 0);

    const weekMin = sessions
      .filter(s => new Date(s.date) >= weekStart)
      .reduce((sum, s) => sum + (s.duration || 0), 0);

    document.getElementById('timer-today-total').textContent = Storage.formatHours(todayMin);
    document.getElementById('timer-week-total').textContent = Storage.formatHours(weekMin);
  }

  function setupEvents() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isRunning) setMode(btn.dataset.mode);
      });
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isRunning || isPaused) return;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        workMinutes = parseInt(btn.dataset.work);
        shortBreakMinutes = parseInt(btn.dataset.short);
        longBreakMinutes = parseInt(btn.dataset.long);
        if (mode === 'pomodoro') setMode('pomodoro');
      });
    });

    document.getElementById('custom-minutes').addEventListener('change', () => {
      if (mode === 'custom' && !isRunning) setMode('custom');
    });
    document.getElementById('custom-seconds').addEventListener('change', () => {
      if (mode === 'custom' && !isRunning) setMode('custom');
    });

    document.getElementById('timer-start').addEventListener('click', start);
    document.getElementById('timer-pause').addEventListener('click', pause);
    document.getElementById('timer-resume').addEventListener('click', resume);
    document.getElementById('timer-reset').addEventListener('click', reset);

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && isRunning && endTimestamp) {
        remainingSeconds = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
        updateDisplay();
        if (remainingSeconds <= 0) {
          await onComplete();
        } else {
          requestWakeLock();
        }
      }
    });
  }

  async function render() {
    renderStats();
    updateDisplay();
    updateControls();
  }

  async function init() {
    setupEvents();

    const svg = document.querySelector('.timer-ring');
    if (svg && !svg.querySelector('#timerGrad')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `<linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>`;
      svg.insertBefore(defs, svg.firstChild);
    }

    setMode('pomodoro');
    await loadState();
  }

  return { init, render };
})();
