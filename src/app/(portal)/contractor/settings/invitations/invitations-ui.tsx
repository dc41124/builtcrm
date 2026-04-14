"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = { id: string; name: string; projectCode: string | null };
type Invitation = {
  id: string;
  invitedEmail: string;
  invitedName: string | null;
  portalType: string;
  roleKey: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  projectId: string | null;
  projectName: string | null;
  token: string;
};

type PortalType = "contractor" | "subcontractor" | "client";
type ClientSubtype = "commercial" | "residential";

const ROLE_PRESETS: Record<PortalType, { value: string; label: string }[]> = {
  contractor: [
    { value: "contractor_pm", label: "Project manager" },
    { value: "contractor_admin", label: "Admin / owner" },
  ],
  subcontractor: [{ value: "subcontractor_lead", label: "Subcontractor lead" }],
  client: [
    { value: "client_approver", label: "Project approver" },
    { value: "client_viewer", label: "Read-only viewer" },
  ],
};

export function InvitationsView({
  organizationName,
  projects,
  invitations,
}: {
  organizationName: string;
  projects: Project[];
  invitations: Invitation[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [portalType, setPortalType] = useState<PortalType>("client");
  const [clientSubtype, setClientSubtype] = useState<ClientSubtype>("commercial");
  const [roleKey, setRoleKey] = useState<string>(ROLE_PRESETS.client[0].value);
  const [projectId, setProjectId] = useState<string>("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  function onPortalChange(next: PortalType) {
    setPortalType(next);
    setRoleKey(ROLE_PRESETS[next][0].value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setLastInviteUrl(null);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitedEmail: email,
        invitedName: name || undefined,
        portalType,
        clientSubtype: portalType === "client" ? clientSubtype : undefined,
        roleKey,
        projectId: projectId || undefined,
        personalMessage: personalMessage || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? data.error ?? "Could not send invitation");
      return;
    }
    const data = await res.json();
    setLastInviteUrl(data.inviteUrl);
    setEmail("");
    setName("");
    setPersonalMessage("");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <h2 style={{ margin: 0 }}>Settings · Invitations</h2>
        <p style={{ color: "#6b655b", marginTop: 4 }}>
          Invite collaborators to {organizationName}. Each invitation creates
          a unique link that expires in 14 days.
        </p>
      </header>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e5e9",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Send a new invitation</h3>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          {error ? (
            <div
              style={{
                background: "#fdeaea",
                color: "#a52e2e",
                padding: 10,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
          {lastInviteUrl ? (
            <div
              style={{
                background: "#edf7f1",
                color: "#1e6b46",
                padding: 10,
                borderRadius: 8,
                fontSize: 13,
                wordBreak: "break-all",
              }}
            >
              Invitation created. Share this link:{" "}
              <a href={lastInviteUrl}>{lastInviteUrl}</a>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Portal">
              <select
                value={portalType}
                onChange={(e) => onPortalChange(e.target.value as PortalType)}
                style={inputStyle}
              >
                <option value="contractor">Contractor</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="client">Client</option>
              </select>
            </Field>
            <Field label="Role">
              <select
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
                style={inputStyle}
              >
                {ROLE_PRESETS[portalType].map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {portalType === "client" ? (
            <Field label="Client type">
              <select
                value={clientSubtype}
                onChange={(e) => setClientSubtype(e.target.value as ClientSubtype)}
                style={inputStyle}
              >
                <option value="commercial">Commercial</option>
                <option value="residential">Residential</option>
              </select>
            </Field>
          ) : null}

          <Field label="Project (optional)">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Organization-wide —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode ? `${p.projectCode} — ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Personal message (optional)">
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={3}
              style={{ ...inputStyle, height: "auto", padding: 10 }}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            style={{
              justifySelf: "start",
              background: "#5b4fc7",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 650,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      <section>
        <h3>Sent invitations</h3>
        {invitations.length === 0 ? (
          <p style={{ color: "#6b655b" }}>No invitations sent yet.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              border: "1px solid #e2e5e9",
              borderRadius: 10,
              overflow: "hidden",
              fontSize: 13,
            }}
          >
            <thead style={{ background: "#f3f4f6", textAlign: "left" }}>
              <tr>
                <Th>Email</Th>
                <Th>Portal / role</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Expires</Th>
                <Th>Link</Th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} style={{ borderTop: "1px solid #e2e5e9" }}>
                  <Td>{inv.invitedEmail}</Td>
                  <Td>
                    {inv.portalType} · {inv.roleKey}
                  </Td>
                  <Td>{inv.projectName ?? "—"}</Td>
                  <Td>
                    <StatusPill status={inv.status} />
                  </Td>
                  <Td>{new Date(inv.expiresAt).toLocaleDateString()}</Td>
                  <Td>
                    {inv.status === "pending" ? (
                      <a href={`/invite/${inv.token}`}>Open</a>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  border: "1px solid #e2e5e9",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
      <span style={{ display: "block", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "10px 12px", fontWeight: 650, fontSize: 12, color: "#6b655b" }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 12px" }}>{children}</td>;
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#fdf4e6", fg: "#96600f" },
    accepted: { bg: "#edf7f1", fg: "#1e6b46" },
    expired: { bg: "#f3f4f6", fg: "#6b655b" },
    revoked: { bg: "#fdeaea", fg: "#a52e2e" },
  };
  const p = palette[status] ?? palette.expired;
  return (
    <span
      style={{
        background: p.bg,
        color: p.fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 650,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}
