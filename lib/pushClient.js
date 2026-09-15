const SUBSCRIBED_KEY = "sp_push_subscribed";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Checks the browser's ACTUAL push subscription, not just a localStorage
// flag from the last time subscribe succeeded. This matters most on
// mobile/iOS, where a PWA's push subscription can silently die (permission
// revoked in the phone's own Settings, the service worker getting evicted
// after the app hasn't been opened in a while, etc.) while a stale
// localStorage flag would keep claiming "subscribed" forever, leaving the
// Settings toggle stuck showing ON when push has actually stopped working.
export async function isSubscribedToPush() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    const subscribed = Boolean(subscription);
    // Keep the flag in sync with reality, both directions -- this is what
    // actually fixes the stuck-toggle bug, not just working around it.
    if (subscribed) localStorage.setItem(SUBSCRIBED_KEY, "1");
    else localStorage.removeItem(SUBSCRIBED_KEY);
    return subscribed;
  } catch {
    return false;
  }
}

export async function subscribeToPush() {
  if (typeof window === "undefined") return { ok: false, reason: "no-window" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const registration = await navigator.serviceWorker.ready;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: "missing-vapid-key" };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });

  localStorage.setItem(SUBSCRIBED_KEY, "1");
  return { ok: true };
}

// Removes this device's subscription so it stops receiving our pushes.
// Browsers don't allow revoking Notification permission itself from code
// (only the person or their phone's own settings can do that) -- this is
// the meaningful "off switch" that's actually within our control.
export async function unsubscribeFromPush() {
  if (typeof window === "undefined") return { ok: false };
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
  } catch {
    // Best-effort -- even if the browser-side unsubscribe fails, removing
    // our stored subscription below still stops us from sending pushes.
  }
  await fetch("/api/push/subscribe", { method: "DELETE" });
  localStorage.removeItem(SUBSCRIBED_KEY);
  return { ok: true };
}
