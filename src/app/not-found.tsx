import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32, textAlign: "center", background: "var(--s0)", fontFamily: "var(--fb)" }}>
      <div style={{ fontFamily: "var(--fd)", fontSize: 64, fontWeight: 820, color: "var(--s3)", letterSpacing: "-.04em", lineHeight: 1 }}>404</div>
      <h2 style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 740, color: "var(--t1)", margin: "12px 0 8px", letterSpacing: "-.01em" }}>Page not found</h2>
      <p style={{ fontSize: 14, fontWeight: 520, color: "var(--t2)", margin: "0 0 24px", maxWidth: 400 }}>
        The page you&#39;re looking for doesn&#39;t exist or has been moved.
      </p>
      <Link href="/login" style={{ height: 38, padding: "0 20px", borderRadius: "var(--r-m)", border: "none", background: "var(--ac, #5b4fc7)", color: "#fff", fontFamily: "var(--fd)", fontSize: 14, fontWeight: 650, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
        Go to login
      </Link>
    </div>
  );
}
