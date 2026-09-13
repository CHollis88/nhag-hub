import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata = {
  title: "NHAG Church Hub",
  description: "North Hodge Assembly of God — church-wide hub",
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
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
