// 오프라인에서도 앱이 열리도록 기본 파일을 캐시
const CACHE = 'wims-v12';
const FILES = [
  './', 'index.html', 'parents.html', 'style.css', 'app.js', 'parents.js', 'cloud.js', 'firebase-config.js', 'kakao.js', 'kakao-config.js',
  'manifest.webmanifest', 'parents.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// 네트워크 우선, 실패하면 캐시. Firebase 등 외부 요청은 건드리지 않음
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // 브라우저 HTTP 캐시(GitHub Pages는 10분)를 건너뛰고 항상 최신 파일을 받음.
  // 화면과 코드 버전이 섞여서 버튼이 안 먹는 문제를 막기 위해서.
  event.respondWith(
    fetch(event.request.url, { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
