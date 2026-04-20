"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { VendorRow, VendorsPortfolioView } from "@/domain/loaders/procurement";
import { formatMoneyCents, formatMoneyCentsCompact } from "@/lib/format/money";

const formatCentsUsd = (c: number) => formatMoneyCents(c, { withCents: true });
const formatCentsCompact = (c: number) => formatMoneyCentsCompact(c);

type FormState = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  paymentTerms: string;
  rating: "preferred" | "standard";
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    paymentTerms: "",
    rating: "standard",
    notes: "",
  };
}

export function VendorsWorkspace({ view }: { view: VendorsPortfolioView }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const topVendor = view.vendors.find((v) => v.id === view.summary.topVendorId) ?? null;

  function openEdit(v: VendorRow) {
    setEditingId(v.id);
    setForm({
      name: v.name,
      contactName: v.contactName ?? "",
      contactEmail: v.contactEmail ?? "",
      contactPhone: v.contactPhone ?? "",
      address: v.address ?? "",
      paymentTerms: v.paymentTerms ?? "",
      rating: v.rating,
      notes: v.notes ?? "",
    });
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    setEditingId(null);
    setForm(emptyForm());
    setErrorMsg(null);
  }

  async function submit() {
    setBusy(true);
    setErrorMsg(null);
    const body = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      address: form.address.trim() || null,
      paymentTerms: form.paymentTerms.trim() || null,
      rating: form.rating,
      notes: form.notes.trim() || null,
    };
    try {
      const url = editingId
        ? `/api/procurement/vendors/${editingId}`
        : "/api/procurement/vendors";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.message ?? j.error ?? "Save failed");
        return;
      }
      closeModal();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ven-ws">
      <style>{VENDORS_CSS}</style>

      <div className="pg-h">
        <div>
          <h2>Vendors</h2>
          <p>
            Suppliers, fabricators, and equipment rental partners. Track
            contact, payment terms, and year-to-date spend.
          </p>
        </div>
        <div className="pg-h-acts">
          <button
            type="button"
            className="btn sm pri"
            onClick={() => {
              setShowAdd(true);
              setEditingId(null);
              setForm(emptyForm());
              setErrorMsg(null);
            }}
          >
            + Add vendor
          </button>
        </div>
      </div>

      <div className="ss">
        <div className="sc">
          <div className="sc-label">Total vendors</div>
          <div className="sc-value">{view.summary.totalVendors}</div>
          <div className="sc-meta">
            {view.summary.preferredCount} preferred
          </div>
        </div>
        <div className="sc strong">
          <div className="sc-label">Active POs</div>
          <div className="sc-value">{view.summary.activePoCount}</div>
          <div className="sc-meta">Across all vendors</div>
        </div>
        <div className="sc">
          <div className="sc-label">Spend YTD (all vendors)</div>
          <div className="sc-value">
            {formatCentsCompact(view.summary.spendYtdCents)}
          </div>
          <div className="sc-meta">
            {new Date().getFullYear()} year-to-date
          </div>
        </div>
        <div className="sc alert">
          <div className="sc-label">Top vendor</div>
          <div className="sc-value" style={{ fontSize: 15 }}>
            {topVendor?.name ?? "—"}
          </div>
          <div className="sc-meta">
            {topVendor
              ? `${formatCentsUsd(topVendor.spendYtdCents)} YTD · ${topVendor.rating}`
              : "No closed POs yet"}
          </div>
        </div>
      </div>

      {view.vendors.length === 0 ? (
        <div className="empty-card">
          <h3>No vendors yet</h3>
          <p>
            Add your first vendor to start issuing purchase orders. Vendors
            carry across projects — set them up once, reference them on every
            PO.
          </p>
        </div>
      ) : (
        <div className="ven-grid">
          {view.vendors.map((v) => (
            <div
              key={v.id}
              className={`vcard ${v.active ? "" : "inactive"}`}
              onClick={() => openEdit(v)}
              role="button"
            >
              <div className="vc-top">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="vc-name">{v.name}</div>
                  {v.contactName && (
                    <div className="vc-contact">
                      {v.contactName}
                      {v.contactEmail && (
                        <>
                          <br />
                          <span style={{ color: "var(--t3)" }}>
                            {v.contactEmail}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {v.rating === "preferred" && (
                  <span className="pl accent">Preferred</span>
                )}
              </div>
              <div className="vc-stats">
                <div className="vc-stat">
                  <div className="k">Payment terms</div>
                  <div className="v" style={{ fontFamily: "var(--fd)", fontSize: 13 }}>
                    {v.paymentTerms ?? "—"}
                  </div>
                </div>
                <div className="vc-stat">
                  <div className="k">Active POs</div>
                  <div className="v">{v.activePoCount}</div>
                </div>
                <div className="vc-stat">
                  <div className="k">Spend YTD</div>
                  <div className="v">{formatCentsUsd(v.spendYtdCents)}</div>
                </div>
                <div className="vc-stat">
                  <div className="k">Status</div>
                  <div className="v" style={{ fontFamily: "var(--fd)", fontSize: 13 }}>
                    <span
                      className={`pl ${v.active ? (v.rating === "preferred" ? "accent" : "neutral") : "red"}`}
                    >
                      {!v.active
                        ? "Inactive"
                        : v.rating === "preferred"
                          ? "Preferred"
                          : "Standard"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div
          className="mdl"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="mdl-card">
            <div className="mdl-h">
              <div>
                <h3>{editingId ? "Edit vendor" : "Add vendor"}</h3>
                <div className="sub">
                  Vendors carry across projects for your org.
                </div>
              </div>
              <button type="button" className="x-btn" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="mdl-body">
              {errorMsg && <div className="err-banner">{errorMsg}</div>}

              <div className="fld">
                <label>Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="fld-row">
                <div className="fld">
                  <label>Contact name</label>
                  <input
                    value={form.contactName}
                    onChange={(e) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                  />
                </div>
                <div className="fld">
                  <label>Contact email</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="fld-row">
                <div className="fld">
                  <label>Contact phone</label>
                  <input
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                  />
                </div>
                <div className="fld">
                  <label>Payment terms</label>
                  <input
                    value={form.paymentTerms}
                    onChange={(e) =>
                      setForm({ ...form, paymentTerms: e.target.value })
                    }
                    placeholder="Net 30"
                  />
                </div>
              </div>
              <div className="fld">
                <label>Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="fld">
                <label>Rating</label>
                <select
                  value={form.rating}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rating: e.target.value as "preferred" | "standard",
                    })
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="preferred">Preferred</option>
                </select>
              </div>
              <div className="fld">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="mdl-foot">
              <button
                type="button"
                className="btn sm"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn sm pri"
                onClick={submit}
                disabled={busy || form.name.trim().length === 0}
              >
                {editingId ? "Save changes" : "Add vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const VENDORS_CSS = `
.ven-ws{
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
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 8px 32px rgba(26,23,20,.1);
  font-family:var(--fb);color:var(--t1);font-size:14px;
}
.ven-ws .pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.ven-ws .pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.ven-ws .pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:620px;line-height:1.5}
.ven-ws .pg-h-acts{display:flex;gap:8px;flex-shrink:0;padding-top:4px}
.ven-ws .btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.ven-ws .btn:hover{border-color:var(--s4);background:var(--sh)}
.ven-ws .btn.pri{background:var(--ac);border-color:var(--ac);color:white}
.ven-ws .btn.pri:hover{background:var(--ac-h)}
.ven-ws .btn.sm{height:32px;padding:0 12px;font-size:12px}
.ven-ws .btn:disabled{opacity:.4;cursor:not-allowed}
.ven-ws .ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
@media (max-width:960px){.ven-ws .ss{grid-template-columns:repeat(2,1fr)}}
.ven-ws .sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.ven-ws .sc.alert{border-color:#f5d5a0}
.ven-ws .sc.strong{border-color:var(--ac-m)}
.ven-ws .sc-label{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.ven-ws .sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.ven-ws .sc-meta{font-size:12px;color:var(--t3);margin-top:2px}
.ven-ws .pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;font-family:var(--fd);letter-spacing:.02em}
.ven-ws .pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.ven-ws .pl.neutral{background:var(--s2);color:var(--t2);border-color:var(--s3)}
.ven-ws .pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.ven-ws .ven-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.ven-ws .vcard{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px 18px;box-shadow:var(--shsm);cursor:pointer;transition:all 120ms}
.ven-ws .vcard:hover{border-color:var(--s4);box-shadow:var(--shmd)}
.ven-ws .vcard.inactive{opacity:.7}
.ven-ws .vc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
.ven-ws .vc-name{font-family:var(--fd);font-size:15px;font-weight:700;letter-spacing:-.02em}
.ven-ws .vc-contact{font-size:12px;color:var(--t2);margin-top:4px;line-height:1.4}
.ven-ws .vc-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:12px;margin-top:12px;border-top:1px solid var(--s3)}
.ven-ws .vc-stat .k{font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.ven-ws .vc-stat .v{font-family:var(--fm);font-size:14px;font-weight:700;margin-top:3px}
.ven-ws .empty-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:40px 20px;text-align:center;box-shadow:var(--shsm)}
.ven-ws .empty-card h3{font-family:var(--fd);font-size:16px;font-weight:700;margin-bottom:8px}
.ven-ws .empty-card p{font-size:13px;color:var(--t2);max-width:480px;margin:0 auto;line-height:1.5}
.ven-ws .mdl{position:fixed;inset:0;background:rgba(12,14,20,.55);backdrop-filter:blur(3px);z-index:100;display:grid;place-items:center;padding:20px}
.ven-ws .mdl-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shlg);width:min(620px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
.ven-ws .mdl-h{padding:16px 20px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.ven-ws .mdl-h h3{font-family:var(--fd);font-size:16px;font-weight:720}
.ven-ws .mdl-h .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ven-ws .x-btn{border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);width:34px;height:34px;cursor:pointer;color:var(--t3)}
.ven-ws .mdl-body{padding:20px;overflow-y:auto;flex:1}
.ven-ws .mdl-foot{padding:12px 20px;background:var(--s2);border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px}
.ven-ws .err-banner{background:var(--dg-s);color:var(--dg-t);border:1px solid #f5baba;border-radius:var(--r-m);padding:10px 14px;margin-bottom:12px;font-size:13px}
.ven-ws .fld{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.ven-ws .fld label{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.05em}
.ven-ws .fld input,.ven-ws .fld select,.ven-ws .fld textarea{height:38px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);color:var(--t1);padding:0 12px;font-size:13px;font-family:var(--fb);outline:none}
.ven-ws .fld textarea{min-height:72px;padding:10px 12px;resize:vertical}
.ven-ws .fld input:focus,.ven-ws .fld select:focus,.ven-ws .fld textarea:focus{border-color:var(--ac)}
.ven-ws .fld-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
`;
