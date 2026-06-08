/**
 * Study Command Center - Dashboard
 */
const Dashboard = (() => {
  const QUOTES = [
    { text: 'Medicine is a science of uncertainty and an art of probability.', author: 'William Osler' },
    { text: 'The good physician treats the disease; the great physician treats the patient who has the disease.', author: 'William Osler' },
    { text: 'Study while others are sleeping; work while others are loafing.', author: 'William Arthur Ward' },
    { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
    { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
    { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela' },
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
    { text: 'The beautiful thing about learning is that nobody can take it away from you.', author: 'B.B. King' },
    { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
    { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
    { text: 'The future belongs to those who prepare for it today.', author: 'Malcolm X' }
  ];

  let quoteIndex = Math.floor(Math.random() * QUOTES.length);

  function showQuote(index) {
    const quote = QUOTES[index % QUOTES.length];
    document.getElementById('dash-quote').innerHTML =
      `<p>"${quote.text}"</p><cite>— ${quote.author}</cite>`;
  }

  function calculateStreak(sessions) {
    if (!sessions.length) return { current: 0, longest: 0 };

    const studyDays = new Set(
      sessions.map(s => Storage.getDateKey(s.date))
    );
    const sortedDays = [...studyDays].sort().reverse();

    let current = 0;
    const today = Storage.getDateKey(new Date());
    const yesterday = Storage.getDateKey(new Date(Date.now() - 86400000));

    if (studyDays.has(today) || studyDays.has(yesterday)) {
      let checkDate = studyDays.has(today) ? new Date() : new Date(Date.now() - 86400000);
      while (studyDays.has(Storage.getDateKey(checkDate))) {
        current++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      }
    }

    let longest = 0;
    let streak = 0;
    const allDays = [...studyDays].sort();
    for (let i = 0; i < allDays.length; i++) {
      if (i === 0) {
        streak = 1;
      } else {
        const prev = new Date(allDays[i - 1]);
        const curr = new Date(allDays[i]);
        const diff = (curr - prev) / 86400000;
        streak = diff === 1 ? streak + 1 : 1;
      }
      longest = Math.max(longest, streak);
    }

    return { current, longest };
  }

  function getSessionsInRange(sessions, startDate, endDate) {
    return sessions.filter(s => {
      const d = new Date(s.date);
      return d >= startDate && d <= endDate;
    });
  }

  function renderExamWidget(exams) {
    const container = document.getElementById('dash-exam-content');
    const now = new Date();
    const upcoming = exams
      .filter(e => new Date(`${e.date}T${e.time || '00:00'}`) > now)
      .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    if (!upcoming.length) {
      container.innerHTML = '<p class="empty-state">No upcoming exams</p>';
      return;
    }

    const exam = upcoming[0];
    const examDate = new Date(`${exam.date}T${exam.time || '00:00'}`);
    const diff = examDate - now;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    container.innerHTML = `
      <div class="exam-countdown">
        <div class="exam-name">${escapeHtml(exam.name)}</div>
        <div class="exam-date">${formatExamDate(exam.date, exam.time)}</div>
        <div class="exam-timer-grid">
          <div class="exam-timer-unit">
            <span class="exam-timer-value">${days}</span>
            <span class="exam-timer-label">Days</span>
          </div>
          <div class="exam-timer-unit">
            <span class="exam-timer-value">${hours}</span>
            <span class="exam-timer-label">Hours</span>
          </div>
          <div class="exam-timer-unit">
            <span class="exam-timer-value">${minutes}</span>
            <span class="exam-timer-label">Minutes</span>
          </div>
        </div>
      </div>`;
  }

  function renderSubjectBars(sessions) {
    const container = document.getElementById('dash-subject-bars');
    const weekStart = Storage.getStartOfWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59);

    const weekSessions = getSessionsInRange(sessions, weekStart, weekEnd);
    const subjects = ['Medicine', 'Surgery', 'OBGYN'];
    const totals = {};
    let maxHours = 0;

    subjects.forEach(s => { totals[s] = 0; });
    weekSessions.forEach(s => {
      totals[s.subject] = (totals[s.subject] || 0) + (s.duration || 0);
    });

    subjects.forEach(s => {
      maxHours = Math.max(maxHours, totals[s] / 60);
    });

    if (maxHours === 0) {
      container.innerHTML = '<p class="empty-state">No study data this week</p>';
      return;
    }

    container.innerHTML = subjects.map(subject => {
      const hours = totals[subject] / 60;
      const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
      const cls = subject.toLowerCase();
      return `
        <div class="subject-bar-item">
          <div class="subject-bar-header">
            <span class="subject-bar-name">${subject}</span>
            <span class="subject-bar-hours">${Storage.formatHours(totals[subject])}</span>
          </div>
          <div class="subject-bar-track">
            <div class="subject-bar-fill ${cls}" style="width: ${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderRecentSessions(sessions) {
    const container = document.getElementById('dash-recent-sessions');
    const recent = [...sessions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    if (!recent.length) {
      container.innerHTML = '<p class="empty-state">No sessions yet. Start studying!</p>';
      return;
    }

    container.innerHTML = recent.map(s => `
      <div class="session-row">
        <div>
          <div class="session-row-subject">${escapeHtml(s.subject)}${s.topic ? ` — ${escapeHtml(s.topic)}` : ''}</div>
          <div class="session-row-meta">${formatDate(s.date)}</div>
        </div>
        <div class="session-row-duration">${Storage.formatDuration(s.duration)}</div>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatExamDate(date, time) {
    const d = new Date(`${date}T${time || '00:00'}`);
    return d.toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  async function render() {
    const sessions = await Storage.getAll(Storage.STORES.sessions);
    const exams = await Storage.getAll(Storage.STORES.exams);
    const weeklyGoal = await Storage.getSetting('weeklyGoal');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = Storage.getStartOfWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const todaySessions = getSessionsInRange(sessions, todayStart, todayEnd);
    const weekSessions = getSessionsInRange(sessions, weekStart, weekEnd);

    const todayMinutes = todaySessions.reduce((s, x) => s + (x.duration || 0), 0);
    const weekMinutes = weekSessions.reduce((s, x) => s + (x.duration || 0), 0);

    const streak = calculateStreak(sessions);

    document.getElementById('dash-current-streak').textContent = streak.current;
    document.getElementById('dash-longest-streak').textContent = streak.longest;
    document.getElementById('dash-today-hours').textContent = Storage.formatHours(todayMinutes);
    document.getElementById('dash-today-sessions').textContent = todaySessions.length;
    document.getElementById('dash-week-hours').textContent = Storage.formatHours(weekMinutes);
    document.getElementById('dash-week-sessions').textContent = weekSessions.length;

    const goalPct = weeklyGoal > 0 ? Math.min(100, (weekMinutes / 60 / weeklyGoal) * 100) : 0;
    document.getElementById('dash-weekly-goal-bar').style.width = `${goalPct}%`;
    document.getElementById('dash-weekly-goal-text').textContent =
      `${Math.round(goalPct)}% of ${weeklyGoal}h weekly goal`;

    renderExamWidget(exams);
    renderSubjectBars(sessions);
    renderRecentSessions(sessions);
    showQuote(quoteIndex);
  }

  function setupEvents() {
    document.getElementById('dash-new-quote').addEventListener('click', () => {
      quoteIndex = (quoteIndex + 1) % QUOTES.length;
      showQuote(quoteIndex);
    });
  }

  setupEvents();

  return { render };
})();
