/**
 * Study Command Center - Main Application
 */
const App = (() => {
  const VIEW_TITLES = {
    dashboard: 'Dashboard',
    timer: 'Study Timer',
    sessions: 'Sessions',
    subjects: 'Subjects',
    syllabus: 'Syllabus Tracker',
    analytics: 'Analytics',
    exams: 'Exam Countdown',
    settings: 'Settings'
  };

  let currentView = 'dashboard';
  let sidebarOverlay = null;

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function showModal(title, bodyHTML, footerHTML = '') {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;
    overlay.classList.remove('hidden');
    document.getElementById('modal-close').focus();

    const trapFocus = (e) => {
      if (e.key === 'Escape') {
        hideModal();
      }
    };
    overlay._trapFocus = trapFocus;
    document.addEventListener('keydown', trapFocus);
  }

  function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    if (overlay._trapFocus) {
      document.removeEventListener('keydown', overlay._trapFocus);
    }
  }

  function showConfirm(title, message, onConfirm) {
    showModal(
      title,
      `<p>${message}</p>`,
      `<button class="btn btn-ghost" id="modal-cancel">Cancel</button>
       <button class="btn btn-danger" id="modal-confirm">Confirm</button>`
    );
    document.getElementById('modal-cancel').onclick = hideModal;
    document.getElementById('modal-confirm').onclick = () => {
      hideModal();
      onConfirm();
    };
  }

  function navigateTo(view) {
    if (!VIEW_TITLES[view]) return;
    currentView = view;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');

    document.getElementById('page-title').textContent = VIEW_TITLES[view];

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    closeSidebar();
    closeMoreMenu();

    switch (view) {
      case 'dashboard': Dashboard.render(); break;
      case 'timer': Timer.render(); break;
      case 'sessions': Sessions.render(); break;
      case 'subjects': Subjects.render(); break;
      case 'syllabus': Syllabus.render(); break;
      case 'analytics': Analytics.render(); break;
      case 'exams': Exams.render(); break;
      case 'settings': Settings.render(); break;
    }

    history.replaceState({ view }, '', `#${view}`);
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'true');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
  }

  function closeMoreMenu() {
    document.getElementById('more-menu').classList.add('hidden');
    document.getElementById('more-nav-btn').setAttribute('aria-expanded', 'false');
  }

  function applyTheme(theme) {
    let resolved = theme;
    if (theme === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = resolved === 'dark' ? '#0f172a' : '#4f46e5';
    }
  }

  async function initTheme() {
    const theme = await Storage.getSetting('theme');
    applyTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const current = await Storage.getSetting('theme');
      if (current === 'auto') applyTheme('auto');
    });
  }

  function setupNavigation() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      if (btn.dataset.view === 'more') return;
      btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });

    document.getElementById('more-nav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('more-menu');
      const isOpen = !menu.classList.contains('hidden');
      if (isOpen) {
        closeMoreMenu();
      } else {
        menu.classList.remove('hidden');
        document.getElementById('more-nav-btn').setAttribute('aria-expanded', 'true');
      }
    });

    document.querySelectorAll('.more-menu-item').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });

    document.getElementById('menu-toggle').addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    document.getElementById('modal-close').addEventListener('click', hideModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideModal();
    });

    document.getElementById('theme-toggle-btn').addEventListener('click', async () => {
      const current = await Storage.getSetting('theme');
      const next = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light';
      await Storage.setSetting('theme', next);
      applyTheme(next);
      showToast(`Theme: ${next}`, 'info');
    });

    document.addEventListener('click', (e) => {
      const moreMenu = document.getElementById('more-menu');
      const moreBtn = document.getElementById('more-nav-btn');
      if (!moreMenu.contains(e.target) && !moreBtn.contains(e.target)) {
        closeMoreMenu();
      }
    });

    sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay';
    sidebarOverlay.addEventListener('click', closeSidebar);
    document.querySelector('.app-shell').insertBefore(sidebarOverlay, document.querySelector('.main-content'));
  }

  function setupOfflineDetection() {
    const badge = document.getElementById('offline-badge');
    const update = () => {
      const online = navigator.onLine;
      badge.classList.toggle('offline', !online);
      badge.querySelector('span:last-child').textContent = online ? 'Online' : 'Offline Mode';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => {
          reg.update();
        })
        .catch(() => {
          // SW registration failed - app still works
        });
    }
  }

  function setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        const views = Object.keys(VIEW_TITLES);
        const idx = parseInt(e.key) - 1;
        if (views[idx]) {
          e.preventDefault();
          navigateTo(views[idx]);
        }
      }
    });
  }

  async function init() {
    await Storage.init();
    await Notifications.init();
    await initTheme();
    setupNavigation();
    setupOfflineDetection();
    setupKeyboardNav();
    registerServiceWorker();

    const hash = location.hash.replace('#', '');
    if (hash && VIEW_TITLES[hash]) {
      navigateTo(hash);
    } else {
      navigateTo('dashboard');
    }

    window.addEventListener('popstate', (e) => {
      if (e.state?.view) navigateTo(e.state.view);
    });

    Timer.init();
    Exams.startCountdownInterval();

    document.body.classList.add('app-ready');
  }

  return {
    init,
    navigateTo,
    showToast,
    showModal,
    hideModal,
    showConfirm,
    applyTheme,
    getCurrentView: () => currentView
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
