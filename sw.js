const CACHE_NAME = 'perchel-v2'; 
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css'
];

// [1] 서비스 워커 설치: 핵심 리소스 미리 저장
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[Service Worker] 설치 및 자산 캐싱 중...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // 업데이트 시 유저가 창을 닫지 않아도 즉시 적용
});

// [2] 활성화: 구버전 캐시 자동 삭제 로직
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cache) {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] 구버전 캐시 삭제:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// [3] 페치(Fetch): 스마트 캐싱 전략
self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // 백엔드 API 요청은 항상 '네트워크 우선' (최신 데이터 보장)
  if (url.includes('onrender.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 그 외 정적 파일은 '캐시 우선' (속도 극대화)
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});