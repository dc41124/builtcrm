"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Instrument Sans', system-ui, sans-serif", background: "#f0f1f4", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <h2 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 740, color: "#111318", margin: "0 0 8px" }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#4a4f5c", margin: "0 0 20px" }}>{error.message?.slice(0, 200) || "An unexpected error occurred."}</p>
          <button onClick={reset} style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "none", background: "#5b4fc7", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 650, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
