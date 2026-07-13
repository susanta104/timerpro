/**
 * Study Command Center - Service Worker
 * Offline-first caching for GitHub Pages deployment
 */
const CACHE_NAME = 'study-command-center-v4';
const OFFLINE_URL = './index.html';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/dashboard.css',
  './css/timer.css',
  './css/analytics.css',
  './css/mobile.css',
  './js/storage.js',
  './js/notifications.js',
  './js/app.js',
  './js/dashboard.js',
  './js/timer.js',
  './js/sessions.js',
  './js/subjects.js',
  './js/syllabus.js',
  './js/analytics.js',
  './js/exams.js',
  './js/settings.js',
  './js/vendor/chart.umd.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/sounds/bell.wav',
  './assets/sounds/soft.wav',
  './assets/sounds/digital.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('Precache failed, some assets may be missing:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Firebase Auth/Firestore/SDK traffic must always go straight to the
  // network — never cached, never intercepted by this service worker.
  const FIREBASE_HOSTS = [
    'gstatic.com',
    'googleapis.com',
    'firebaseapp.com',
    'firebaseio.com'
  ];
  if (FIREBASE_HOSTS.some((host) => url.hostname.endsWith(host))) {
    return;
  }

  if (url.origin !== self.location.origin && !url.href.includes('cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) return response;

            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });

            return response;
          })
          .catch(() => {
            if (request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('./index.html');
      })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Study Command Center', {
      body: data.body || '',
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png'
    })
  );
});
