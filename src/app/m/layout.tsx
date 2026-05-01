import type { Metadata, Viewport } from "next";

import "./m.css";

// Mobile PWA route segment. Bypasses the desktop portal shell entirely
// (no top bar, no sidebar). Pages under /m/* are rendered as full-bleed
// mobile-optimized surfaces.
//
// The root layout already wires:
//   - theme pref + dark-class hydration script
//   - OfflineIndicator, OutboxBootstrap (Step 51 outbox), service worker
//   - apple-mobile-web-app-* meta tags
// so this layout doesn't need to repeat them.

export const metadata: Metadata = {
  title: "BuiltCRM Mobile",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // PWAs get the safe-area inset cover so headers can sit under the
  // status bar without overlapping the camera notch.
  viewportFit: "cover",
  themeColor: "#5b4fc7",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="m-root">{children}</div>;
}
