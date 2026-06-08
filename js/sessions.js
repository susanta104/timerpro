/**
 * Study Command Center - Sessions Management
 */
const Sessions = (() => {
  let searchQuery = '';
  let filterSubject = '';
  let sortBy = 'date-desc';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function getBadgeClass(subject) {
    const map = { Medicine: 'badge-medicine', Surgery: 'badge-surgery', OBGYN: 'badge-obgyn' };
    return map[subject] || 'badge-medicine';
  }

  function filterAndSort(sessions) {
    let result = [...sessions];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.subject?.toLowerCase().includes(q) ||
        s.topic?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }

    if (filterSubject) {
      result = result.filter(s => s.subject === filterSubject);
    }

    switch (sortBy) {
      case 'date-asc':
        result.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'duration-desc':
        result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'duration-asc':
        result.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        break;
      default:
        result.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return result;
  }

  function showSessionForm(session = null) {
    const isEdit = !!session;
    const title = isEdit ? 'Edit Session' : 'Add Session';
    const now = new Date();
    const defaultDate = session
      ? new Date(session.date).toISOString().slice(0, 16)
      : now.toISOString().slice(0, 16);

    App.showModal(
      title,
      `<form id="session-form">
        <div class="form-group">
          <label for="session-date">Date &amp; Time</label>
          <input type="datetime-local" id="session-date" value="${defaultDate}" required>
        </div>
        <div class="form-group">
          <label for="session-subject">Subject</label>
          <select id="session-subject" required>
            <option value="Medicine" ${session?.subject === 'Medicine' ? 'selected' : ''}>Medicine</option>
            <option value="Surgery" ${session?.subject === 'Surgery' ? 'selected' : ''}>Surgery</option>
            <option value="OBGYN" ${session?.subject === 'OBGYN' ? 'selected' : ''}>OBGYN</option>
          </select>
        </div>
        <div class="form-group">
          <label for="session-topic">Topic</label>
          <input type="text" id="session-topic" value="${escapeHtml(session?.topic || '')}" placeholder="Optional topic">
        </div>
        <div class="form-group">
          <label for="session-duration">Duration (minutes)</label>
          <input type="number" id="session-duration" min="1" max="600" value="${session?.duration || 25}" required>
        </div>
        <div class="form-group">
          <label for="session-notes">Notes</label>
          <textarea id="session-notes" placeholder="Session notes...">${escapeHtml(session?.notes || '')}</textarea>
        </div>
      </form>`,
      `<button class="btn btn-ghost" id="session-cancel">Cancel</button>
       <button class="btn btn-primary" id="session-save">${isEdit ? 'Update' : 'Save'}</button>`
    );

    document.getElementById('session-cancel').onclick = App.hideModal;
    document.getElementById('session-save').onclick = async () => {
      const dateVal = document.getElementById('session-date').value;
      const data = {
        date: new Date(dateVal).toISOString(),
        subject: document.getElementById('session-subject').value,
        topic: document.getElementById('session-topic').value.trim(),
        duration: parseInt(document.getElementById('session-duration').value),
        notes: document.getElementById('session-notes').value.trim()
      };

      if (!data.duration || data.duration < 1) {
        App.showToast('Please enter a valid duration', 'error');
        return;
      }

      if (isEdit) {
        data.id = session.id;
        await Storage.put(Storage.STORES.sessions, data);
        App.showToast('Session updated', 'success');
      } else {
        await Storage.add(Storage.STORES.sessions, data);
        App.showToast('Session added', 'success');
      }

      App.hideModal();
      render();
      if (App.getCurrentView() === 'dashboard') Dashboard.render();
    };
  }

  async function deleteSession(id) {
    App.showConfirm(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      async () => {
        await Storage.remove(Storage.STORES.sessions, id);
        App.showToast('Session deleted', 'success');
        render();
        if (App.getCurrentView() === 'dashboard') Dashboard.render();
      }
    );
  }

  function exportCSV(sessions) {
    const headers = ['Date', 'Subject', 'Topic', 'Duration (min)', 'Notes'];
    const rows = sessions.map(s => [
      new Date(s.date).toISOString(),
      s.subject,
      s.topic || '',
      s.duration,
      (s.notes || '').replace(/"/g, '""')
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    downloadFile(csv, 'study-sessions.csv', 'text/csv');
  }

  function exportJSON(sessions) {
    const json = JSON.stringify(sessions, null, 2);
    downloadFile(json, 'study-sessions.json', 'application/json');
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`Exported ${filename}`, 'success');
  }

  async function render() {
    const sessions = await Storage.getAll(Storage.STORES.sessions);
    const filtered = filterAndSort(sessions);
    const container = document.getElementById('sessions-list');

    if (!filtered.length) {
      container.innerHTML = '<p class="empty-state">No sessions found.</p>';
      return;
    }

    container.innerHTML = filtered.map(s => `
      <div class="list-item card" role="listitem">
        <div class="list-item-content">
          <div class="list-item-title">
            <span class="badge ${getBadgeClass(s.subject)}">${escapeHtml(s.subject)}</span>
            ${s.topic ? escapeHtml(s.topic) : ''}
          </div>
          <div class="list-item-meta">
            <span>${formatDate(s.date)}</span>
            <span>${Storage.formatDuration(s.duration)}</span>
            ${s.notes ? `<span>${escapeHtml(s.notes)}</span>` : ''}
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}" aria-label="Edit session">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${s.id}" aria-label="Delete session">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const session = await Storage.getById(Storage.STORES.sessions, btn.dataset.edit);
        if (session) showSessionForm(session);
      });
    });

    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteSession(btn.dataset.delete));
    });
  }

  function setupEvents() {
    document.getElementById('sessions-search').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    document.getElementById('sessions-filter-subject').addEventListener('change', (e) => {
      filterSubject = e.target.value;
      render();
    });

    document.getElementById('sessions-sort').addEventListener('change', (e) => {
      sortBy = e.target.value;
      render();
    });

    document.getElementById('sessions-add').addEventListener('click', () => showSessionForm());
    document.getElementById('sessions-export-csv').addEventListener('click', async () => {
      const sessions = filterAndSort(await Storage.getAll(Storage.STORES.sessions));
      exportCSV(sessions);
    });
    document.getElementById('sessions-export-json').addEventListener('click', async () => {
      const sessions = filterAndSort(await Storage.getAll(Storage.STORES.sessions));
      exportJSON(sessions);
    });
  }

  setupEvents();

  return { render };
})();
