/**
 * Study Command Center - Exam Countdown
 */
const Exams = (() => {
  let countdownInterval = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatExamDateTime(date, time) {
    const d = new Date(`${date}T${time || '00:00'}`);
    return d.toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function getCountdown(date, time) {
    const examDate = new Date(`${date}T${time || '00:00'}`);
    const now = new Date();
    const diff = examDate - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
    }

    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      passed: false
    };
  }

  function showExamForm(exam = null) {
    const isEdit = !!exam;
    App.showModal(
      isEdit ? 'Edit Exam' : 'Add Exam',
      `<form id="exam-form">
        <div class="form-group">
          <label for="exam-name">Exam Name</label>
          <input type="text" id="exam-name" value="${escapeHtml(exam?.name || '')}" required placeholder="e.g. Final Professional MBBS Part 1">
        </div>
        <div class="form-group">
          <label for="exam-date">Date</label>
          <input type="date" id="exam-date" value="${exam?.date || ''}" required>
        </div>
        <div class="form-group">
          <label for="exam-time">Time</label>
          <input type="time" id="exam-time" value="${exam?.time || '09:00'}" required>
        </div>
      </form>`,
      `<button class="btn btn-ghost" id="exam-cancel">Cancel</button>
       <button class="btn btn-primary" id="exam-save">${isEdit ? 'Update' : 'Add'}</button>`
    );

    document.getElementById('exam-cancel').onclick = App.hideModal;
    document.getElementById('exam-save').onclick = async () => {
      const data = {
        name: document.getElementById('exam-name').value.trim(),
        date: document.getElementById('exam-date').value,
        time: document.getElementById('exam-time').value
      };

      if (!data.name || !data.date) {
        App.showToast('Please fill in all required fields', 'error');
        return;
      }

      if (isEdit) {
        data.id = exam.id;
        await Storage.put(Storage.STORES.exams, data);
        App.showToast('Exam updated', 'success');
      } else {
        await Storage.add(Storage.STORES.exams, data);
        App.showToast('Exam added', 'success');
      }

      App.hideModal();
      render();
      if (App.getCurrentView() === 'dashboard') Dashboard.render();
    };
  }

  async function deleteExam(id) {
    App.showConfirm('Delete Exam', 'Are you sure you want to delete this exam?', async () => {
      await Storage.remove(Storage.STORES.exams, id);
      App.showToast('Exam deleted', 'success');
      render();
      if (App.getCurrentView() === 'dashboard') Dashboard.render();
    });
  }

  function renderExamCard(exam, isNearest) {
    const cd = getCountdown(exam.date, exam.time);
    const statusText = cd.passed ? '<span class="badge badge-completed">Completed</span>' : '';

    return `
      <div class="card glass exam-card ${isNearest ? 'nearest' : ''}" data-exam-id="${exam.id}" role="listitem">
        <div class="exam-card-header">
          <div>
            <div class="exam-card-title">${escapeHtml(exam.name)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
              ${formatExamDateTime(exam.date, exam.time)}
            </div>
          </div>
          ${isNearest ? '<span class="exam-card-badge">Nearest</span>' : ''}
          ${statusText}
        </div>
        ${cd.passed ? '<p class="empty-state">This exam has passed.</p>' : `
          <div class="exam-countdown-large">
            <div class="countdown-unit">
              <span class="countdown-value" data-unit="days">${cd.days}</span>
              <span class="countdown-label">Days</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value" data-unit="hours">${cd.hours}</span>
              <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value" data-unit="minutes">${cd.minutes}</span>
              <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value" data-unit="seconds">${cd.seconds}</span>
              <span class="countdown-label">Seconds</span>
            </div>
          </div>`}
        <div class="list-item-actions" style="margin-top: 12px">
          <button class="btn btn-ghost btn-sm" data-edit="${exam.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${exam.id}">Delete</button>
        </div>
      </div>`;
  }

  async function render() {
    const exams = await Storage.getAll(Storage.STORES.exams);
    const container = document.getElementById('exams-list');
    const now = new Date();

    const sorted = [...exams].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
      const aFuture = dateA > now;
      const bFuture = dateB > now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return dateA - dateB;
    });

    if (!sorted.length) {
      container.innerHTML = '<p class="empty-state">No exams added. Add your upcoming professional exams!</p>';
      return;
    }

    const nearestId = sorted.find(e => new Date(`${e.date}T${e.time}`) > now)?.id;

    container.innerHTML = sorted.map(e => renderExamCard(e, e.id === nearestId)).join('');

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const exam = await Storage.getById(Storage.STORES.exams, parseInt(btn.dataset.edit) || btn.dataset.edit);
        if (exam) showExamForm(exam);
      });
    });

    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteExam(parseInt(btn.dataset.delete) || btn.dataset.delete));
    });
  }

  function updateCountdowns() {
    if (App.getCurrentView() !== 'exams' && App.getCurrentView() !== 'dashboard') return;

    document.querySelectorAll('[data-exam-id]').forEach(card => {
      const examId = card.dataset.examId;
      Storage.getById(Storage.STORES.exams, parseInt(examId) || examId).then(exam => {
        if (!exam) return;
        const cd = getCountdown(exam.date, exam.time);
        card.querySelectorAll('.countdown-value').forEach(el => {
          const unit = el.dataset.unit;
          if (cd[unit] !== undefined) el.textContent = cd[unit];
        });
      });
    });

    if (App.getCurrentView() === 'dashboard') {
      Dashboard.render();
    }
  }

  function startCountdownInterval() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdowns, 1000);
  }

  function setupEvents() {
    document.getElementById('exams-add').addEventListener('click', () => showExamForm());
  }

  setupEvents();

  return { render, startCountdownInterval };
})();
