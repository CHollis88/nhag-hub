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

// viewportFit: "cover" is required for env(safe-area-inset-bottom) to
// report anything other than 0 on iOS -- without this, the bottom-nav
// safe-area padding in BottomNav/GroupBottomNav silently does nothing,
// which is exactly why they still looked cramped against the phone's
// edge.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
