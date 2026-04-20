"use client";

import { useMemo, useState } from "react";

import type {
  CostCodeRow,
  VendorRow,
} from "@/domain/loaders/procurement";
import {
  computePoTotals,
  formatCentsUsd,
} from "@/domain/procurement/totals";

// JSX prototype: "New purchase order" wizard, 3 steps.
//
// Step 1: Vendor & header (vendor select, cost code, expected delivery, notes)
// Step 2: Line items (description, qty, unit, unit cost, running total)
// Step 3: Review & issue (summary, issue/save-draft)

export type CreatePoInitialLine = {
  description: string;
  quantity: string;
  unit: string;
  unitCostDollars: string;
};

type Line = CreatePoInitialLine & { id: number };

const UNITS = ["ea", "lot", "lf", "sf", "cy", "ton"] as const;

function blankLine(): Line {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    description: "",
    quantity: "",
    unit: "ea",
    unitCostDollars: "",
  };
}

export function CreatePoModal({
  projectId,
  defaultTaxRatePercent,
  vendors,
  costCodes,
  onClose,
  onCreated,
}: {
  projectId: string;
  defaultTaxRatePercent: string;
  vendors: VendorRow[];
  costCodes: CostCodeRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vendorId, setVendorId] = useState<string>("");
  const [costCodeId, setCostCodeId] = useState<string>(costCodes[0]?.id ?? "");
  const [expectedDelivery, setExpectedDelivery] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>(defaultTaxRatePercent);
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [sendEmail, setSendEmail] = useState(true);
  const [saveToDocs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedLines = useMemo(
    () =>
      lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitCostCents: Math.round(parseFloat(l.unitCostDollars || "0") * 100),
      })),
    [lines],
  );

  const totals = useMemo(
    () =>
      computePoTotals({
        lines: parsedLines.map((l) => ({
          quantity: l.quantity || "0",
          unitCostCents: l.unitCostCents,
        })),
        taxRatePercent: taxRate || "0",
      }),
    [parsedLines, taxRate],
  );

  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }
  function rmLine(id: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== id)));
  }
  function updateLine(id: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const selectedVendor = vendors.find((v) => v.id === vendorId) ?? null;
  const selectedCostCode = costCodes.find((c) => c.id === costCodeId) ?? null;

  const step1Valid = vendorId !== "" && costCodeId !== "";
  const step2Valid = parsedLines.every(
    (l) =>
      l.description.trim().length > 0 &&
      parseFloat(l.quantity || "0") > 0 &&
      l.unitCostCents > 0,
  );

  async function submit(issue: boolean) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const body = {
        projectId,
        vendorId,
        costCodeId: costCodeId || null,
        taxRatePercent: parseFloat(taxRate || "0"),
        expectedDeliveryAt: expectedDelivery
          ? new Date(expectedDelivery).toISOString()
          : null,
        notes: notes || null,
        lines: parsedLines.map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity || "0"),
          unit: l.unit,
          unitCostCents: l.unitCostCents,
        })),
      };
      const createRes = await fetch("/api/procurement/purchase-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!createRes.ok) {
        const j = await createRes.json().catch(() => ({}));
        setErrorMsg(j.message ?? j.error ?? "Create failed");
        return;
      }
      const created = await createRes.json();
      const newPoId = created.purchaseOrder?.id;
      if (issue && newPoId) {
        const issueRes = await fetch(
          `/api/procurement/purchase-orders/${newPoId}/issue`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sendEmailToVendor: sendEmail,
            }),
          },
        );
        if (!issueRes.ok) {
          const j = await issueRes.json().catch(() => ({}));
          setErrorMsg(j.message ?? j.error ?? "Issue failed");
          return;
        }
      }
      onCreated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="proc-mdl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{MODAL_CSS}</style>
      <div className="mdl-card">
        <div className="mdl-h">
          <div>
            <h3>New purchase order</h3>
            <div className="sub">
              Step {step} of 3 ·{" "}
              {step === 1
                ? "Vendor & header"
                : step === 2
                  ? "Line items"
                  : "Review & issue"}
            </div>
          </div>
          <button type="button" className="x-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="wz-steps">
          <WizStep n={1} label="Vendor & header" step={step} />
          <div className="wz-sep" />
          <WizStep n={2} label="Line items" step={step} />
          <div className="wz-sep" />
          <WizStep n={3} label="Review & issue" step={step} />
        </div>

        <div className="mdl-body">
          {errorMsg && <div className="err-banner">{errorMsg}</div>}

          {step === 1 && (
            <div>
              <h4>Who is this PO to?</h4>
              <div className="fld">
                <label>Vendor</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">Select an existing vendor…</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.paymentTerms ? ` · ${v.paymentTerms}` : ""}
                    </option>
                  ))}
                </select>
                <div className="fld-hint">
                  Need a new vendor?{" "}
                  <a
                    href="/contractor/vendors"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Add one in Vendors
                  </a>{" "}
                  and come back.
                </div>
              </div>

              <h4 style={{ marginTop: 20 }}>PO header</h4>
              <div className="fld-row">
                <div className="fld">
                  <label>Cost code</label>
                  <select
                    value={costCodeId}
                    onChange={(e) => setCostCodeId(e.target.value)}
                  >
                    <option value="">Select a cost code…</option>
                    {costCodes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} {c.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fld">
                  <label>Expected delivery</label>
                  <input
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                  />
                </div>
              </div>
              <div className="fld-row">
                <div className="fld">
                  <label>Tax rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                  <div className="fld-hint">
                    Defaults from your org setting. Override per PO if
                    needed (tax-exempt items, different provinces, etc.).
                  </div>
                </div>
                <div className="fld">
                  <label>PO number</label>
                  <input
                    readOnly
                    disabled
                    value="Auto-assigned on save"
                    style={{ background: "var(--s2)", color: "var(--t3)" }}
                  />
                </div>
              </div>
              <div className="fld">
                <label>Notes for vendor (appears on issued PO)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery instructions, site contact, special handling…"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h4>Line items</h4>
              <div className="wz-lines">
                <div className="wz-li-h">
                  <div>Description</div>
                  <div>Qty</div>
                  <div>Unit</div>
                  <div>Unit cost</div>
                  <div style={{ textAlign: "right" }}>Line total</div>
                  <div />
                </div>
                {lines.map((l) => {
                  const qty = parseFloat(l.quantity || "0");
                  const unitCostCents = Math.round(
                    parseFloat(l.unitCostDollars || "0") * 100,
                  );
                  const lineTotal = Math.round(qty * unitCostCents);
                  return (
                    <div key={l.id} className="wz-li-row">
                      <input
                        placeholder="e.g. W14x30 beam, 20' lengths"
                        value={l.description}
                        onChange={(e) =>
                          updateLine(l.id, { description: e.target.value })
                        }
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(l.id, { quantity: e.target.value })
                        }
                      />
                      <select
                        value={l.unit}
                        onChange={(e) =>
                          updateLine(l.id, { unit: e.target.value })
                        }
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="$0.00"
                        value={l.unitCostDollars}
                        onChange={(e) =>
                          updateLine(l.id, { unitCostDollars: e.target.value })
                        }
                      />
                      <div className="tot">{formatCentsUsd(lineTotal)}</div>
                      <button
                        type="button"
                        className="wz-li-rm"
                        onClick={() => rmLine(l.id)}
                        disabled={lines.length === 1}
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn sm" onClick={addLine}>
                + Add line
              </button>

              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: "var(--si)",
                  borderRadius: "var(--r-m)",
                  border: "1px solid var(--s3)",
                }}
              >
                <div className="tot-row">
                  <span className="k">Subtotal</span>
                  <span className="v">{formatCentsUsd(totals.subtotalCents)}</span>
                </div>
                <div className="tot-row">
                  <span className="k">
                    Tax ({parseFloat(taxRate || "0").toFixed(2)}%)
                  </span>
                  <span className="v">
                    {formatCentsUsd(totals.taxAmountCents)}
                  </span>
                </div>
                <div className="tot-row grand">
                  <span>Total</span>
                  <span className="v">{formatCentsUsd(totals.totalCents)}</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h4>Review before issuing</h4>
              <div className="rev-grid">
                <div className="fld">
                  <label>Vendor</label>
                  <div className="v">{selectedVendor?.name ?? "—"}</div>
                </div>
                <div className="fld">
                  <label>Cost code</label>
                  <div className="v">
                    {selectedCostCode
                      ? `${selectedCostCode.code} ${selectedCostCode.description}`
                      : "—"}
                  </div>
                </div>
                <div className="fld">
                  <label>Expected delivery</label>
                  <div className="v">
                    {expectedDelivery
                      ? new Date(expectedDelivery).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </div>
                </div>
                <div className="fld">
                  <label>Tax rate</label>
                  <div className="v">
                    {parseFloat(taxRate || "0").toFixed(2)}%
                  </div>
                </div>
                <div className="fld">
                  <label>Line items</label>
                  <div className="v">{lines.length}</div>
                </div>
                <div className="fld">
                  <label>Total</label>
                  <div className="v">{formatCentsUsd(totals.totalCents)}</div>
                </div>
              </div>

              <h4 style={{ marginTop: 16 }}>Send &amp; post</h4>
              <label className="cx">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <div>
                  <div className="cx-l">Email PO PDF to vendor on issue</div>
                  <div className="cx-s">
                    Sends to the vendor contact email on file. (Email
                    transport wiring pending — the preference is logged on the
                    audit event today.)
                  </div>
                </div>
              </label>
              <label className="cx">
                <input
                  type="checkbox"
                  checked={saveToDocs}
                  disabled
                  readOnly
                />
                <div>
                  <div className="cx-l">Save to project Documents</div>
                  <div className="cx-s">
                    PDF is always attached to the project document library on
                    issue.
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="mdl-foot">
          <div className="mdl-foot-meta">
            {step < 3
              ? "POs are only sent when you click Issue on the final step."
              : "Issuing flips the PO to Issued and generates the PDF."}
          </div>
          <div className="mdl-foot-acts">
            <button
              type="button"
              className="btn sm"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            {step > 1 && (
              <button
                type="button"
                className="btn sm"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                disabled={busy}
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                className="btn sm pri"
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={
                  busy ||
                  (step === 1 && !step1Valid) ||
                  (step === 2 && !step2Valid)
                }
              >
                Next ›
              </button>
            )}
            {step === 3 && (
              <>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => submit(false)}
                  disabled={busy}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="btn sm pri"
                  onClick={() => submit(true)}
                  disabled={busy}
                >
                  Issue PO
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WizStep({
  n,
  label,
  step,
}: {
  n: 1 | 2 | 3;
  label: string;
  step: 1 | 2 | 3;
}) {
  const cur = step === n;
  const done = step > n;
  return (
    <div className={`wz-step ${cur ? "cur" : done ? "done" : ""}`}>
      <span className="n">{done ? "✓" : n}</span>
      <span>{label}</span>
    </div>
  );
}

const MODAL_CSS = `
.proc-mdl{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shlg:0 8px 32px rgba(26,23,20,.1);
  position:fixed;inset:0;background:rgba(12,14,20,.55);backdrop-filter:blur(3px);z-index:100;display:grid;place-items:center;padding:20px;font-family:var(--fb);color:var(--t1);
}
.proc-mdl .mdl-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shlg);width:min(820px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
.proc-mdl .mdl-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.proc-mdl .mdl-h h3{font-family:var(--fd);font-size:17px;font-weight:720;letter-spacing:-.02em}
.proc-mdl .mdl-h .sub{font-size:12px;color:var(--t3);margin-top:2px}
.proc-mdl .x-btn{border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);width:34px;height:34px;cursor:pointer;color:var(--t3);font-size:14px}
.proc-mdl .x-btn:hover{color:var(--t1)}
.proc-mdl .wz-steps{display:flex;gap:0;padding:14px 22px;background:var(--si);border-bottom:1px solid var(--s3);align-items:center}
.proc-mdl .wz-step{display:flex;align-items:center;gap:8px;font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t3)}
.proc-mdl .wz-step .n{width:22px;height:22px;border-radius:50%;background:var(--s2);color:var(--t3);display:grid;place-items:center;font-size:11px;font-weight:700;border:1px solid var(--s3)}
.proc-mdl .wz-step.cur{color:var(--ac-t)}
.proc-mdl .wz-step.cur .n{background:var(--ac);color:white;border-color:var(--ac)}
.proc-mdl .wz-step.done{color:var(--ok-t)}
.proc-mdl .wz-step.done .n{background:var(--ok);color:white;border-color:var(--ok)}
.proc-mdl .wz-sep{flex:1;height:1px;background:var(--s3);margin:0 10px}
.proc-mdl .mdl-body{padding:22px;overflow-y:auto;flex:1;font-size:13px}
.proc-mdl .mdl-body h4{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:10px}
.proc-mdl .fld{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.proc-mdl .fld label{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.05em}
.proc-mdl .fld-hint{font-size:11px;color:var(--t3);margin-top:4px}
.proc-mdl .fld-hint a{color:var(--ac-t)}
.proc-mdl .fld input,.proc-mdl .fld select,.proc-mdl .fld textarea{height:38px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);color:var(--t1);padding:0 12px;font-size:13px;font-family:var(--fb);outline:none}
.proc-mdl .fld textarea{min-height:72px;padding:10px 12px;resize:vertical}
.proc-mdl .fld input:focus,.proc-mdl .fld select:focus,.proc-mdl .fld textarea:focus{border-color:var(--ac)}
.proc-mdl .fld-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.proc-mdl .wz-lines{border:1px solid var(--s3);border-radius:var(--r-m);overflow:hidden;margin-bottom:12px;background:var(--si)}
.proc-mdl .wz-li-h{display:grid;grid-template-columns:1fr 90px 70px 120px 110px 36px;gap:8px;padding:8px 12px;background:var(--sh);font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--s3)}
.proc-mdl .wz-li-row{display:grid;grid-template-columns:1fr 90px 70px 120px 110px 36px;gap:8px;padding:10px 12px;border-bottom:1px solid var(--s3);align-items:center}
.proc-mdl .wz-li-row:last-child{border-bottom:none}
.proc-mdl .wz-li-row input,.proc-mdl .wz-li-row select{height:32px;border:1px solid var(--s3);border-radius:var(--r-s);background:var(--s1);color:var(--t1);padding:0 8px;font-size:12px;font-family:var(--fb);outline:none}
.proc-mdl .wz-li-row input:focus,.proc-mdl .wz-li-row select:focus{border-color:var(--ac)}
.proc-mdl .wz-li-row .tot{font-family:var(--fm);font-size:12px;color:var(--t2);padding:0;background:transparent;border:none;text-align:right}
.proc-mdl .wz-li-rm{width:28px;height:28px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer}
.proc-mdl .wz-li-rm:hover{color:var(--dg-t);border-color:#f5baba;background:var(--dg-s)}
.proc-mdl .wz-li-rm:disabled{opacity:.4;cursor:not-allowed}
.proc-mdl .tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.proc-mdl .tot-row.grand{font-family:var(--fd);font-size:14px;font-weight:750;padding-top:8px;border-top:1px solid var(--s3);margin-top:6px}
.proc-mdl .tot-row .k{color:var(--t3)}
.proc-mdl .tot-row .v{font-family:var(--fm)}
.proc-mdl .cx{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--si);cursor:pointer;margin-bottom:8px}
.proc-mdl .cx:hover{border-color:var(--s4)}
.proc-mdl .cx input{accent-color:var(--ac);width:14px;height:14px;margin-top:2px}
.proc-mdl .cx-l{font-size:12px;font-family:var(--fd);font-weight:600}
.proc-mdl .cx-s{font-size:11px;color:var(--t3);margin-top:2px}
.proc-mdl .rev-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.proc-mdl .rev-grid .fld{margin-bottom:0;gap:3px}
.proc-mdl .rev-grid .v{font-family:var(--fd);font-size:13px;font-weight:650}
.proc-mdl .mdl-foot{padding:14px 22px;background:var(--s2);border-top:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.proc-mdl .mdl-foot-meta{font-size:11px;color:var(--t3);flex:1;min-width:0}
.proc-mdl .mdl-foot-acts{display:flex;gap:6px}
.proc-mdl .btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);cursor:pointer;font-family:var(--fb)}
.proc-mdl .btn:hover{border-color:var(--s4);background:var(--sh)}
.proc-mdl .btn.pri{background:var(--ac);border-color:var(--ac);color:white}
.proc-mdl .btn.pri:hover{background:var(--ac-h)}
.proc-mdl .btn.sm{height:32px;padding:0 12px;font-size:12px}
.proc-mdl .btn:disabled{opacity:.4;cursor:not-allowed}
.proc-mdl .err-banner{background:var(--dg-s);color:var(--dg-t);border:1px solid #f5baba;border-radius:var(--r-m);padding:10px 14px;margin-bottom:12px;font-size:13px}
`;
