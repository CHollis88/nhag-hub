const KEY = "sp_admin_mode";

// This is purely a personal view preference -- like theme or text size --
// not a permission. An admin's actual authority (is_church_admin, checked
// server-side on every request) never changes based on this. Turning it
// off just hides the Admin Toolbox and other admin-only UI from your own
// view, for whenever you'd rather use the app like a regular member
// without the extra controls in the way. Turning it back on needs no
// re-authentication -- there's nothing to prove, since nothing was ever
// actually revoked.
export function isAdminModeOn() {
  if (typeof window === "undefined") return true; // default on for SSR/first paint
  const stored = localStorage.getItem(KEY);
  return stored === null ? true : stored === "on";
}

export function setAdminMode(on) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "on" : "off");
}
