import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "BuiltCRM",
  description: "Construction project management platform",
};

// Blocking script — runs before React hydration so the correct theme class is
// on <html> during first paint. Prevents light/dark flash. Reads localStorage
// first, then falls back to the OS prefers-color-scheme media query.
const themeInitScript = `(function(){try{var s=localStorage.getItem('builtcrm-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
