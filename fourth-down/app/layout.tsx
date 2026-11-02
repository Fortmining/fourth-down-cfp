import "./style.css";
import { appleTouchIcon } from "./lib/apple-touch-icon";
import type { Metadata, Viewport } from "next";
export const viewport: Viewport = { themeColor: "#14243B", viewportFit: "cover" };
export const metadata: Metadata = {
  metadataBase: new URL("https://fourth-down-cfp.vercel.app"),
  applicationName: "Fourth Down",
  other: { "apple-mobile-web-app-capable": "yes" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Fourth Down", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/fourth-down.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{
      url: appleTouchIcon,
      sizes: "180x180", type: "image/png",
    }],
  },
  title: "Fourth Down | The College Football Playoff Picture",
  description:
    "Follow the road to twelve with live college football scores, official rankings, team schedules, and explained independent resume movement.",
  openGraph: {
    title: "Fourth Down · The road to twelve.",
    description: "Live scores. Poll movement. A clearer playoff picture.",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
