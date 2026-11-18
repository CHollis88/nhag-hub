// "Install on your Home Screen" guide (v71.29): works out which phone,
// which browser, and (on iPhone) which Safari, so the guide shows only the
// steps that apply to this person.
//
// Nothing here can install the app on an iPhone -- Apple doesn't allow a
// website to. Android's Chrome can, through the "beforeinstallprompt" event
// captured in lib/installPrompt.js.

export const INSTALL_DISMISSED_KEY = "nhag_install_have_it"; // "I already have it" (for good)
export const INSTALL_LATER_KEY = "nhag_install_later"; // "Not now" (this visit only)

/** Running from the home-screen icon (the installed app)? */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    if (window.navigator.standalone === true) return true; // iPhone/iPad
    return ["standalone", "fullscreen", "minimal-ui"].some(
      (m) => window.matchMedia?.(`(display-mode: ${m})`).matches
    );
  } catch {
    return false;
  }
}

/**
 * @returns {{
 *   os: "ios"|"android"|"other",
 *   iPad: boolean,
 *   browser: "safari"|"chrome"|"samsung"|"firefox"|"edge"|"opera"|"inapp"|"other",
 *   inAppName: string|null,      // "Facebook", "Messenger", ... when browser === "inapp"
 *   safariMajor: number|null,    // iPhone Safari's version (26 = iOS 26 layout)
 *   iosMajor: number|null,
 *   iosMinor: number,
 *   mobile: boolean,
 * }}
 */
export function detectDevice(ua = typeof navigator !== "undefined" ? navigator.userAgent : "", touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0) {
  const iPadOS = /Macintosh/.test(ua) && touchPoints > 1; // iPads ask for the desktop site
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  const android = /Android/i.test(ua);
  const os = ios ? "ios" : android ? "android" : "other";
  const iPad = /iPad/.test(ua) || iPadOS;

  // Apps' built-in browsers can't add anything to the home screen.
  const IN_APP = [
    [/FBAN\/Messenger|MessengerForiOS|\bOrca-Android|FB_IAB\/Orca/i, "Messenger"],
    [/FBAN|FBAV|FB_IAB|FBIOS|\[FB/i, "Facebook"],
    [/Instagram/i, "Instagram"],
    [/Snapchat/i, "Snapchat"],
    [/TikTok|musical_ly|BytedanceWebview/i, "TikTok"],
    [/Twitter|\bX\//i, "X"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Pinterest/i, "Pinterest"],
    [/\bLine\//i, "LINE"],
    [/\bGSA\//i, "the Google app"],
    [/GmailApp|Gmail/i, "Gmail"],
  ];
  let inAppName = null;
  for (const [re, name] of IN_APP) {
    if (re.test(ua)) {
      inAppName = name;
      break;
    }
  }

  let browser = "other";
  if (inAppName) browser = "inapp";
  else if (ios) {
    if (/CriOS/.test(ua)) browser = "chrome";
    else if (/FxiOS/.test(ua)) browser = "firefox";
    else if (/EdgiOS/.test(ua)) browser = "edge";
    else if (/OPiOS|OPT\//.test(ua)) browser = "opera";
    else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "safari";
    else {
      // A plain iOS web view (no "Safari/" token): some app's built-in browser.
      browser = "inapp";
      inAppName = "this app";
    }
  } else if (android) {
    if (/SamsungBrowser/i.test(ua)) browser = "samsung";
    else if (/Firefox/i.test(ua)) browser = "firefox";
    else if (/EdgA/i.test(ua)) browser = "edge";
    else if (/OPR|Opera/i.test(ua)) browser = "opera";
    else if (/; wv\)/.test(ua) || /Version\/[\d.]+ Chrome\//.test(ua)) {
      browser = "inapp"; // Android WebView
      inAppName = inAppName || "this app";
    } else if (/Chrome\//.test(ua)) browser = "chrome";
  }

  const sv = ua.match(/Version\/(\d+)/);
  const safariMajor = ios && sv ? Number(sv[1]) : null;
  const ov = ua.match(/OS (\d+)_(\d+)/);
  const iosMinor = ios && ov ? Number(ov[2]) : 0;
  // iOS 26 still reports "OS 18_x" here; Safari's own version says 26.
  const iosMajor = ios ? Math.max(ov ? Number(ov[1]) : 0, safariMajor || 0) || null : null;

  return { os, iPad, browser, inAppName, safariMajor, iosMajor, iosMinor, mobile: ios || android };
}

/** Should the guide pop up on its own right now? */
export function shouldAutoShowInstallGuide() {
  if (typeof window === "undefined") return false;
  if (isStandalone()) return false;
  const d = detectDevice();
  if (!d.mobile) return false;
  try {
    if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return false;
    if (sessionStorage.getItem(INSTALL_LATER_KEY)) return false;
  } catch {
    // private mode: show it
  }
  return true;
}

/** The link that jumps out of an app's built-in browser into a real one. */
export function openInBrowserUrl(device, href = typeof location !== "undefined" ? location.href : "") {
  const url = new URL(href);
  if (device.os === "android") {
    // Android: opens this exact page in Chrome (falls back to the page itself).
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  }
  // iPhone: opens Safari on most iOS versions (not iOS 16, and some apps
  // like TikTok block it -- the guide falls back to copy-and-paste).
  return `x-safari-${href}`;
}

/** Inline script for app/layout.js: catch Android's install event before the
 * app's own code loads (lib/installPrompt.js picks it up). */
export const INSTALL_CAPTURE_SCRIPT =
  "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__nhagInstallEvent=e;});";

/** The address to share: the church's own domain, even when an admin opened
 * the app at the old *.vercel.app address (an icon added from there would be
 * a separate install). Local/preview addresses are left alone. */
export function installOrigin() {
  if (typeof window === "undefined") return "https://app.nhagchurch.org";
  const o = window.location.origin;
  return /nhag-hub\.vercel\.app$/.test(window.location.host) ? "https://app.nhagchurch.org" : o;
}
