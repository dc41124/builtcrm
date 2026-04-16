export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--s0)" }}>
      <div className="bc-skel" style={{ width: 400, height: 340, borderRadius: "var(--r-xl)" }} />
    </div>
  );
}
