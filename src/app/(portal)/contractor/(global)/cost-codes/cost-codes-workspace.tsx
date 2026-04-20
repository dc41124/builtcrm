"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CostCodesPortfolioView } from "@/domain/loaders/procurement";

export function CostCodesWorkspace({
  view,
}: {
  view: CostCodesPortfolioView;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEmpty = view.costCodes.length === 0;

  async function seedCsi() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/procurement/cost-codes/seed-csi", {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.message ?? j.error ?? "Seed failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addCode() {
    if (!code.trim() || !description.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/procurement/cost-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.message ?? j.error ?? "Create failed");
        return;
      }
      setCode("");
      setDescription("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/procurement/cost-codes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.message ?? j.error ?? "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cc-ws">
      <style>{COST_CODES_CSS}</style>

      <div className="pg-h">
        <div>
          <h2>Cost codes</h2>
          <p>
            Cost codes organize procurement spend by CSI MasterFormat
            division or your internal scheme. Scoped to your org — other
            contractors can&apos;t see or edit this list.
          </p>
        </div>
      </div>

      {errorMsg && <div className="err-banner">{errorMsg}</div>}

      {isEmpty && (
        <div className="csi-banner">
          <div>
            <div className="csi-title">Start with the CSI division starter set</div>
            <div className="csi-sub">
              Seeds ~25 division-level codes (01 General Requirements through
              33 Utilities). Add custom sub-codes from there. Skip this if
              you use an internal coding scheme — define your own below.
            </div>
          </div>
          <button
            type="button"
            className="btn sm pri"
            onClick={seedCsi}
            disabled={busy}
          >
            Populate CSI starter set
          </button>
        </div>
      )}

      <div className="add-card">
        <h3>Add a cost code</h3>
        <div className="add-row">
          <input
            className="q-in"
            style={{ maxWidth: 160 }}
            placeholder="Code (e.g. 05-12)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="q-in"
            placeholder="Description (e.g. Structural Steel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            className="btn sm pri"
            onClick={addCode}
            disabled={busy || !code.trim() || !description.trim()}
          >
            Add code
          </button>
        </div>
      </div>

      <div className="list-card">
        <div className="list-head">
          <h3>Your cost codes ({view.costCodes.length})</h3>
          {!isEmpty && (
            <button
              type="button"
              className="btn sm"
              onClick={seedCsi}
              disabled={busy}
            >
              Add any missing CSI divisions
            </button>
          )}
        </div>
        {view.costCodes.length === 0 ? (
          <div className="empty">No cost codes yet.</div>
        ) : (
          <table className="cc-tbl">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>POs</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.costCodes.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td>
                  <td>{c.description}</td>
                  <td>{c.poCount}</td>
                  <td>
                    <span className={`pl ${c.active ? "accent" : "neutral"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => toggleActive(c.id, !c.active)}
                      disabled={busy}
                    >
                      {c.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const COST_CODES_CSS = `
.cc-ws{
  --s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);
  font-family:var(--fb);color:var(--t1);font-size:14px;
}
.cc-ws .pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.cc-ws .pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:620px;line-height:1.5;margin-bottom:18px}
.cc-ws .btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);cursor:pointer;font-family:var(--fb)}
.cc-ws .btn:hover{border-color:var(--s4);background:var(--sh)}
.cc-ws .btn.pri{background:var(--ac);border-color:var(--ac);color:white}
.cc-ws .btn.pri:hover{background:var(--ac-h)}
.cc-ws .btn.sm{height:32px;padding:0 12px;font-size:12px}
.cc-ws .btn:disabled{opacity:.4;cursor:not-allowed}
.cc-ws .err-banner{background:var(--dg-s);color:var(--dg-t);border:1px solid #f5baba;border-radius:var(--r-m);padding:10px 14px;margin-bottom:12px;font-size:13px}
.cc-ws .csi-banner{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:16px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:16px;flex-wrap:wrap}
.cc-ws .csi-title{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--ac-t)}
.cc-ws .csi-sub{font-size:12px;color:var(--t2);margin-top:4px;max-width:620px;line-height:1.5}
.cc-ws .add-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px;margin-bottom:16px;box-shadow:var(--shsm)}
.cc-ws .add-card h3{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:10px}
.cc-ws .add-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cc-ws .q-in{height:36px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);padding:0 12px;font-size:13px;font-family:var(--fb);outline:none;flex:1;min-width:180px}
.cc-ws .q-in:focus{border-color:var(--ac)}
.cc-ws .list-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shsm)}
.cc-ws .list-head{padding:14px 18px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.cc-ws .list-head h3{font-family:var(--fd);font-size:13px;font-weight:700}
.cc-ws .empty{padding:40px 20px;text-align:center;color:var(--t3)}
.cc-ws .cc-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.cc-ws .cc-tbl th{background:var(--sh);font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:10px 14px;text-align:left;border-bottom:1px solid var(--s3)}
.cc-ws .cc-tbl td{padding:12px 14px;border-bottom:1px solid var(--s3);vertical-align:middle}
.cc-ws .mono{font-family:var(--fm);font-size:12px}
.cc-ws .pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);font-family:var(--fd);letter-spacing:.02em}
.cc-ws .pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.cc-ws .pl.neutral{background:var(--s2);color:var(--t2);border-color:var(--s3)}
`;
