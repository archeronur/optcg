const CACHE_NAME = 'lorcana-cache-v2';
const IMAGE_CACHE_NAME = 'lorcana-images-v2';

// Install event - cache'leri oluştur
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/offline.html'
      ]);
    })
  );
});

// Fetch event - görsel cache stratejisi
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Görsel istekleri için cache-first stratejisi
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            // Cache'de varsa döndür
            return response;
          }
          
          // Cache'de yoksa ağdan al ve cache'e koy
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Ağ hatası durumunda placeholder döndür
            return new Response(
              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiAxNkMyMy4xNjM0IDE2IDE2IDIzLjE2MzQgMTYgMzJDMjMgNDAuODM2NiAzMiA0OCAzMiA0OEMzMiA0OCA0MCA0MC44MzY2IDQwIDMyQzQwIDIzLjE2MzQgMzIuODM2NiAxNiAzMiAxNloiIGZpbGw9IiNEMUQ1REIiLz4KPC9zdmc+',
              {
                headers: { 'Content-Type': 'image/svg+xml' }
              }
            );
          });
        });
      })
    );
    return;
  }
  
  // Diğer istekler için network-first stratejisi
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Activate event - eski cache'leri temizle
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message event - cache temizleme
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    });
  }
});
