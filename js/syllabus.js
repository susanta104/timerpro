/**
 * Study Command Center - Syllabus Tracker
 */
const Syllabus = (() => {
  let searchQuery = '';
  let filterSubject = '';
  let filterStatus = '';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getStatusBadge(status) {
    const map = {
      'Completed': 'badge-completed',
      'In Progress': 'badge-progress',
      'Not Started': 'badge-not-started'
    };
    return map[status] || 'badge-not-started';
  }

  function filterTopics(topics) {
    let result = [...topics];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.topic?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q)
      );
    }
    if (filterSubject) result = result.filter(t => t.subject === filterSubject);
    if (filterStatus) result = result.filter(t => t.status === filterStatus);
    return result.sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic));
  }

  function renderSummary(topics) {
    const totalEstimated = topics.reduce((s, t) => s + (t.estimatedHours || 0), 0);
    const totalCompleted = topics.reduce((s, t) => s + (t.completedHours || 0), 0);
    const remaining = Math.max(0, totalEstimated - totalCompleted);
    const pct = totalEstimated > 0 ? Math.round((totalCompleted / totalEstimated) * 100) : 0;

    document.getElementById('syllabus-summary').innerHTML = `
      <div class="syllabus-summary-grid">
        <div>
          <span class="syllabus-summary-value">${pct}%</span>
          <span class="syllabus-summary-label">Completion</span>
        </div>
        <div>
          <span class="syllabus-summary-value">${totalCompleted.toFixed(1)}h</span>
          <span class="syllabus-summary-label">Hours Studied</span>
        </div>
        <div>
          <span class="syllabus-summary-value">${remaining.toFixed(1)}h</span>
          <span class="syllabus-summary-label">Remaining</span>
        </div>
        <div>
          <span class="syllabus-summary-value">${topics.length}</span>
          <span class="syllabus-summary-label">Total Topics</span>
        </div>
      </div>`;
  }

  function showTopicForm(topic = null) {
    const isEdit = !!topic;
    App.showModal(
      isEdit ? 'Edit Topic' : 'Add Topic',
      `<form id="topic-form">
        <div class="form-group">
          <label for="topic-subject">Subject</label>
          <select id="topic-subject" required>
            <option value="Medicine" ${topic?.subject === 'Medicine' ? 'selected' : ''}>Medicine</option>
            <option value="Surgery" ${topic?.subject === 'Surgery' ? 'selected' : ''}>Surgery</option>
            <option value="OBGYN" ${topic?.subject === 'OBGYN' ? 'selected' : ''}>OBGYN</option>
          </select>
        </div>
        <div class="form-group">
          <label for="topic-name">Topic</label>
          <input type="text" id="topic-name" value="${escapeHtml(topic?.topic || '')}" required placeholder="e.g. Cardiology, Obstetrics...">
        </div>
        <div class="form-group">
          <label for="topic-estimated">Estimated Hours</label>
          <input type="number" id="topic-estimated" min="0.5" step="0.5" value="${topic?.estimatedHours || 5}" required>
        </div>
        <div class="form-group">
          <label for="topic-completed">Completed Hours</label>
          <input type="number" id="topic-completed" min="0" step="0.5" value="${topic?.completedHours || 0}" required>
        </div>
        <div class="form-group">
          <label for="topic-status">Status</label>
          <select id="topic-status" required>
            <option value="Not Started" ${topic?.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
            <option value="In Progress" ${topic?.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${topic?.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
      </form>`,
      `<button class="btn btn-ghost" id="topic-cancel">Cancel</button>
       <button class="btn btn-primary" id="topic-save">${isEdit ? 'Update' : 'Add'}</button>`
    );

    document.getElementById('topic-cancel').onclick = App.hideModal;
    document.getElementById('topic-save').onclick = async () => {
      const estimated = parseFloat(document.getElementById('topic-estimated').value);
      const completed = parseFloat(document.getElementById('topic-completed').value);
      let status = document.getElementById('topic-status').value;

      if (completed >= estimated && estimated > 0) status = 'Completed';
      else if (completed > 0) status = 'In Progress';

      const data = {
        subject: document.getElementById('topic-subject').value,
        topic: document.getElementById('topic-name').value.trim(),
        estimatedHours: estimated,
        completedHours: completed,
        status
      };

      if (!data.topic) {
        App.showToast('Please enter a topic name', 'error');
        return;
      }

      if (isEdit) {
        data.id = topic.id;
        await Storage.put(Storage.STORES.syllabus, data);
        App.showToast('Topic updated', 'success');
      } else {
        await Storage.add(Storage.STORES.syllabus, data);
        App.showToast('Topic added', 'success');
      }

      App.hideModal();
      render();
    };
  }

  async function deleteTopic(id) {
    App.showConfirm('Delete Topic', 'Are you sure you want to delete this topic?', async () => {
      await Storage.remove(Storage.STORES.syllabus, id);
      App.showToast('Topic deleted', 'success');
      render();
    });
  }

  async function render() {
    const topics = await Storage.getAll(Storage.STORES.syllabus);
    const filtered = filterTopics(topics);
    const container = document.getElementById('syllabus-list');

    renderSummary(topics);

    if (!filtered.length) {
      container.innerHTML = '<p class="empty-state">No topics found.</p>';
      return;
    }

    container.innerHTML = filtered.map(t => {
      const pct = t.estimatedHours > 0
        ? Math.min(100, Math.round((t.completedHours / t.estimatedHours) * 100))
        : 0;
      const remaining = Math.max(0, t.estimatedHours - t.completedHours);

      return `
        <div class="list-item card syllabus-item" role="listitem">
          <div class="list-item-content">
            <div class="syllabus-item-header">
              <div>
                <span class="badge ${t.subject === 'Medicine' ? 'badge-medicine' : t.subject === 'Surgery' ? 'badge-surgery' : 'badge-obgyn'}">${escapeHtml(t.subject)}</span>
                <div class="syllabus-topic-name">${escapeHtml(t.topic)}</div>
              </div>
              <span class="badge ${getStatusBadge(t.status)}">${escapeHtml(t.status)}</span>
            </div>
            <div class="progress-bar-wrap" style="margin: 8px 0">
              <div class="progress-bar" style="width: ${pct}%"></div>
            </div>
            <div class="syllabus-progress-text">
              ${t.completedHours}h / ${t.estimatedHours}h (${pct}%) — ${remaining.toFixed(1)}h remaining
            </div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${t.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${t.id}">Delete</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const topic = await Storage.getById(Storage.STORES.syllabus, parseInt(btn.dataset.edit) || btn.dataset.edit);
        if (topic) showTopicForm(topic);
      });
    });

    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteTopic(parseInt(btn.dataset.delete) || btn.dataset.delete));
    });
  }

  function setupEvents() {
    document.getElementById('syllabus-search').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });
    document.getElementById('syllabus-filter-subject').addEventListener('change', (e) => {
      filterSubject = e.target.value;
      render();
    });
    document.getElementById('syllabus-filter-status').addEventListener('change', (e) => {
      filterStatus = e.target.value;
      render();
    });
    document.getElementById('syllabus-add').addEventListener('click', () => showTopicForm());
  }

  setupEvents();

  return { render };
})();
