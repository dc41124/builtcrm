"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type {
  ContractorPaymentsView,
  PaymentRow,
} from "@/domain/loaders/payments";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

const C = {
  surface0: "var(--s0)",
  surface1: "var(--s1)",
  surface2: "var(--s2)",
  surface3: "var(--s3)",
  surface4: "var(--s4)",
  surfaceHover: "var(--sh)",
  textPrimary: "var(--t1)",
  textSecondary: "var(--t2)",
  textTertiary: "var(--t3)",
  accent: "var(--ac)",
  accentSoft: "var(--ac-s)",
  accentText: "var(--ac-t)",
  accentMuted: "var(--ac-s)",
  success: "var(--ok)",
  successSoft: "var(--ok-s)",
  successText: "var(--ok-t)",
  warning: "var(--wr)",
  warningSoft: "var(--wr-s)",
  warningText: "var(--wr-t)",
  danger: "var(--dg)",
  dangerSoft: "var(--dg-s)",
  dangerText: "var(--dg-t)",
  info: "var(--in)",
  infoSoft: "var(--in-s)",
  infoText: "var(--in-t)",
};

export function PaymentsView({
  view,
  nowMs,
}: {
  view: ContractorPaymentsView;
  nowMs: number;
}) {
  const canManage = view.context.role === "contractor_admin";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        fontFamily: F.body,
        color: C.textPrimary,
      }}
    >
      <PageHeader
        title="Payments"
        subtitle="Manage your Stripe Connect account, view processed payments, and configure payment preferences."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
          gap: 16,
        }}
      >
        <StripeHeroCard view={view} canManage={canManage} />
        <PaymentMethodsCard
          stripeConnected={view.stripeConnectionConnectedAndHealthy}
        />
      </div>

      <PaymentsListSection
        payments={view.payments}
        canManage={canManage}
        nowMs={nowMs}
      />
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h1
        style={{
          fontFamily: F.display,
          fontSize: 26,
          fontWeight: 820,
          letterSpacing: "-.035em",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 14,
          color: C.textSecondary,
          marginTop: 6,
          marginBottom: 0,
          maxWidth: 680,
          fontWeight: 520,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

// ── Stripe hero card ────────────────────────────────────────────────────
function StripeHeroCard({
  view,
  canManage,
}: {
  view: ContractorPaymentsView;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conn = view.stripeConnection;

  async function connect() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/integrations/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "stripe" }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "connect_failed");
      return;
    }
    router.refresh();
  }

  async function disconnect() {
    if (!conn) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/integrations/${conn.id}/disconnect`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "disconnect_failed");
      return;
    }
    router.refresh();
  }

  return (
    <div
      style={{
        background: C.surface1,
        border: `1px solid ${C.surface3}`,
        borderRadius: 18,
        padding: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "linear-gradient(135deg,#635bff,#4f46d6)",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontFamily: F.display,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-.02em",
          }}
        >
          S
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 720,
              letterSpacing: "-.01em",
            }}
          >
            Stripe Connect
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.textSecondary,
              marginTop: 2,
              fontWeight: 520,
            }}
          >
            {conn ? (
              <>
                Account:{" "}
                <span style={{ fontFamily: F.mono, fontSize: 11 }}>
                  {conn.externalAccountId ?? conn.externalAccountName ?? "—"}
                </span>{" "}
                ·{" "}
                {conn.status === "connected"
                  ? "Verified"
                  : conn.status === "needs_reauth"
                    ? "Needs re-auth"
                    : conn.status === "error"
                      ? "Error"
                      : "Pending verification"}
              </>
            ) : (
              "Not connected. Accept ACH and card payments via Stripe Connect."
            )}
          </div>
        </div>
        {conn ? (
          <span
            style={pillStyle(conn.status === "connected" ? "green" : "orange")}
          >
            {conn.status === "connected" ? "Active" : conn.status}
          </span>
        ) : (
          <span style={pillStyle("gray")}>Not connected</span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <MiniStat
          label="Total processed"
          value={formatMoney(view.totalProcessedCents)}
          meta={
            view.processedCount > 0
              ? `${view.processedCount} payment${view.processedCount === 1 ? "" : "s"} across ${view.projectsWithPaymentsCount} project${view.projectsWithPaymentsCount === 1 ? "" : "s"}`
              : "No payments yet"
          }
        />
        <MiniStat
          label="Processing fees"
          value={formatMoney(view.totalFeesCents)}
          meta={
            view.totalProcessedCents > 0
              ? `Avg ${percent(view.totalFeesCents, view.totalProcessedCents)} · ACH cap $5/txn`
              : "ACH 0.8% · Card 2.9% + $0.30"
          }
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {conn ? (
          <>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noreferrer"
              style={smBtnLinkStyle(false)}
            >
              Stripe dashboard ↗
            </a>
            <button
              disabled={!canManage}
              onClick={() => {
                /* Payout settings open in Stripe dashboard in Phase 2 */
              }}
              style={smBtnStyle(false)}
            >
              Payout settings
            </button>
            <button
              disabled={!canManage || pending}
              onClick={disconnect}
              style={smBtnStyle(true)}
            >
              {pending ? "…" : "Disconnect"}
            </button>
          </>
        ) : (
          <button
            disabled={!canManage || pending}
            onClick={connect}
            style={btnPrimary(canManage && !pending)}
          >
            {pending ? "Connecting…" : "Connect Stripe"}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: C.dangerText,
            fontWeight: 520,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div
      style={{
        background: C.surface2,
        border: `1px solid ${C.surface3}`,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          color: C.textTertiary,
          fontWeight: 700,
          fontFamily: F.display,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 20,
          fontWeight: 820,
          letterSpacing: "-.03em",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: C.textSecondary,
          marginTop: 3,
          fontWeight: 520,
        }}
      >
        {meta}
      </div>
    </div>
  );
}

// ── Payment methods card ────────────────────────────────────────────────
function PaymentMethodsCard({
  stripeConnected,
}: {
  stripeConnected: boolean;
}) {
  const methods = [
    {
      key: "ach",
      name: "ACH Bank Transfer",
      desc: "0.8% fee, capped at $5 per transaction",
      pillLabel: stripeConnected ? "Enabled" : "Requires Stripe",
      pillTone: stripeConnected ? ("green" as const) : ("gray" as const),
      iconBg: stripeConnected ? C.successSoft : C.surface2,
      iconColor: stripeConnected ? C.successText : C.textTertiary,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18" />
          <path d="M3 10h18" />
          <path d="M5 6l7-3 7 3" />
          <path d="M4 10v11" />
          <path d="M20 10v11" />
          <path d="M8 14v3" />
          <path d="M12 14v3" />
          <path d="M16 14v3" />
        </svg>
      ),
    },
    {
      key: "card",
      name: "Credit / Debit Card",
      desc: "2.9% + $0.30 per transaction",
      pillLabel: stripeConnected ? "Enabled" : "Requires Stripe",
      pillTone: stripeConnected ? ("green" as const) : ("gray" as const),
      iconBg: stripeConnected ? C.infoSoft : C.surface2,
      iconColor: stripeConnected ? C.infoText : C.textTertiary,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      key: "manual",
      name: "Manual recording",
      desc: "Record checks, wires, and other offline payments for tracking",
      pillLabel: "Always on",
      pillTone: "blue" as const,
      iconBg: C.surface2,
      iconColor: C.textSecondary,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        background: C.surface1,
        border: `1px solid ${C.surface3}`,
        borderRadius: 18,
        padding: 20,
      }}
    >
      <h4
        style={{
          fontFamily: F.display,
          fontSize: 14,
          fontWeight: 720,
          margin: 0,
        }}
      >
        Payment methods enabled
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {methods.map((m) => (
          <div
            key={m.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              background: C.surface2,
              border: `1px solid ${C.surface3}`,
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: m.iconBg,
                color: m.iconColor,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {m.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 13,
                  fontWeight: 650,
                }}
              >
                {m.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.textSecondary,
                  marginTop: 1,
                  fontWeight: 520,
                }}
              >
                {m.desc}
              </div>
            </div>
            <span style={pillStyle(m.pillTone)}>{m.pillLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Payments list ───────────────────────────────────────────────────────
function PaymentsListSection({
  payments,
  canManage,
  nowMs,
}: {
  payments: PaymentRow[];
  canManage: boolean;
  nowMs: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
          borderBottom: `1px solid ${C.surface3}`,
          paddingBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: F.display,
              fontSize: 18,
              fontWeight: 740,
              letterSpacing: "-.02em",
              margin: 0,
            }}
          >
            Recent payments
          </h2>
          <p
            style={{
              fontSize: 12.5,
              color: C.textSecondary,
              marginTop: 3,
              fontWeight: 520,
              maxWidth: 640,
            }}
          >
            All payment transactions across projects
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled
            title="Payments CSV export lands in Phase 8-lite"
            style={smBtnStyle(false)}
          >
            Export
          </button>
          <button
            disabled={!canManage}
            onClick={() => setModalOpen(true)}
            style={smBtnStyle(false)}
          >
            Record manual payment
          </button>
        </div>
      </div>

      {payments.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: C.textTertiary,
            fontSize: 13,
            fontWeight: 520,
            border: `1px dashed ${C.surface3}`,
            borderRadius: 14,
            background: C.surface1,
          }}
        >
          No payments recorded yet. When Stripe payments settle or you record a
          manual payment, they will appear here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {payments.map((p) => (
            <PaymentRowItem key={p.id} p={p} nowMs={nowMs} />
          ))}
        </div>
      )}

      {modalOpen && (
        <RecordManualPaymentModal onClose={() => setModalOpen(false)} />
      )}
    </section>
  );
}

function PaymentRowItem({ p, nowMs }: { p: PaymentRow; nowMs: number }) {
  const { iconBg, icon } = methodIcon(p.paymentMethodType);
  const statusPill = paymentStatusPill(p.transactionStatus);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        border: `1px solid ${C.surface3}`,
        borderRadius: 10,
        background: C.surface1,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          background: iconBg,
          color: C.textPrimary,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 13,
            fontWeight: 650,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textSecondary,
            fontWeight: 520,
            marginTop: 2,
          }}
        >
          {buildPaymentMeta(p, nowMs)}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 120 }}>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 15,
            fontWeight: 750,
            letterSpacing: "-.02em",
          }}
        >
          {formatMoney(p.grossAmountCents, p.currency)}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textTertiary,
            fontWeight: 520,
            marginTop: 2,
          }}
        >
          {p.processingFeeCents > 0
            ? `Fee ${formatMoney(p.processingFeeCents, p.currency)} · Net ${formatMoney(p.netAmountCents, p.currency)}`
            : "Fee: — · Recorded manually"}
        </div>
      </div>
      <span style={pillStyle(statusPill.tone)}>{statusPill.label}</span>
    </div>
  );
}

function methodIcon(type: string): {
  iconBg: string;
  icon: ReactNode;
} {
  if (type === "ach_debit") {
    return {
      iconBg: C.successSoft,
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18" />
          <path d="M3 10h18" />
          <path d="M5 6l7-3 7 3" />
          <path d="M4 10v11" />
          <path d="M20 10v11" />
        </svg>
      ),
    };
  }
  if (type === "card") {
    return {
      iconBg: C.infoSoft,
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    };
  }
  if (type === "wire" || type === "check" || type === "other") {
    return {
      iconBg: C.warningSoft,
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    };
  }
  return { iconBg: C.surface2, icon: "•" };
}

function buildPaymentMeta(p: PaymentRow, nowMs: number): string {
  const parts: string[] = [];
  if (p.paymentMethodType === "ach_debit") {
    parts.push("ACH");
    if (p.methodDetails.bankName && p.methodDetails.last4) {
      parts.push(`${p.methodDetails.bankName} ****${p.methodDetails.last4}`);
    } else if (p.methodDetails.last4) {
      parts.push(`****${p.methodDetails.last4}`);
    }
  } else if (p.paymentMethodType === "card") {
    const brand =
      p.methodDetails.brand
        ? p.methodDetails.brand.charAt(0).toUpperCase() +
          p.methodDetails.brand.slice(1)
        : "Card";
    parts.push(brand);
    if (p.methodDetails.last4) parts.push(`****${p.methodDetails.last4}`);
  } else if (p.paymentMethodType === "check") {
    parts.push(
      p.externalReference ? `Check #${p.externalReference}` : "Check",
    );
  } else if (p.paymentMethodType === "wire") {
    parts.push(
      p.externalReference ? `Wire ${p.externalReference}` : "Wire transfer",
    );
  } else {
    parts.push("Manual");
  }
  if (p.payerName) parts.push(p.payerName);
  const when = p.succeededAt ?? p.initiatedAt ?? p.createdAt;
  parts.push(formatDate(when, nowMs));
  return parts.join(" · ");
}

function paymentStatusPill(status: string): {
  tone: "green" | "orange" | "gray" | "blue";
  label: string;
} {
  if (status === "succeeded") return { tone: "green", label: "Succeeded" };
  if (status === "processing") return { tone: "orange", label: "Processing" };
  if (status === "pending") return { tone: "orange", label: "Pending" };
  if (status === "failed") return { tone: "gray", label: "Failed" };
  if (status === "canceled") return { tone: "gray", label: "Canceled" };
  if (status === "refunded") return { tone: "blue", label: "Refunded" };
  if (status === "partially_refunded")
    return { tone: "blue", label: "Partial refund" };
  if (status === "disputed") return { tone: "gray", label: "Disputed" };
  return { tone: "gray", label: status };
}

// ── Record manual payment modal ─────────────────────────────────────────
function RecordManualPaymentModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    relatedEntityType: "draw_request",
    relatedEntityId: "",
    paymentMethodType: "check" as "check" | "wire" | "other",
    grossAmount: "",
    externalReference: "",
    note: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const grossCents = Math.round(parseFloat(form.grossAmount) * 100);
    if (!Number.isFinite(grossCents) || grossCents <= 0) {
      setError("Enter a valid amount greater than $0.");
      setSubmitting(false);
      return;
    }
    const res = await fetch("/api/payments/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: form.projectId.trim(),
        relatedEntityType: form.relatedEntityType,
        relatedEntityId: form.relatedEntityId.trim(),
        paymentMethodType: form.paymentMethodType,
        grossAmountCents: grossCents,
        externalReference: form.externalReference.trim() || null,
        note: form.note.trim() || null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "record_failed");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,23,20,.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 520,
          background: C.surface1,
          borderRadius: 18,
          border: `1px solid ${C.surface3}`,
          boxShadow: "0 20px 60px rgba(26,23,20,.2)",
          padding: 24,
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: F.display,
              fontSize: 18,
              fontWeight: 740,
              letterSpacing: "-.015em",
              margin: 0,
            }}
          >
            Record manual payment
          </h3>
          <p
            style={{
              fontSize: 12.5,
              color: C.textSecondary,
              marginTop: 4,
              fontWeight: 520,
            }}
          >
            Log a check, wire, or other offline payment for tracking. This does
            not charge any card or bank account.
          </p>
        </div>

        <FormField label="Project ID">
          <input
            required
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            placeholder="uuid"
            style={modalInputStyle()}
          />
        </FormField>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Related entity type">
            <select
              value={form.relatedEntityType}
              onChange={(e) =>
                setForm({ ...form, relatedEntityType: e.target.value })
              }
              style={modalInputStyle()}
            >
              <option value="draw_request">Draw request</option>
              <option value="change_order">Change order</option>
              <option value="selection_decision">Selection decision</option>
              <option value="retainage_release">Retainage release</option>
            </select>
          </FormField>
          <FormField label="Related entity ID">
            <input
              required
              value={form.relatedEntityId}
              onChange={(e) =>
                setForm({ ...form, relatedEntityId: e.target.value })
              }
              placeholder="uuid"
              style={modalInputStyle()}
            />
          </FormField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Method">
            <select
              value={form.paymentMethodType}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentMethodType: e.target
                    .value as "check" | "wire" | "other",
                })
              }
              style={modalInputStyle()}
            >
              <option value="check">Check</option>
              <option value="wire">Wire</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label="Amount">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.grossAmount}
              onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
              placeholder="0.00"
              style={modalInputStyle()}
            />
          </FormField>
        </div>

        <FormField label="Reference (optional)">
          <input
            value={form.externalReference}
            onChange={(e) =>
              setForm({ ...form, externalReference: e.target.value })
            }
            placeholder="Check # / wire confirmation"
            style={modalInputStyle()}
          />
        </FormField>
        <FormField label="Note (optional)">
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            rows={2}
            style={{ ...modalInputStyle(), resize: "vertical", height: "auto" }}
          />
        </FormField>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: C.dangerText,
              fontWeight: 520,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={smBtnStyle(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={btnPrimary(!submitting)}
          >
            {submitting ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontFamily: F.display,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          color: C.textTertiary,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function modalInputStyle(): CSSProperties {
  return {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: `1px solid ${C.surface3}`,
    background: C.surface1,
    color: C.textPrimary,
    fontFamily: F.body,
    fontSize: 13,
    fontWeight: 520,
    outline: "none",
    width: "100%",
  };
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatMoney(cents: number, currency: string = "USD"): string {
  const symbol =
    currency === "USD" ? "$" : currency === "CAD" ? "CA$" : currency + " ";
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${symbol}${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percent(fee: number, gross: number): string {
  if (gross <= 0) return "0%";
  return `${((fee / gross) * 100).toFixed(2)}%`;
}

function formatDate(d: Date | null, nowMs: number): string {
  if (!d) return "—";
  const date = new Date(d);
  const mins = Math.round((nowMs - date.getTime()) / 60000);
  if (mins < 60 * 24) return "Today";
  if (mins < 60 * 48) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function smBtnStyle(danger: boolean): CSSProperties {
  return {
    height: 30,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${danger ? C.danger : C.surface3}`,
    background: C.surface1,
    color: danger ? C.dangerText : C.textPrimary,
    fontFamily: F.display,
    fontSize: 12,
    fontWeight: 620,
    cursor: "pointer",
  };
}

function smBtnLinkStyle(danger: boolean): CSSProperties {
  return {
    ...smBtnStyle(danger),
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
  };
}

function btnPrimary(enabled: boolean): CSSProperties {
  return {
    height: 34,
    padding: "0 14px",
    borderRadius: 10,
    background: enabled ? C.accent : C.accentMuted,
    color: "white",
    border: "none",
    fontFamily: F.display,
    fontSize: 12.5,
    fontWeight: 650,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function pillStyle(
  tone: "purple" | "green" | "orange" | "gray" | "blue",
): CSSProperties {
  const map: Record<typeof tone, { bg: string; color: string; border: string }> =
    {
      purple: { bg: C.accentSoft, color: C.accentText, border: C.accentMuted },
      green: { bg: C.successSoft, color: C.successText, border: C.success },
      orange: { bg: C.warningSoft, color: C.warningText, border: C.warning },
      gray: { bg: C.surface2, color: C.textTertiary, border: C.surface3 },
      blue: { bg: C.infoSoft, color: C.infoText, border: C.info },
    };
  const s = map[tone];
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    fontFamily: F.display,
    background: s.bg,
    color: s.color,
    border: `1px solid ${s.border}`,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    whiteSpace: "nowrap",
  };
}
