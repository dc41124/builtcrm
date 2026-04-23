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

  const pillColor = (status: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      pending: { bg: "var(--wr-s)", fg: "var(--wr-t)" },
      accepted: { bg: "var(--ok-s)", fg: "var(--ok-t)" },
      expired: { bg: "var(--s2)", fg: "var(--t2)" },
      revoked: { bg: "var(--dg-s)", fg: "var(--dg-t)" },
    };
    return map[status] ?? map.expired;
  };

  return (
    <div className="inv">
      

      <header>
        <h2>Invitations</h2>
        <p className="inv-sub">
          Invite collaborators to {organizationName}. Each invitation creates a
          unique link that expires in 14 days.
        </p>
      </header>

      <section className="inv-card">
        <h3>Send a new invitation</h3>
        <form onSubmit={onSubmit} className="inv-form">
          {error && <div className="inv-alert error">{error}</div>}
          {lastInviteUrl && (
            <div className="inv-alert success">
              Invitation created. Share this link:{" "}
              <a href={lastInviteUrl}>{lastInviteUrl}</a>
            </div>
          )}

          <div className="inv-row">
            <div className="inv-field">
              <label className="inv-label">Email</label>
              <input
                className="inv-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Name (optional)</label>
              <input
                className="inv-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="inv-row">
            <div className="inv-field">
              <label className="inv-label">Portal</label>
              <select
                className="inv-input"
                value={portalType}
                onChange={(e) => onPortalChange(e.target.value as PortalType)}
              >
                <option value="contractor">Contractor</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div className="inv-field">
              <label className="inv-label">Role</label>
              <select
                className="inv-input"
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value)}
              >
                {ROLE_PRESETS[portalType].map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {portalType === "client" && (
            <div className="inv-field">
              <label className="inv-label">Client type</label>
              <select
                className="inv-input"
                value={clientSubtype}
                onChange={(e) => setClientSubtype(e.target.value as ClientSubtype)}
              >
                <option value="commercial">Commercial</option>
                <option value="residential">Residential</option>
              </select>
            </div>
          )}

          <div className="inv-field">
            <label className="inv-label">Project (optional)</label>
            <select
              className="inv-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— Organization-wide —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode ? `${p.projectCode} — ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-field">
            <label className="inv-label">Personal message (optional)</label>
            <textarea
              className="inv-input inv-ta"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={3}
            />
          </div>

          <button type="submit" className="inv-submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ fontFamily: "var(--fd)", fontSize: 15, fontWeight: 720, marginBottom: 12 }}>
          Sent invitations
        </h3>
        {invitations.length === 0 ? (
          <p className="inv-empty">No invitations sent yet.</p>
        ) : (
          <table className="inv-tbl">
            <thead>
              <tr>
                <th>Email</th>
                <th>Portal / role</th>
                <th>Project</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const pc = pillColor(inv.status);
                return (
                  <tr key={inv.id}>
                    <td>{inv.invitedEmail}</td>
                    <td>{inv.portalType} · {inv.roleKey}</td>
                    <td>{inv.projectName ?? "—"}</td>
                    <td>
                      <span className="inv-pill" style={{ background: pc.bg, color: pc.fg }}>
                        {inv.status}
                      </span>
                    </td>
                    <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
