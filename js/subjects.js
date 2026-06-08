/**
 * Study Command Center - Subjects Page
 */
const Subjects = (() => {
  let activeSubject = 'Medicine';

  function getSessionsForSubject(sessions, subject) {
    return sessions.filter(s => s.subject === subject);
  }

  function getHoursInRange(sessions, start, end) {
    return sessions
      .filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      })
      .reduce((sum, s) => sum + (s.duration || 0), 0);
  }

  async function renderSubjectDetail(subject) {
    const sessions = await Storage.getAll(Storage.STORES.sessions);
    const subjectSessions = getSessionsForSubject(sessions, subject);
    const weeklyTarget = await Storage.getSubjectTarget(subject);

    const now = new Date();
    const weekStart = Storage.getStartOfWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59);

    const monthStart = Storage.getStartOfMonth();

    const totalMinutes = subjectSessions.reduce((s, x) => s + (x.duration || 0), 0);
    const weekMinutes = getHoursInRange(subjectSessions, weekStart, weekEnd);
    const monthMinutes = getHoursInRange(subjectSessions, monthStart, now);
    const avgDuration = subjectSessions.length
      ? totalMinutes / subjectSessions.length
      : 0;

    const weekHours = weekMinutes / 60;
    const progressPct = weeklyTarget > 0 ? Math.min(100, (weekHours / weeklyTarget) * 100) : 0;

    const subjectColors = {
      Medicine: '#6366f1',
      Surgery: '#ef4444',
      OBGYN: '#ec4899'
    };

    document.getElementById('subject-detail').innerHTML = `
      <h3 style="color: ${subjectColors[subject]}; text-transform: none; font-size: 1.3rem; letter-spacing: 0;">
        ${subject}
      </h3>
      <div class="subject-stats-grid">
        <div class="subject-stat-card">
          <span class="subject-stat-value">${Storage.formatHours(totalMinutes)}</span>
          <span class="subject-stat-label">Total Study Hours</span>
        </div>
        <div class="subject-stat-card">
          <span class="subject-stat-value">${subjectSessions.length}</span>
          <span class="subject-stat-label">Total Sessions</span>
        </div>
        <div class="subject-stat-card">
          <span class="subject-stat-value">${Storage.formatHours(weekMinutes)}</span>
          <span class="subject-stat-label">This Week</span>
        </div>
        <div class="subject-stat-card">
          <span class="subject-stat-value">${Storage.formatHours(monthMinutes)}</span>
          <span class="subject-stat-label">This Month</span>
        </div>
        <div class="subject-stat-card">
          <span class="subject-stat-value">${Storage.formatDuration(Math.round(avgDuration))}</span>
          <span class="subject-stat-label">Avg Session</span>
        </div>
        <div class="subject-stat-card">
          <span class="subject-stat-value">${weeklyTarget}h</span>
          <span class="subject-stat-label">Weekly Target</span>
        </div>
      </div>
      <div class="subject-target-section">
        <div class="subject-target-header">
          <label for="subject-target-input">Weekly Target (hours)</label>
          <span>${Math.round(progressPct)}% complete</span>
        </div>
        <div class="subject-target-input">
          <input type="number" id="subject-target-input" min="1" max="80" value="${weeklyTarget}" aria-label="Weekly target hours for ${subject}">
          <button class="btn btn-primary btn-sm" id="subject-target-save">Save Target</button>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width: ${progressPct}%; background: linear-gradient(90deg, ${subjectColors[subject]}, ${subjectColors[subject]}88)"></div>
        </div>
        <p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
          ${Storage.formatHours(weekMinutes)} of ${weeklyTarget}h weekly goal
        </p>
      </div>`;

    document.getElementById('subject-target-save').addEventListener('click', async () => {
      const val = parseInt(document.getElementById('subject-target-input').value);
      if (val < 1 || val > 80) {
        App.showToast('Target must be between 1 and 80 hours', 'error');
        return;
      }
      await Storage.setSubjectTarget(subject, val);
      App.showToast(`${subject} weekly target updated to ${val}h`, 'success');
      renderSubjectDetail(subject);
    });
  }

  async function render() {
    document.querySelectorAll('.subject-tab').forEach(tab => {
      const isActive = tab.dataset.subject === activeSubject;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
    });
    await renderSubjectDetail(activeSubject);
  }

  function setupEvents() {
    document.querySelectorAll('.subject-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeSubject = tab.dataset.subject;
        render();
      });
    });
  }

  setupEvents();

  return { render };
})();
