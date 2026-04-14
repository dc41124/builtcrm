"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ConversationRow } from "@/domain/loaders/project-home";

type Props = {
  projectId: string;
  conversations: ConversationRow[];
  currentUserId: string;
  canCreate: boolean;
};

export function MessagesPanel({
  projectId,
  conversations,
  currentUserId,
  canCreate,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 16,
        border: "1px solid #ddd",
        borderRadius: 6,
        padding: 12,
      }}
    >
      <aside style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {canCreate && <CreateConversationForm projectId={projectId} />}
      </aside>
      <section>
        {selected ? (
          <MessageThread
            key={selected.id}
            conversation={selected}
            currentUserId={currentUserId}
          />
        ) : (
          <p>No conversation selected.</p>
        )}
      </section>
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return <p style={{ color: "#666", fontSize: 13 }}>No conversations yet.</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
      {conversations.map((c) => {
        const active = c.id === selectedId;
        const label =
          c.title ?? describeConversationType(c.conversationType);
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 8,
                borderRadius: 6,
                border: "1px solid",
                borderColor: active ? "#5b4fc7" : "#e5e5e5",
                background: active ? "#eeedfb" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 13 }}>{label}</strong>
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      background: "#5b4fc7",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 11,
                      padding: "0 6px",
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#777" }}>
                [{c.conversationType}]
                {c.linkedObjectType && <> · linked: {c.linkedObjectType}</>}
              </div>
              {c.lastMessagePreview && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#555",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.lastMessagePreview}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MessageThread({
  conversation,
  currentUserId,
}: {
  conversation: ConversationRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mark read when the thread opens if there is anything unread.
  useEffect(() => {
    if (conversation.unreadCount === 0) return;
    let cancelled = false;
    (async () => {
      await fetch(`/api/conversations/${conversation.id}/read`, {
        method: "POST",
      });
      if (!cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation.id, conversation.unreadCount, router]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <header>
        <strong>
          {conversation.title ??
            describeConversationType(conversation.conversationType)}
        </strong>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
          Participants:{" "}
          {conversation.participants
            .map((p) => p.displayName ?? p.userId.slice(0, 8))
            .join(", ")}
        </div>
        {conversation.linkedObjectType && conversation.linkedObjectId && (
          <div style={{ fontSize: 12, color: "#666" }}>
            Linked: {conversation.linkedObjectType}:{conversation.linkedObjectId}
          </div>
        )}
      </header>

      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: 360,
          overflowY: "auto",
          padding: 8,
          background: "#fafafa",
          borderRadius: 6,
        }}
      >
        {conversation.messages.length === 0 && (
          <p style={{ color: "#666", fontSize: 13 }}>No messages yet.</p>
        )}
        {conversation.messages.map((m) => {
          const mine = m.senderUserId === currentUserId;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                background: mine ? "#eeedfb" : "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: 6,
                padding: 8,
                maxWidth: "80%",
              }}
            >
              <div style={{ fontSize: 11, color: "#666" }}>
                {m.senderName ?? "Unknown"} ·{" "}
                {new Date(m.createdAt).toLocaleString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSend} style={{ display: "grid", gap: 6 }}>
        <textarea
          rows={2}
          placeholder="Write a message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div>
          <button type="submit" disabled={pending || !body.trim()}>
            {pending ? "Sending..." : "Send"}
          </button>
        </div>
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      </form>
    </div>
  );
}

function CreateConversationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [conversationType, setConversationType] = useState<
    "project_general" | "rfi_thread" | "change_order_thread" | "approval_thread" | "direct"
  >("project_general");
  const [participantIdsRaw, setParticipantIdsRaw] = useState("");
  const [linkedObjectType, setLinkedObjectType] = useState("");
  const [linkedObjectId, setLinkedObjectId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const participantUserIds = participantIdsRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (participantUserIds.length === 0) {
      setError("Enter at least one participant user id");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: title || undefined,
        conversationType,
        participantUserIds,
        linkedObjectType: linkedObjectType || undefined,
        linkedObjectId: linkedObjectId || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setTitle("");
    setParticipantIdsRaw("");
    setLinkedObjectType("");
    setLinkedObjectId("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 6, marginTop: 16 }}>
      <h4 style={{ margin: 0 }}>New conversation</h4>
      <input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select
        value={conversationType}
        onChange={(e) =>
          setConversationType(e.target.value as typeof conversationType)
        }
      >
        <option value="project_general">General</option>
        <option value="rfi_thread">RFI thread</option>
        <option value="change_order_thread">Change order thread</option>
        <option value="approval_thread">Approval thread</option>
        <option value="direct">Direct</option>
      </select>
      <input
        placeholder="Participant user IDs (comma separated)"
        value={participantIdsRaw}
        onChange={(e) => setParticipantIdsRaw(e.target.value)}
      />
      <input
        placeholder="Linked object type (e.g. rfi)"
        value={linkedObjectType}
        onChange={(e) => setLinkedObjectType(e.target.value)}
      />
      <input
        placeholder="Linked object id (uuid)"
        value={linkedObjectId}
        onChange={(e) => setLinkedObjectId(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create conversation"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}

function describeConversationType(t: ConversationRow["conversationType"]): string {
  switch (t) {
    case "project_general":
      return "General";
    case "rfi_thread":
      return "RFI thread";
    case "change_order_thread":
      return "Change order thread";
    case "approval_thread":
      return "Approval thread";
    case "direct":
      return "Direct";
  }
}
