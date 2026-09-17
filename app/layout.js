import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata = {
  title: "NHAG",
  description: "North Hodge Assembly of God — church-wide hub",
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
};

// Rendered manually (rather than via Next's typed `viewport` export)
// specifically to include interactive-widget=resizes-content, which
// isn't one of the keys Next's export recognizes. On browsers that
// support it (Chrome/Android, and newer Safari), it tells the browser
// to actually shrink the layout viewport when the on-screen keyboard
// opens, instead of just overlaying it -- which is what several mobile
// browsers do by default, and exactly why a bottom-pinned compose bar
// could end up hidden behind the keyboard. lib/useViewportHeight.js is
// the JS fallback for browsers that don't honor this yet, so the layout
// is correct either way. viewport-fit=cover is required for
// env(safe-area-inset-bottom) to report anything other than 0 on iOS.
const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content={VIEWPORT_CONTENT} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
