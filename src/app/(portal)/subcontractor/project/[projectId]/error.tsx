"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", gap: 16, textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "var(--r-m)", background: "var(--dg-s)", color: "var(--dg-t)", display: "grid", placeItems: "center" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h2 style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 740, color: "var(--t1)", margin: 0, letterSpacing: "-.01em" }}>Something went wrong</h2>
      <p style={{ fontFamily: "var(--fb)", fontSize: 13, fontWeight: 520, color: "var(--t2)", margin: 0, maxWidth: 400 }}>
        {error.message?.slice(0, 200) || "An unexpected error occurred. Please try again."}
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={reset}
          style={{ height: 36, padding: "0 16px", borderRadius: "var(--r-m)", border: "none", background: "var(--ac)", color: "#fff", fontFamily: "var(--fd)", fontSize: 13, fontWeight: 650, cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
