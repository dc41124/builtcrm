export default function MarketingPage() {
  return (
    <main
      style={{
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 32,
        background: "#f0f1f4",
        color: "#111318",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 640 }}>
        <h1
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 48,
            fontWeight: 820,
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          BuiltCRM
        </h1>
        <p style={{ fontSize: 16, fontWeight: 520, color: "#4a4f5c", marginTop: 16 }}>
          Construction project management for contractors, subs, and clients.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            marginTop: 28,
            padding: "12px 24px",
            borderRadius: 10,
            background: "#5b4fc7",
            color: "#fff",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 650,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Sign in
        </a>
      </div>
    </main>
  );
}
