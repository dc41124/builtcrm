export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ padding: "48px 8px" }}>
      <h1
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 26,
          fontWeight: 820,
          letterSpacing: "-0.02em",
          color: "var(--t1)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 520,
          color: "var(--t3)",
          marginTop: 10,
          maxWidth: 560,
        }}
      >
        {description ?? "Coming soon. This page is scaffolded and will be built in a later step."}
      </p>
    </div>
  );
}
