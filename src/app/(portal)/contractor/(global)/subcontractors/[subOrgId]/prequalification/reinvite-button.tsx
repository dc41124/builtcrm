"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReinviteButton({ subOrgId }: { subOrgId: string }) {
  const router = useRouter();
  const [pending, startTx] = useTransition();

  const handle = () => {
    startTx(async () => {
      const res = await fetch("/api/prequal/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subOrgId }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(text || "Failed to invite");
        return;
      }
      router.refresh();
    });
  };

  return (
    <button className="pq-btn primary" onClick={handle} disabled={pending}>
      {pending ? "Inviting…" : "Invite to (re)prequalify"}
    </button>
  );
}
