const CACHE_NAME = 'perchel-cache-v1.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/logo.png'
];

// 설치 시 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// 기존 쓰레기 캐시 비우기
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 요청 가로채기 (에러 방어)
self.addEventListener('fetch', event => {
  // API 요청(백엔드 통신)은 캐싱하지 않고 무조건 네트워크 통과
  if (event.request.url.includes('onrender.com') && !event.request.url.includes('perchel-web')) {
      return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});