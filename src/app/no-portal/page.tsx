import Link from "next/link";

export default function NoPortalPage() {
  return (
    <main style={{ padding: "4rem 2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1>No portal access yet</h1>
      <p>
        Your account isn&apos;t linked to any organization. Ask the person who
        invited you to send a fresh invitation, then sign in again.
      </p>
      <p>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
