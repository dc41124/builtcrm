"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function NewTemplateButton() {
  const router = useRouter();
  const [pending, startTx] = useTransition();

  const handle = () => {
    startTx(async () => {
      const res = await fetch("/api/prequal/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled template",
          questions: [],
          scoringRules: { passThreshold: 0, gatingFailValues: {} },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(text || "Failed to create template");
        return;
      }
      const json = (await res.json()) as { id: string };
      router.push(
        `/contractor/settings/prequalification/templates/${json.id}`,
      );
      router.refresh();
    });
  };

  return (
    <button className="pq-btn primary" onClick={handle} disabled={pending}>
      {pending ? "Creating…" : "New template"}
    </button>
  );
}
