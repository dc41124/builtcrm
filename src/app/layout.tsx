import type { Metadata } from "next";

import "@/styles/globals.css";
import "@/styles/workspaces.css";

import { OfflineIndicator } from "@/components/shell/OfflineIndicator";
import { OutboxBootstrap } from "@/components/shell/OutboxBootstrap";
import { RegisterServiceWorker } from "@/components/shell/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "BuiltCRM",
  description: "Construction project management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#5b4fc7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BuiltCRM" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        <OfflineIndicator />
        <OutboxBootstrap />
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
