/**
 * Study Command Center - Analytics with Chart.js
 */
const Analytics = (() => {
  let charts = {};

  function destroyCharts() {
    Object.values(charts).forEach(c => { if (c) c.destroy(); });
    charts = {};
  }

  function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: isDark ? '#94a3b8' : '#64748b',
      grid: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)',
      primary: '#6366f1',
      secondary: '#8b5cf6',
      surgery: '#ef4444',
      obgyn: '#ec4899',
      accent: '#06b6d4'
    };
  }

  function baseOptions(colors) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: colors.text, font: { family: 'system-ui' } } }
      },
      scales: {
        x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
        y: { ticks: { color: colors.text }, grid: { color: colors.grid }, beginAtZero: true }
      }
    };
  }

  function groupByPeriod(sessions, period) {
    const groups = {};
    sessions.forEach(s => {
      const d = new Date(s.date);
      let key;
      if (period === 'week') {
        const weekStart = Storage.getStartOfWeek(d);
        key = Storage.getDateKey(weekStart);
      } else if (period === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'year') {
        key = String(d.getFullYear());
      } else {
        key = Storage.getDateKey(d);
      }
      groups[key] = (groups[key] || 0) + (s.duration || 0);
    });
    return groups;
  }

  function createBarChart(canvasId, labels, data, label, color) {
    if (typeof Chart === 'undefined') return null;
    const colors = getChartColors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data: data.map(m => +(m / 60).toFixed(1)),
          backgroundColor: color || colors.primary,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        ...baseOptions(colors),
        plugins: {
          ...baseOptions(colors).plugins,
          legend: { display: false }
        }
      }
    });
  }

  function createPieChart(canvasId, labels, data) {
    if (typeof Chart === 'undefined') return null;
    const colors = getChartColors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: data.map(m => +(m / 60).toFixed(1)),
          backgroundColor: [colors.primary, colors.surgery, colors.obgyn, colors.accent, colors.secondary],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: colors.text, padding: 16 } }
        }
      }
    });
  }

  function createLineChart(canvasId, labels, data) {
    if (typeof Chart === 'undefined') return null;
    const colors = getChartColors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Sessions',
          data,
          borderColor: colors.primary,
          backgroundColor: 'rgba(99,102,241,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: colors.primary
        }]
      },
      options: {
        ...baseOptions(colors),
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: colors.text, maxTicksLimit: 10 }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.text, stepSize: 1 }, grid: { color: colors.grid }, beginAtZero: true }
        }
      }
    });
  }

  function renderHeatmap(sessions) {
    const container = document.getElementById('study-heatmap');
    const weeks = 12;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayMap = {};
    sessions.forEach(s => {
      const key = Storage.getDateKey(s.date);
      dayMap[key] = (dayMap[key] || 0) + (s.duration || 0);
    });

    const maxMinutes = Math.max(...Object.values(dayMap), 1);

    const startDate = new Date(today);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - (weeks * 7) - dayOfWeek);

    const weeksData = [];
    let currentDate = new Date(startDate);

    for (let w = 0; w < weeks + 1; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const key = Storage.getDateKey(currentDate);
        const minutes = dayMap[key] || 0;
        const level = minutes === 0 ? 0
          : minutes < maxMinutes * 0.25 ? 1
          : minutes < maxMinutes * 0.5 ? 2
          : minutes < maxMinutes * 0.75 ? 3 : 4;

        week.push({
          date: key,
          minutes,
          level,
          label: currentDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeksData.push(week);
      if (currentDate > today) break;
    }

    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

    container.innerHTML = `
      <div class="heatmap-wrapper">
        <div class="heatmap-body">
          <div class="heatmap-days-labels">
            ${dayLabels.map(l => `<div class="heatmap-day-label">${l}</div>`).join('')}
          </div>
          <div class="heatmap-grid">
            ${weeksData.map(week => `
              <div class="heatmap-week">
                ${week.map(cell => `
                  <div class="heatmap-cell" data-level="${cell.level}"
                       title="${cell.label}: ${Storage.formatDuration(cell.minutes)}"
                       aria-label="${cell.label}: ${Storage.formatDuration(cell.minutes)} of study"></div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="heatmap-legend">
          <span>Less</span>
          ${[0, 1, 2, 3, 4].map(l => `<div class="heatmap-legend-cell heatmap-cell" data-level="${l}"></div>`).join('')}
          <span>More</span>
        </div>
      </div>`;
  }

  function computeInsights(sessions) {
    if (!sessions.length) {
      document.getElementById('insight-best-day').textContent = '—';
      document.getElementById('insight-top-subject').textContent = '—';
      document.getElementById('insight-avg-session').textContent = '—';
      return;
    }

    const dayTotals = {};
    const subjectTotals = {};
    sessions.forEach(s => {
      const day = new Date(s.date).toLocaleDateString('en-IN', { weekday: 'long' });
      dayTotals[day] = (dayTotals[day] || 0) + (s.duration || 0);
      subjectTotals[s.subject] = (subjectTotals[s.subject] || 0) + (s.duration || 0);
    });

    const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];
    const topSubject = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1])[0];
    const avgSession = sessions.reduce((s, x) => s + (x.duration || 0), 0) / sessions.length;

    document.getElementById('insight-best-day').textContent =
      bestDay ? `${bestDay[0]} (${Storage.formatHours(bestDay[1])})` : '—';
    document.getElementById('insight-top-subject').textContent =
      topSubject ? `${topSubject[0]} (${Storage.formatHours(topSubject[1])})` : '—';
    document.getElementById('insight-avg-session').textContent =
      Storage.formatDuration(Math.round(avgSession));
  }

  async function render() {
    if (typeof Chart === 'undefined') {
      App.showToast('Chart.js not loaded. Charts unavailable offline until cached.', 'info');
    }

    destroyCharts();
    const sessions = await Storage.getAll(Storage.STORES.sessions);
    const colors = getChartColors();

    computeInsights(sessions);

    const weeklyData = groupByPeriod(sessions, 'week');
    const weeklyKeys = Object.keys(weeklyData).sort().slice(-8);
    charts.weekly = createBarChart(
      'chart-weekly',
      weeklyKeys.map(k => {
        const d = new Date(k);
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      }),
      weeklyKeys.map(k => weeklyData[k]),
      'Hours',
      colors.primary
    );

    const monthlyData = groupByPeriod(sessions, 'month');
    const monthlyKeys = Object.keys(monthlyData).sort().slice(-12);
    charts.monthly = createBarChart(
      'chart-monthly',
      monthlyKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      }),
      monthlyKeys.map(k => monthlyData[k]),
      'Hours',
      colors.secondary
    );

    const yearlyData = groupByPeriod(sessions, 'year');
    const yearlyKeys = Object.keys(yearlyData).sort();
    charts.yearly = createBarChart(
      'chart-yearly',
      yearlyKeys,
      yearlyKeys.map(k => yearlyData[k]),
      'Hours',
      colors.accent
    );

    const allTimeBySubject = { Medicine: 0, Surgery: 0, OBGYN: 0 };
    sessions.forEach(s => {
      if (allTimeBySubject[s.subject] !== undefined) {
        allTimeBySubject[s.subject] += s.duration || 0;
      }
    });
    charts.alltime = createBarChart(
      'chart-alltime',
      Object.keys(allTimeBySubject),
      Object.values(allTimeBySubject),
      'Hours',
      colors.primary
    );

    charts.subjects = createPieChart(
      'chart-subjects',
      Object.keys(allTimeBySubject),
      Object.values(allTimeBySubject)
    );

    const last30Days = [];
    const sessionCounts = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = Storage.getDateKey(d);
      last30Days.push(d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
      sessionCounts.push(sessions.filter(s => Storage.getDateKey(s.date) === key).length);
    }
    charts.sessionsLine = createLineChart('chart-sessions-line', last30Days, sessionCounts);

    renderHeatmap(sessions);
  }

  return { render };
})();
