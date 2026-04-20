"use client";

// Tiny client-side pill that flips a set's as_built flag via the PATCH
// route. Lives inline in the contractor sets list — contractors only.
// The server-rendered parent receives the initial value as a prop; the
// toggle optimistically flips local state and rolls back on error.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AsBuiltToggle({
  setId,
  initialAsBuilt,
}: {
  setId: string;
  initialAsBuilt: boolean;
}) {
  const [asBuilt, setAsBuilt] = useState(initialAsBuilt);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const next = !asBuilt;
    setAsBuilt(next);
    setPending(true);
    try {
      const res = await fetch(`/api/drawings/sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asBuilt: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      router.refresh();
    } catch {
      // rollback
      setAsBuilt(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className={`dr-pill ${asBuilt ? "green" : "gray"}`}
      onClick={toggle}
      disabled={pending}
      title={
        asBuilt
          ? "As-built (feeds closeout). Click to unmark."
          : "Mark this set as as-built. Feeds closeout package (Step 48)."
      }
      style={{ cursor: "pointer", border: asBuilt ? undefined : "1px dashed var(--surface-4)" }}
    >
      {asBuilt ? "As-built" : "Mark as-built"}
    </button>
  );
}
