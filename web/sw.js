// Offline support: serve the app shell from the cache, update it in the background.
// Bump VERSION whenever files change so phones pick up the new release.
const VERSION = 'tas-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/core/project.js',
  './js/core/objects.js',
  './js/core/store.js',
  './js/core/player.js',
  './js/core/tween.js',
  './js/core/demo.js',
  './js/render/renderer.js',
  './js/render/shapes.js',
  './js/render/characters.js',
  './js/render/scenes.js',
  './js/services/storage.js',
  './js/services/video-export.js',
  './js/services/audio.js',
  './js/services/azure-tts.js',
  './js/ui/icons.js',
  './js/ui/toast.js',
  './js/ui/sheets.js',
  './js/ui/stage.js',
  './js/ui/toolbar.js',
  './js/ui/timeline.js',
  './js/ui/layers-panel.js',
  './js/ui/props-panel.js',
  './js/ui/insert-sheet.js',
  './js/ui/context-bar.js',
  './js/ui/project-menu.js',
  './js/ui/export-dialog.js',
  './js/ui/tween-sheet.js',
  './js/ui/sound-sheet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first (so updates arrive quickly), falling back to the cache when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
