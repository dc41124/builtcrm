import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import "@/styles/globals.css";
import "@/styles/workspaces.css";

import { getServerSession } from "@/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export const metadata: Metadata = {
  title: "BuiltCRM",
  description: "Construction project management platform",
};

// Blocking pre-hydration script. Runs synchronously in <head> before first
// paint so the correct theme class is on <html> and we never flash the
// wrong theme. Order of precedence:
//   1. `data-theme-pref` attribute (set server-side from the user's DB prefs)
//   2. localStorage['builtcrm-theme']
//   3. OS `prefers-color-scheme`
// Whatever we resolve gets written back to localStorage so subsequent SSR
// responses can pick it up even for anonymous visitors.
const themeInitScript = `(function(){try{
  var el = document.documentElement;
  var pref = el.getAttribute('data-theme-pref');
  if (!pref) { try { pref = localStorage.getItem('builtcrm-theme'); } catch(e) {} }
  if (!pref) pref = 'system';
  var isDark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  el.classList.toggle('dark', isDark);
  try { localStorage.setItem('builtcrm-theme', pref); } catch(e) {}
}catch(e){}})();`;

async function readThemePref(): Promise<"light" | "dark" | "system"> {
  try {
    const sessionData = await getServerSession();
    const appUserId = sessionData?.session.appUserId;
    if (!appUserId) return "system";
    const [row] = await db
      .select({ theme: users.theme })
      .from(users)
      .where(eq(users.id, appUserId))
      .limit(1);
    return row?.theme ?? "system";
  } catch {
    return "system";
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themePref = await readThemePref();
  // For explicit light/dark we SSR the correct class directly. For 'system'
  // the class is decided by the client script based on prefers-color-scheme.
  const htmlClass = themePref === "dark" ? "dark" : undefined;

  return (
    // `suppressHydrationWarning` is load-bearing: the pre-hydration script
    // below can toggle the `dark` class on <html> before React hydrates
    // (e.g. for `system`-preference users whose OS is dark). That's the
    // standard theme-provider pattern and React emits a false "extra
    // attribute" warning for it without this flag.
    <html
      lang="en"
      className={htmlClass}
      data-theme-pref={themePref}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
