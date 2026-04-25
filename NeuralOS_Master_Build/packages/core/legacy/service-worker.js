const CACHE_NAME = 'forgecore-os-v2';
const ASSETS_TO_CACHE = [
    '/EMPIRE_HUD.html',
    '/THEME_ENGINE.css',
    '/ui/empire_app.js',
    '/ui/empire_api.js',
    '/ui/empire_canvas.js',
    '/ui/empire_forge.js',
    '/ui/empire_state.js',
    '/ui/empire_crypto.js',
    '/ui/boot.js',
    '/vendor/xterm.js',
    '/vendor/xterm-addon-fit.js',
    '/vendor/xterm.css',
    '/vendor/monaco/min/vs/loader.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Direct API requests shouldn't be blindly cached (they return live telemetry)
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                // Return original response if API or not cacheable
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(() => {
                // If offline and not in cache, we could return a specific offline.html
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
