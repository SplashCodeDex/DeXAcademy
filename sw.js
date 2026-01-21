
const CACHE_NAME = 'mockup_studio-v1';
// Only cache stable paths on install. 
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE).catch(err => console.log('SW Cache Warning:', err));
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 1. Navigation (HTML): Network First, Fallback to Cache
  // This ensures the user always gets the latest version of the app if online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
           // Update cache with new version
           const responseToCache = response.clone();
           caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
           return response;
        })
        .catch(() => {
           // Offline: Serve cached HTML
           return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // 2. Assets (JS/CSS/Images): Cache First, Fallback to Network
  // Hashed filenames allow us to safely cache forever.
  if (!event.request.url.startsWith('http')) return;

  // EXCLUSION LIST: Do not cache these dynamic/3rd-party scripts
  const url = event.request.url;
  if (
      url.includes('imasdk.googleapis.com') ||
      url.includes('doubleclick.net') ||
      url.includes('googlesyndication.com') ||
      url.includes('google-analytics.com')
  ) {
      return; // Fallback to browser network behavior
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;
        
        const fetchRequest = event.request.clone();
        return fetch(fetchRequest).then(
          (response) => {
            if(!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        ).catch((err) => {
            // Failed to fetch and not in cache.
            // Return nothing to let the browser handle the error naturally, or return a fallback if appropriate.
            // For images/scripts, returning nothing causes a network error, which is correct behavior when offline/failing.
            console.warn('Fetch failed for', event.request.url, err);
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