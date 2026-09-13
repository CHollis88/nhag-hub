const THEME_KEY = "sp_theme"; // "system" | "light" | "dark"

export function getStoredPreference() {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem(THEME_KEY) || "system";
}

export function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveEffective(pref) {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

export function applyTheme(pref) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, pref);
  const effective = resolveEffective(pref);
  document.documentElement.classList.toggle("dark", effective === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effective === "dark" ? "#161618" : "#F4F4F6");
}

// Keeps the app in sync if the phone's system setting changes while the
// preference is left on "system" (e.g. auto night mode kicking in at sunset).
export function watchSystemTheme() {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getStoredPreference() === "system") applyTheme("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

const TEXT_SIZE_KEY = "sp_text_size"; // "sm" | "md" | "lg"

export function getStoredTextSize() {
  if (typeof window === "undefined") return "md";
  return localStorage.getItem(TEXT_SIZE_KEY) || "md";
}

export function applyTextSize(size) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEXT_SIZE_KEY, size);
  document.documentElement.classList.remove(
    "text-scale-xs",
    "text-scale-sm",
    "text-scale-lg",
    "text-scale-xl",
    "text-scale-xxl"
  );
  if (size !== "md") document.documentElement.classList.add(`text-scale-${size}`);
}

// A plain string (not a React component) that gets injected as a blocking
// inline <script> in the document head, so the correct theme class is set
// before the page paints — otherwise there'd be a flash of the wrong theme
// on every load, especially for people whose preference differs from
// "system" default.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('${THEME_KEY}') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    var textSize = localStorage.getItem('sp_text_size') || 'md';
    if (textSize !== 'md') document.documentElement.classList.add('text-scale-' + textSize);
    document.addEventListener('DOMContentLoaded', function () {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#161618' : '#F4F4F6');
    });
  } catch (e) {}
})();
`;
