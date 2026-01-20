
const CACHE_NAME = 'notebook-pro-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './metadata.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// Tahap Instalasi: Simpan aset inti ke dalam cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Tahap Aktivasi: Hapus cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Tahap Fetch: Strategi Stale-While-Revalidate
// Mengambil dari cache dulu agar cepat, sambil memperbarui cache dari network di background
self.addEventListener('fetch', (event) => {
  // Hanya tangani request GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Update cache dengan response terbaru dari network
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Jika offline dan tidak ada di cache, bisa berikan fallback di sini
      });

      // Kembalikan response dari cache jika ada, jika tidak tunggu network
      return cachedResponse || fetchPromise;
    })
  );
});
