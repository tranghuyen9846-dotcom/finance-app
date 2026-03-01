/**
 * sw.js - Service Worker cho PWA Tài Chính
 * Cache offline: HTML, CSS, JS, Fonts, CDN libs
 */

const CACHE_NAME = 'finance-pwa-v2';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/db.js',
    '/charts.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    'https://cdn.jsdelivr.net/npm/chart.js@4',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
];

// Install: cache tất cả tài nguyên
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate: xoá cache cũ
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Network-first cho API, Cache-first cho static files
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Supabase API calls → always network
    if (url.hostname.includes('supabase')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Static assets → cache-first
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;

                return fetch(event.request).then(response => {
                    // Cache successful GET responses
                    if (event.request.method === 'GET' && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});
