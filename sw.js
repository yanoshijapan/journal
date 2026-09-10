const CACHE_NAME = 'jurnal-cache-v7';

// Install Service Worker
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Terinstall');
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Aktif');
    return self.clients.claim();
});

// Fetch event (Wajib ada agar diakui sebagai PWA oleh browser)
self.addEventListener('fetch', (e) => {
    // Kita biarkan mengambil langsung dari jaringan agar data selalu live
    e.respondWith(fetch(e.request).catch(() => {
        console.log("Mode offline aktif, request gagal dikirim.");
    }));
});
