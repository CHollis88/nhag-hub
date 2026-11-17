// Service worker for the NHAG PWA.
// Handles: push notifications, notification click routing, and a light
// offline cache for the app shell so it still opens with no connection.

const CACHE_NAME = "nhag-hub-v5";
const APP_SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Next.js content-hashes its static bundle filenames (e.g. /_next/static/
// abc123.js), so those are safe to serve cache-first — the filename itself
// changes whenever the content does. Everything else (the page itself,
// manifest.json, icons, etc.) uses network-first instead: try the network
// so updates show up immediately, and only fall back to the cache if the
// person is offline. This is what actually makes new deployments show up
// right away instead of being stuck on whatever was cached at install time.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.url.includes("/api/")) {
    // Straight to the network. (The old fallback looked in a cache that never
    // held API data, so it only ever returned "nothing".)
    return;
  }

  if (request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Only real page loads (and the shell files) are worth keeping for offline,
  // and only when the server actually answered OK. Caching error pages, a
  // Wi-Fi login/filter page, or Next's internal data requests could replay a
  // broken page later.
  const cacheable = request.mode === "navigate" || APP_SHELL.some((p) => request.url.endsWith(p));
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (cacheable && response.ok && response.type === "basic") {
          // Store pages by path only: "/?group=3&tab=news" and "/" are the same
          // app shell, and keeping one copy stops the cache growing forever.
          const url = new URL(request.url);
          const key = request.mode === "navigate" ? url.origin + url.pathname : request;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(key, clone));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: request.mode === "navigate" })
          .then((hit) => hit || (request.mode === "navigate" ? caches.match("/") : null))
          .then((hit) => hit || Response.error())
      )
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "NHAG", body: event.data.text() };
  }

  const { title, body, url } = payload;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title || "NHAG", {
        body: body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: url || "/" },
      }),
      // Also tell any open tab of the app right away, so its unread badge
      // updates the instant a push arrives instead of waiting on the
      // polling interval. If no tab is open this is a no-op -- the person
      // will just see the up-to-date count next time they open the app.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientsArr) => clientsArr.forEach((c) => c.postMessage({ type: "NEW_NOTIFICATION" }))),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(targetUrl);
          return;
        }
        self.clients.openWindow(targetUrl);
      })
  );
});
