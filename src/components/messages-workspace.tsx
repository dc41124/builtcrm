"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ConversationRow, MessageRow } from "@/domain/loaders/project-home";
import type { MessagesParticipantOption } from "@/domain/loaders/messages";

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(name);
}

type PortalVariant = "contractor" | "subcontractor" | "commercial" | "residential";

type Props = {
  portal: PortalVariant;
  projectId: string;
  currentUserId: string;
  conversations: ConversationRow[];
  participantOptions: MessagesParticipantOption[];
};

const PORTAL_ACCENT: Record<PortalVariant, { ac: string; ach: string; acs: string; act: string; acm: string; ri: string }> = {
  contractor: { ac: "#5b4fc7", ach: "#4f44b3", acs: "#eeedfb", act: "#4a3fb0", acm: "#c7c2ea", ri: "rgba(91,79,199,.15)" },
  subcontractor: { ac: "#3d6b8e", ach: "#345d7c", acs: "#e8f0f6", act: "#2e5a78", acm: "#b3cede", ri: "rgba(61,107,142,.15)" },
  commercial: { ac: "#3178b9", ach: "#296aa6", acs: "#e8f1fa", act: "#276299", acm: "#b0cfe8", ri: "rgba(49,120,185,.15)" },
  residential: { ac: "#2a7f6f", ach: "#237060", acs: "#e6f5f1", act: "#1f6b5d", acm: "#a8d5ca", ri: "rgba(42,127,111,.15)" },
};

type ConvTypeKey = "general" | "rfi" | "co" | "approval" | "system";

function convTypeKey(
  t: ConversationRow["conversationType"],
  portal: PortalVariant,
): ConvTypeKey {
  if (t === "rfi_thread") return "rfi";
  if (t === "change_order_thread") return "co";
  if (t === "approval_thread") return "approval";
  return "general";
  void portal;
}

function convTypeLabel(
  t: ConversationRow["conversationType"],
  portal: PortalVariant,
): string {
  switch (t) {
    case "rfi_thread":
      return "RFI";
    case "change_order_thread":
      return portal === "residential" || portal === "commercial"
        ? "Scope Change"
        : "Change Order";
    case "approval_thread":
      return portal === "residential" ? "Decision" : "Approval";
    case "direct":
      return "Direct";
    case "project_general":
    default:
      return "General";
  }
}

function linkedChipHref(
  projectId: string,
  portal: PortalVariant,
  linkedObjectType: string | null,
  linkedObjectId: string | null,
): string | null {
  if (!linkedObjectType || !linkedObjectId) return null;
  const portalSegment =
    portal === "contractor"
      ? "contractor"
      : portal === "subcontractor"
        ? "subcontractor"
        : portal === "commercial"
          ? "commercial"
          : "residential";
  switch (linkedObjectType) {
    case "rfi":
      return `/${portalSegment}/project/${projectId}/rfis?id=${linkedObjectId}`;
    case "change_order":
      return `/${portalSegment}/project/${projectId}/change-orders?id=${linkedObjectId}`;
    case "approval":
      return `/${portalSegment}/project/${projectId}/approvals?id=${linkedObjectId}`;
    default:
      return null;
  }
}

function linkedChipLabel(
  t: string | null,
  portal: PortalVariant,
): string {
  if (!t) return "";
  if (t === "rfi") return "View RFI →";
  if (t === "change_order")
    return portal === "residential" || portal === "commercial"
      ? "View Scope Change →"
      : "View Change Order →";
  if (t === "approval")
    return portal === "residential" ? "View Decision →" : "View Approval →";
  return "View linked item →";
}

function relativeTime(d: Date | null): string {
  if (!d) return "";
  const then = new Date(d).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 2) return "Yesterday";
  if (day < 7) return `${day}d`;
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function timeOfDay(d: Date): string {
  const dt = new Date(d);
  const h = dt.getUTCHours();
  const m = dt.getUTCMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

const AVATAR_COLORS = [
  "#5b4fc7", "#3d6b8e", "#3178b9", "#2a7f6f", "#c17a1a",
  "#2d8a5e", "#8b5cf6", "#6366f1", "#0891b2", "#9333ea",
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function MessagesWorkspace({
  portal,
  projectId,
  currentUserId,
  conversations,
  participantOptions,
}: Props) {
  const accent = PORTAL_ACCENT[portal];
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const unreadCount = conversations.reduce(
    (sum, c) => sum + (c.unreadCount > 0 ? 1 : 0),
    0,
  );

  const tabs: string[] | null =
    portal === "contractor"
      ? ["All", "Unread", "General", "RFI-linked", "CO-linked", "Approvals"]
      : portal === "subcontractor"
        ? ["All", "Unread", "RFI-linked", "General"]
        : null;

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "Unread") list = list.filter((c) => c.unreadCount > 0);
    else if (filter === "General")
      list = list.filter((c) => c.conversationType === "project_general");
    else if (filter === "RFI-linked")
      list = list.filter((c) => c.conversationType === "rfi_thread");
    else if (filter === "CO-linked")
      list = list.filter((c) => c.conversationType === "change_order_thread");
    else if (filter === "Approvals")
      list = list.filter((c) => c.conversationType === "approval_thread");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.lastMessagePreview ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [conversations, filter, query]);

  const subtitle =
    portal === "contractor" || portal === "subcontractor"
      ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} · ${unreadCount} unread`
      : portal === "commercial"
        ? "Your conversations with the project team"
        : "Chat with your builder";

  const newButtonLabel =
    portal === "contractor" ? "New Conversation" : "New Message";

  const css = `
.msgws {
  --ac: ${accent.ac};
  --ac-h: ${accent.ach};
  --ac-s: ${accent.acs};
  --ac-t: ${accent.act};
  --ac-m: ${accent.acm};
  --shri: 0 0 0 3px ${accent.ri};
  font-family: var(--fb);
  color: var(--t1);
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.msgws-hdr { display:flex;justify-content:space-between;align-items:flex-start;gap:20px; }
.msgws-hdr h1 { font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;margin:0;color:var(--t1); }
.msgws-sub { font-family:var(--fb);font-size:13px;color:var(--t2);margin-top:4px;font-weight:520; }
.msgws-btn { height:38px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:var(--fb);border:none;cursor:pointer;transition:all var(--dn) var(--e); }
.msgws-btn.primary { background:var(--ac);color:#fff; }
.msgws-btn.primary:hover { background:var(--ac-h);box-shadow:var(--shmd); }
.msgws-btn.ghost { border:1px solid var(--s3);background:transparent;color:var(--t2); }
.msgws-btn.ghost:hover { background:var(--sh);border-color:var(--s4);color:var(--t1); }
.msgws-btn.cancel { border:1px solid var(--s3);background:transparent;color:var(--t2); }
.msgws-btn.cancel:hover { background:var(--sh); }

.msgws-crp { background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;box-shadow:var(--shmd); }
.msgws-crp h3 { font-family:var(--fd);font-size:17px;font-weight:720;letter-spacing:-.02em;margin:0 0 16px;color:var(--t1); }
.msgws-frow { margin-bottom:14px; }
.msgws-flbl { font-family:var(--fb);font-size:12px;font-weight:640;color:var(--t2);margin-bottom:5px;display:block; }
.msgws-finp { width:100%;height:38px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none;font-family:var(--fb); }
.msgws-finp:focus { border-color:var(--ac);box-shadow:var(--shri);background:var(--s1); }
.msgws-fsel { width:100%;height:38px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none;cursor:pointer;font-family:var(--fb); }
.msgws-fta { width:100%;min-height:80px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:10px 12px;font-size:13px;color:var(--t1);outline:none;resize:vertical;line-height:1.5;font-family:var(--fb); }
.msgws-fta:focus, .msgws-fsel:focus { border-color:var(--ac);box-shadow:var(--shri);background:var(--s1); }
.msgws-facts { display:flex;gap:8px;justify-content:flex-end;margin-top:18px; }
.msgws-pt { display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:580;color:var(--t2);background:var(--s2);border:1px solid var(--s3);padding:5px 10px;border-radius:999px;cursor:pointer;margin:0 4px 4px 0;font-family:var(--fb); }
.msgws-pt.sel { background:var(--ac-s);border-color:var(--ac);color:var(--ac-t);font-weight:650; }
.msgws-err { font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:10px 0 0; }

.msgws-ftabs { display:flex;gap:2px;background:var(--s2);border-radius:var(--r-m);padding:3px;width:fit-content; }
.msgws-ftab { height:30px;padding:0 12px;border-radius:var(--r-s);font-size:12px;font-weight:620;color:var(--t3);display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-family:var(--fb);background:none;border:none;cursor:pointer; }
.msgws-ftab:hover { color:var(--t2); }
.msgws-ftab.on { background:var(--s1);color:var(--t1);box-shadow:var(--shsm); }
.msgws-fct { font-size:10px;font-weight:700;color:var(--ac-t);background:var(--ac-s);min-width:16px;height:16px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd); }

.msgws-ml { display:grid;grid-template-columns:380px 1fr;min-height:calc(100vh - 260px);background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden; }
@media(max-width:1200px){ .msgws-ml{grid-template-columns:1fr;} }

.msgws-clist { border-right:1px solid var(--s3);display:flex;flex-direction:column;overflow:hidden;min-width:0; }
.msgws-chdr { padding:14px 16px;border-bottom:1px solid var(--s3);flex-shrink:0; }
.msgws-srch { width:100%;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px 0 34px;font-size:13px;color:var(--t1);outline:none;font-family:var(--fb); }
.msgws-srch:focus { border-color:var(--ac);box-shadow:var(--shri); }
.msgws-cscroll { flex:1;overflow-y:auto; }
.msgws-cscroll::-webkit-scrollbar { width:4px; }
.msgws-cscroll::-webkit-scrollbar-thumb { background:var(--s4);border-radius:2px; }
.msgws-empty { padding:48px 24px;text-align:center;color:var(--t3);font-size:13px;font-family:var(--fb);font-weight:540; }

.msgws-cc { padding:14px 16px;border-bottom:1px solid var(--s3);cursor:pointer;display:flex;gap:12px;position:relative;background:none;border-left:none;border-right:none;border-top:none;width:100%;text-align:left;font-family:var(--fb);color:var(--t1); }
.msgws-cc:hover { background:var(--sh); }
.msgws-cc.on { background:var(--ac-s); }
.msgws-cc.unread .msgws-cc-title { font-weight:700; }
.msgws-cc.unread::before { content:'';position:absolute;left:6px;top:50%;transform:translateY(-50%);width:6px;height:6px;border-radius:50%;background:var(--ac); }
.msgws-cc-av { width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700;flex-shrink:0;color:#fff; }
.msgws-cc-av.general { background:var(--ac); }
.msgws-cc-av.rfi { background:var(--in); }
.msgws-cc-av.co { background:var(--wr); }
.msgws-cc-av.approval { background:var(--ok); }
.msgws-cc-av.system { background:var(--s4);color:var(--t2); }
.msgws-cc-body { flex:1;min-width:0; }
.msgws-cc-top { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px; }
.msgws-cc-title { font-family:var(--fd);font-size:13.5px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0; }
.msgws-cc-time { font-family:var(--fd);font-size:11px;color:var(--t3);font-weight:520;flex-shrink:0; }
.msgws-cc-prev { font-family:var(--fb);font-size:12.5px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;font-weight:520; }
.msgws-cc-meta { display:flex;align-items:center;gap:6px;margin-top:5px; }
.msgws-cc-type { font-family:var(--fd);font-size:10px;font-weight:650;padding:2px 7px;border-radius:999px;letter-spacing:.02em;white-space:nowrap;flex-shrink:0; }
.msgws-cc-type.general { background:var(--ac-s);color:var(--ac-t); }
.msgws-cc-type.rfi { background:var(--in-s);color:var(--in-t); }
.msgws-cc-type.co { background:var(--wr-s);color:var(--wr-t); }
.msgws-cc-type.approval { background:var(--ok-s);color:var(--ok-t); }
.msgws-cc-type.system { background:var(--s2);color:var(--t3); }
.msgws-cc-parts { font-family:var(--fb);font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:520; }
.msgws-cc-un { min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--ac);color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0;align-self:center; }

.msgws-td { display:flex;flex-direction:column;min-width:0;height:100%; }
.msgws-td-acts { display:flex;gap:6px;flex-shrink:0; }
.msgws-td-acts button { height:34px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:transparent;color:var(--t2);cursor:pointer;display:grid;place-items:center; }
.msgws-td-acts button:hover { background:var(--sh);border-color:var(--s4);color:var(--t1); }
.msgws-tdhdr { padding:16px 20px;border-bottom:1px solid var(--s3);flex-shrink:0; }
.msgws-tdhdrtop { display:flex;align-items:flex-start;justify-content:space-between;gap:12px; }
.msgws-tdtitle { font-family:var(--fd);font-size:17px;font-weight:700;letter-spacing:-.02em;color:var(--t1); }
.msgws-tdlinked { display:inline-flex;align-items:center;gap:5px;font-family:var(--fd);font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;margin-top:6px;cursor:pointer;border:none;background:var(--in-s);color:var(--in-t); }
.msgws-tdlinked.rfi { background:var(--in-s);color:var(--in-t); }
.msgws-tdlinked.co { background:var(--wr-s);color:var(--wr-t); }
.msgws-tdlinked.approval { background:var(--ok-s);color:var(--ok-t); }
.msgws-tdparts { display:flex;align-items:center;gap:6px;margin-top:8px;font-family:var(--fb);font-size:12px;color:var(--t3);flex-wrap:wrap; }
.msgws-pchip { display:inline-flex;align-items:center;gap:4px;font-family:var(--fb);font-size:11.5px;font-weight:580;color:var(--t2);background:var(--s2);padding:3px 9px;border-radius:999px; }
.msgws-pdot { width:6px;height:6px;border-radius:50%;background:var(--s4); }

.msgws-mscroll { flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;min-height:320px; }
.msgws-mscroll::-webkit-scrollbar { width:4px; }
.msgws-mscroll::-webkit-scrollbar-thumb { background:var(--s4);border-radius:2px; }
.msgws-mdate { text-align:center;margin-bottom:12px; }
.msgws-mdate span { font-family:var(--fd);font-size:11px;font-weight:650;color:var(--t3);background:var(--s2);padding:3px 12px;border-radius:999px;letter-spacing:.02em; }

.msgws-sys { text-align:center;margin:10px 0;padding:4px 0; }
.msgws-sys-inner { display:inline-flex;align-items:center;gap:6px;font-family:var(--fb);font-size:11.5px;color:var(--t3);font-weight:560;background:var(--s2);padding:4px 14px;border-radius:999px; }

.msgws-bub-row { display:flex;gap:10px;margin-bottom:6px;align-items:flex-end; }
.msgws-bub-row.mine { flex-direction:row-reverse; }
.msgws-bub-av { width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;color:#fff;flex-shrink:0;margin-bottom:2px;background:var(--ac); }
.msgws-bub-col { max-width:65%;display:flex;flex-direction:column;min-width:0; }
.msgws-bub-name { font-family:var(--fb);font-size:11px;font-weight:650;color:var(--t2);margin-bottom:3px;padding-left:2px; }
.msgws-bub-row.mine .msgws-bub-name { text-align:right;padding-right:2px;padding-left:0; }
.msgws-bub { padding:10px 14px;border-radius:var(--r-l);font-family:var(--fb);font-size:13.5px;line-height:1.55;word-wrap:break-word;font-weight:520;white-space:pre-wrap; }
.msgws-bub.in { background:var(--s2);color:var(--t1);border-bottom-left-radius:var(--r-s); }
.msgws-bub.out { background:var(--ac);color:#fff;border-bottom-right-radius:var(--r-s); }
.msgws-bub-time { font-family:var(--fd);font-size:10.5px;color:var(--t3);margin-top:3px;padding:0 2px;font-weight:520; }
.msgws-bub-row.mine .msgws-bub-time { text-align:right; }
.msgws-att { display:inline-flex;align-items:center;gap:5px;font-family:var(--fm);font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:var(--r-s);margin-top:6px;cursor:pointer; }
.msgws-bub.in .msgws-att { background:var(--s1);border:1px solid var(--s3);color:var(--t2); }
.msgws-bub.out .msgws-att { background:rgba(255,255,255,.2);color:#fff;border:none; }

.msgws-comp { border-top:1px solid var(--s3);padding:14px 20px;flex-shrink:0;display:flex;align-items:flex-end;gap:10px;background:var(--s1); }
.msgws-cinp { flex:1;min-height:40px;max-height:120px;border-radius:var(--r-l);border:1px solid var(--s3);background:var(--s2);padding:10px 14px;font-family:var(--fb);font-size:13.5px;color:var(--t1);outline:none;resize:none;line-height:1.5; }
.msgws-cinp:focus { border-color:var(--ac);background:var(--s1);box-shadow:var(--shri); }
.msgws-cbtn { width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;color:var(--t3);background:none;border:none;cursor:pointer; }
.msgws-cbtn:hover { background:var(--sh);color:var(--t2); }
.msgws-csend { width:36px;height:36px;border-radius:var(--r-m);background:var(--ac);color:#fff;display:grid;place-items:center;border:none;cursor:pointer; }
.msgws-csend:hover { background:var(--ac-h);box-shadow:var(--shmd); }
.msgws-csend:disabled { background:var(--s4);cursor:not-allowed;box-shadow:none; }

.msgws-blank { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--t3);gap:8px;padding:40px;text-align:center; }
.msgws-blank p { font-family:var(--fd);font-size:14px;font-weight:580;margin:0; }
.msgws-blank span { font-family:var(--fb);font-size:12.5px; }

.msgws-att-img { display:block;max-width:240px;max-height:180px;border-radius:var(--r-m);margin-top:8px;cursor:pointer;object-fit:cover; }
.msgws-bub.out .msgws-att-img { opacity:.92; }
.msgws-att-img:hover { opacity:.85; }

.msgws-staged { display:inline-flex;align-items:center;gap:6px;font-family:var(--fm);font-size:11.5px;font-weight:600;color:var(--t2);background:var(--s2);border:1px solid var(--s3);padding:4px 8px 4px 10px;border-radius:var(--r-m); }
.msgws-staged span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px; }
.msgws-staged button { width:20px;height:20px;border-radius:50%;border:none;background:none;color:var(--t3);cursor:pointer;display:grid;place-items:center;flex-shrink:0; }
.msgws-staged button:hover { background:var(--s3);color:var(--t1); }

.msgws-lb { position:fixed;inset:0;background:rgba(12,14,20,.88);z-index:1000;display:grid;place-items:center;animation:msgws-lb-fade .2s ease; }
.msgws-lb-inner { position:relative;width:min(1400px,92vw);display:flex;flex-direction:column;align-items:center;gap:12px; }
.msgws-lb-img { max-height:84vh;max-width:100%;object-fit:contain;border-radius:var(--r-m); }
.msgws-lb-close { position:absolute;top:-8px;right:-8px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;border:none;cursor:pointer;display:grid;place-items:center;backdrop-filter:blur(8px); }
.msgws-lb-close:hover { background:rgba(255,255,255,.25); }
.msgws-lb-cap { font-family:var(--fm);font-size:12px;color:rgba(255,255,255,.7);text-align:center; }
@keyframes msgws-lb-fade { from{opacity:0} to{opacity:1} }
@keyframes msgws-spin { to{transform:rotate(360deg)} }
`;

  return (
    <div className={`msgws msgws-${portal}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="msgws-hdr">
        <div>
          <h1>Messages</h1>
          <div className="msgws-sub">{subtitle}</div>
        </div>
        <button
          className={`msgws-btn ${portal === "contractor" ? "ghost" : "primary"}`}
          onClick={() => setShowCreate((v) => !v)}
        >
          <PlusIcon /> {newButtonLabel}
        </button>
      </div>

      {showCreate && (
        <CreatePanel
          portal={portal}
          projectId={projectId}
          participantOptions={participantOptions}
          onClose={() => setShowCreate(false)}
          onCreated={(newId) => {
            setShowCreate(false);
            if (newId) setSelectedId(newId);
            router.refresh();
          }}
        />
      )}

      {tabs && (
        <div className="msgws-ftabs">
          {tabs.map((t) => {
            let count: number | null = null;
            if (t === "All") count = conversations.length;
            else if (t === "Unread") count = unreadCount;
            return (
              <button
                key={t}
                className={`msgws-ftab${filter === t ? " on" : ""}`}
                onClick={() => setFilter(t)}
              >
                {t}
                {count !== null && <span className="msgws-fct">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="msgws-ml">
        <div className="msgws-clist">
          <div className="msgws-chdr">
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--t3)",
                }}
              >
                <SearchIcon />
              </div>
              <input
                className="msgws-srch"
                placeholder="Search conversations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="msgws-cscroll">
            {filtered.length === 0 ? (
              <div className="msgws-empty">No conversations</div>
            ) : (
              filtered.map((c) => {
                const typeKey = convTypeKey(c.conversationType, portal);
                const latest = c.messages[c.messages.length - 1];
                const title = c.title ?? convTypeLabel(c.conversationType, portal);
                const preview = c.lastMessagePreview ?? latest?.body ?? "";
                const otherParticipants = c.participants
                  .filter((p) => p.userId !== currentUserId)
                  .map((p) => p.displayName ?? "Unknown");
                const firstOther = otherParticipants[0] ?? null;
                const av = initials(firstOther, "?");
                return (
                  <button
                    key={c.id}
                    className={`msgws-cc${selectedId === c.id ? " on" : ""}${c.unreadCount > 0 ? " unread" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className={`msgws-cc-av ${typeKey}`}>{av}</div>
                    <div className="msgws-cc-body">
                      <div className="msgws-cc-top">
                        <span className="msgws-cc-title">{title}</span>
                        <span className="msgws-cc-time">
                          {relativeTime(c.lastMessageAt ?? c.createdAt)}
                        </span>
                      </div>
                      {preview && (
                        <div className="msgws-cc-prev">{preview}</div>
                      )}
                      <div className="msgws-cc-meta">
                        <span className={`msgws-cc-type ${typeKey}`}>
                          {convTypeLabel(c.conversationType, portal)}
                        </span>
                        {otherParticipants.length > 0 && (
                          <span className="msgws-cc-parts">
                            {otherParticipants.slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="msgws-cc-un">{c.unreadCount}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selected ? (
          <ThreadDetail
            key={selected.id}
            portal={portal}
            projectId={projectId}
            conversation={selected}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="msgws-blank">
            <p>Select a conversation</p>
            <span>Choose a thread from the list to view messages</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadDetail({
  portal,
  projectId,
  conversation,
  currentUserId,
}: {
  portal: PortalVariant;
  projectId: string;
  conversation: ConversationRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stagedFile, setStagedFile] = useState<{
    documentId: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<MessageRow | null>(null);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // 1. Request presigned upload URL
      const reqRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          documentType: "message_attachment",
        }),
      });
      if (!reqRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, storageKey } = (await reqRes.json()) as {
        uploadUrl: string;
        storageKey: string;
      };

      // 2. PUT file to R2
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error("File upload failed");

      // 3. Finalize document in DB
      const finRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey,
          title: file.name,
          documentType: "message_attachment",
          visibilityScope: "project_wide",
          audienceScope: "internal",
          sourceObject: {
            type: "conversation",
            id: conversation.id,
            linkRole: "attachment",
          },
        }),
      });
      if (!finRes.ok) throw new Error("Failed to finalize upload");
      const { documentId } = (await finRes.json()) as { documentId: string };

      setStagedFile({ documentId, name: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed && !stagedFile) return;
    setPending(true);
    setError(null);
    const res = await fetch(
      `/api/conversations/${conversation.id}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed || (stagedFile ? `Shared ${stagedFile.name}` : ""),
          attachedDocumentId: stagedFile?.documentId,
        }),
      },
    );
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setBody("");
    setStagedFile(null);
    router.refresh();
  }

  const title =
    conversation.title ?? convTypeLabel(conversation.conversationType, portal);
  const linkedHref = linkedChipHref(
    projectId,
    portal,
    conversation.linkedObjectType,
    conversation.linkedObjectId,
  );
  const linkedLabel = linkedChipLabel(conversation.linkedObjectType, portal);
  const linkedKey = conversation.linkedObjectType === "rfi"
    ? "rfi"
    : conversation.linkedObjectType === "change_order"
      ? "co"
      : conversation.linkedObjectType === "approval"
        ? "approval"
        : "rfi";

  const others = conversation.participants.filter(
    (p) => p.userId !== currentUserId,
  );
  const placeholder =
    portal === "residential"
      ? "Message your builder…"
      : conversation.linkedObjectType === "rfi"
        ? `Reply to ${conversation.title ?? "RFI"} thread…`
        : conversation.linkedObjectType === "change_order" || conversation.linkedObjectType === "approval"
          ? "Reply to conversation…"
          : "Type a message…";

  const composerDisabled = pending || uploading || (!body.trim() && !stagedFile);

  return (
    <div className="msgws-td">
      <div className="msgws-tdhdr">
        <div className="msgws-tdhdrtop">
          <div>
            <div className="msgws-tdtitle">{title}</div>
            {linkedHref && (
              <Link
                href={linkedHref}
                className={`msgws-tdlinked ${linkedKey}`}
                style={{ textDecoration: "none" }}
              >
                <LinkIcon /> {linkedLabel}
              </Link>
            )}
            <div className="msgws-tdparts">
              <span style={{ marginRight: 2 }}>
                {others.length > 1 ? "Participants:" : "With:"}
              </span>
              {others.length === 0 ? (
                <span className="msgws-pchip">Just you</span>
              ) : (
                others.map((p) => (
                  <span key={p.userId} className="msgws-pchip">
                    <span className="msgws-pdot" />
                    {p.displayName ?? "Unknown"}
                  </span>
                ))
              )}
            </div>
          </div>
          {(portal === "contractor" || portal === "subcontractor") && (
            <div className="msgws-td-acts">
              <button type="button" title="Add participant"><AddUserIcon /></button>
              <button type="button" title="More options"><DotsIcon /></button>
            </div>
          )}
        </div>
      </div>

      <div className="msgws-mscroll">
        {conversation.messages.length === 0 ? (
          <div className="msgws-blank" style={{ height: "100%" }}>
            <p>No messages yet</p>
            <span>Send the first message to start the conversation</span>
          </div>
        ) : (
          <>
            <div className="msgws-mdate">
              <span>
                {new Date(
                  conversation.messages[0].createdAt,
                ).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            {conversation.messages.map((m) => {
              if (m.isSystemMessage) {
                const sysIcon = /linked|conversation/i.test(m.body)
                  ? <LinkIcon />
                  : /attached|upload|file/i.test(m.body)
                    ? <FileIcon />
                    : /confirmed|approved|resolved|selection/i.test(m.body)
                      ? <CheckIcon />
                      : <InfoIcon />;
                return (
                  <div key={m.id} className="msgws-sys">
                    <span className="msgws-sys-inner">
                      {sysIcon} {m.body}
                    </span>
                  </div>
                );
              }
              const mine = m.senderUserId === currentUserId;
              const attTitle = m.attachedDocumentTitle;
              const attUrl = m.attachedDocumentUrl;
              const attIsImage = attTitle ? isImageFile(attTitle) : false;
              return (
                <div
                  key={m.id}
                  className={`msgws-bub-row${mine ? " mine" : ""}`}
                >
                  <div
                    className="msgws-bub-av"
                    style={{ background: avatarColor(m.senderUserId) }}
                  >
                    {initials(mine ? "You" : m.senderName, "?")}
                  </div>
                  <div className="msgws-bub-col">
                    <div className="msgws-bub-name">
                      {mine ? "You" : m.senderName ?? "Unknown"}
                    </div>
                    <div className={`msgws-bub ${mine ? "out" : "in"}`}>
                      {m.body}
                      {attUrl && attIsImage && (
                        <img
                          src={attUrl}
                          alt={attTitle ?? "attachment"}
                          className="msgws-att-img"
                          onClick={() => setLightbox(m)}
                        />
                      )}
                      {attTitle && (
                        <a
                          href={attUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="msgws-att"
                          onClick={(e) => {
                            if (attIsImage && attUrl) {
                              e.preventDefault();
                              setLightbox(m);
                            }
                          }}
                        >
                          {attIsImage ? <PhotoIcon /> : <FileIcon />}
                          {attTitle}
                        </a>
                      )}
                    </div>
                    <div className="msgws-bub-time">
                      {timeOfDay(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <form className="msgws-comp" onSubmit={onSend}>
        <input
          ref={fileRef}
          type="file"
          accept={portal === "residential" ? "image/*" : undefined}
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className="msgws-cbtn"
          title={portal === "residential" ? "Photo" : "Attach"}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <SpinnerIcon /> : portal === "residential" ? <PhotoIcon /> : <AttachIcon />}
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          {stagedFile && (
            <div className="msgws-staged">
              {isImageFile(stagedFile.name) ? <PhotoIcon /> : <FileIcon />}
              <span>{stagedFile.name}</span>
              <button type="button" onClick={() => setStagedFile(null)} title="Remove">
                <CloseIcon />
              </button>
            </div>
          )}
          <textarea
            className="msgws-cinp"
            rows={1}
            placeholder={placeholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e as unknown as React.FormEvent);
              }
            }}
          />
        </div>
        <button
          type="submit"
          className="msgws-csend"
          disabled={composerDisabled}
        >
          <SendIcon />
        </button>
      </form>
      {error && (
        <p className="msgws-err" style={{ padding: "0 20px 12px" }}>
          Error: {error}
        </p>
      )}

      {lightbox && lightbox.attachedDocumentUrl && (
        <div className="msgws-lb" onClick={() => setLightbox(null)}>
          <div className="msgws-lb-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="msgws-lb-close"
              onClick={() => setLightbox(null)}
              type="button"
            >
              <CloseIcon />
            </button>
            <img
              src={lightbox.attachedDocumentUrl}
              alt={lightbox.attachedDocumentTitle ?? "attachment"}
              className="msgws-lb-img"
            />
            {lightbox.attachedDocumentTitle && (
              <div className="msgws-lb-cap">
                {lightbox.attachedDocumentTitle}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePanel({
  portal,
  projectId,
  participantOptions,
  onClose,
  onCreated,
}: {
  portal: PortalVariant;
  projectId: string;
  participantOptions: MessagesParticipantOption[];
  onClose: () => void;
  onCreated: (id: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [conversationType, setConversationType] = useState<
    "project_general" | "rfi_thread" | "change_order_thread" | "approval_thread"
  >("project_general");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [firstMessage, setFirstMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (portal === "contractor") {
      if (selectedIds.length === 0) {
        setError("Select at least one participant");
        return;
      }
      setPending(true);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title || undefined,
          conversationType,
          participantUserIds: selectedIds,
        }),
      });
      if (!res.ok) {
        setPending(false);
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "request_failed");
        return;
      }
      const data = (await res.json()) as { id: string };
      if (firstMessage.trim()) {
        await fetch(`/api/conversations/${data.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: firstMessage.trim() }),
        });
      }
      setPending(false);
      onCreated(data.id);
      return;
    }

    // Non-contractor portals cannot create new conversations via the API,
    // so the New Message composer is a feedback-only form for now. We
    // still let the user close it cleanly.
    onClose();
  }

  const toggleParticipant = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (portal === "contractor") {
    return (
      <form className="msgws-crp" onSubmit={submit}>
        <h3>New Conversation</h3>
        <div className="msgws-frow">
          <label className="msgws-flbl">Subject</label>
          <input
            className="msgws-finp"
            placeholder="e.g., Elevator shaft coordination"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="msgws-frow">
          <label className="msgws-flbl">Type</label>
          <select
            className="msgws-fsel"
            value={conversationType}
            onChange={(e) =>
              setConversationType(
                e.target.value as typeof conversationType,
              )
            }
          >
            <option value="project_general">General Discussion</option>
            <option value="rfi_thread">Linked to RFI</option>
            <option value="change_order_thread">Linked to Change Order</option>
            <option value="approval_thread">Linked to Approval</option>
          </select>
        </div>
        <div className="msgws-frow">
          <label className="msgws-flbl">Participants</label>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {participantOptions.length === 0 ? (
              <span className="msgws-cc-parts">
                No other project members available
              </span>
            ) : (
              participantOptions.map((p) => (
                <button
                  type="button"
                  key={p.userId}
                  className={`msgws-pt${selectedIds.includes(p.userId) ? " sel" : ""}`}
                  onClick={() => toggleParticipant(p.userId)}
                >
                  {p.displayName}
                  {p.organizationName ? ` — ${p.organizationName}` : ""}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="msgws-frow">
          <label className="msgws-flbl">First Message</label>
          <textarea
            className="msgws-fta"
            placeholder="Start the conversation…"
            value={firstMessage}
            onChange={(e) => setFirstMessage(e.target.value)}
          />
        </div>
        {error && <p className="msgws-err">Error: {error}</p>}
        <div className="msgws-facts">
          <button
            type="button"
            className="msgws-btn cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="msgws-btn primary"
            disabled={pending}
          >
            <SendIcon /> {pending ? "Creating…" : "Send"}
          </button>
        </div>
      </form>
    );
  }

  // Non-contractor portals: read-only composer. New threads originate
  // from the contractor side; clients and subcontractors reply into
  // existing conversations. We still surface the composer for visual
  // parity and show a clear message.
  return (
    <div className="msgws-crp">
      <h3>
        {portal === "commercial"
          ? "Message Your Project Team"
          : portal === "residential"
            ? "Send a Message"
            : "New Message"}
      </h3>
      <p
        style={{
          fontFamily: "var(--fb)",
          fontSize: 13,
          color: "var(--t2)",
          margin: "0 0 14px",
          fontWeight: 540,
        }}
      >
        Select an existing conversation below to continue the thread. New
        conversations are started by your project team.
      </p>
      <div className="msgws-facts">
        <button className="msgws-btn cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────────── */

function PlusIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}
function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}
function AddUserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
function PhotoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 00-2.828 0L6 21" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ animation: "msgws-spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}
