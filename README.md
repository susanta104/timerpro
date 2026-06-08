# Study Command Center

A **100% free**, **offline-first** Progressive Web App for MBBS students preparing for professional examinations.

Created by **Susanta Debnath** | Version 1.0

## Features

- **Dashboard** — Study streak, exam countdown, today's progress, weekly summary, subject breakdown, motivational quotes
- **Pomodoro Timer** — 25/5, 50/10, 90/20 presets, custom timer, subject/topic tracking, wake lock, auto-resume
- **Sessions** — Full CRUD, search, filter, sort, CSV/JSON export
- **Subjects** — Medicine, Surgery, OBGYN stats with editable weekly targets
- **Syllabus Tracker** — Topic management with progress tracking
- **Analytics** — Chart.js charts, GitHub-style heatmap, productivity insights
- **Exam Countdown** — Live countdown for unlimited exams
- **Settings** — Theme (light/dark/auto), sounds, notifications, backup/restore

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript (ES6)
- Chart.js (bundled locally)
- IndexedDB + LocalStorage fallback
- Service Worker + Web App Manifest

## Quick Start

### Local Development

```bash
# Serve with any static server
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

### Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push this project to the repository
3. Go to **Settings → Pages**
4. Set source to **main** branch, root folder
5. Your app will be live at `https://<username>.github.io/<repo>/`

> The app uses hash-based routing (`#dashboard`, `#timer`, etc.) so no special SPA configuration is needed.

## Install as PWA

1. Open the app in Chrome, Edge, or Safari
2. Click **Install** in the address bar (or Add to Home Screen on mobile)
3. The app works fully offline after the first visit

## Data Storage

All data is stored locally on your device:

- **IndexedDB** (primary) — sessions, syllabus, exams, settings
- **LocalStorage** (fallback) — used if IndexedDB is unavailable

Use **Settings → Backup & Restore** to export/import your data as JSON.

## Browser Support

- Chrome / Edge (recommended)
- Firefox
- Safari (iOS 16.4+ for full PWA support)
- Samsung Internet

## Project Structure

```
StudyCommandCenter/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   ├── style.css
│   ├── dashboard.css
│   ├── timer.css
│   ├── analytics.css
│   └── mobile.css
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── dashboard.js
│   ├── timer.js
│   ├── sessions.js
│   ├── subjects.js
│   ├── syllabus.js
│   ├── analytics.js
│   ├── exams.js
│   ├── settings.js
│   ├── notifications.js
│   └── vendor/
│       └── chart.umd.min.js
└── assets/
    ├── icons/
    │   ├── icon-192.png
    │   └── icon-512.png
    └── sounds/
        ├── bell.wav
        ├── soft.wav
        └── digital.wav
```

## Keyboard Shortcuts

- `Alt + 1` through `Alt + 8` — Navigate between pages

## License

Free for personal educational use.
