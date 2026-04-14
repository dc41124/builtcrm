# Step 17 — Messages: handoff note

## What shipped

Minimal messaging system wired into all three project portal pages.

### New files
- `src/app/api/conversations/route.ts` — POST create conversation (contractor-only).
- `src/app/api/conversations/[id]/messages/route.ts` — POST send message (participant-only).
- `src/app/api/conversations/[id]/read/route.ts` — POST mark conversation read.
- `src/components/messages-ui.tsx` — shared client component: conversation list, thread, send form, create form.

### Modified files
- `src/domain/loaders/project-home.ts` — added `loadConversationsForUser` helper, `ConversationRow` / `MessageRow` / `ConversationParticipantRow` types, and wired `conversations` into `ContractorProjectView`, `SubcontractorProjectView`, `ClientProjectView`.
- `src/app/(portal)/contractor/project/[projectId]/page.tsx` — renders `<MessagesPanel canCreate />`.
- `src/app/(portal)/client/project/[projectId]/page.tsx` — renders `<MessagesPanel canCreate={false} />`.
- `src/app/(portal)/subcontractor/project/[projectId]/page.tsx` — renders `<MessagesPanel canCreate={false} />`.

### Design rules applied
- Schema was already in place in `src/db/schema/messaging.ts` (`conversations`, `conversation_participants`, `messages`). No schema change needed, so no migration — but run `db:push` (or whatever the project's dev-db-sync command is) to make sure the three tables and the `conversation_type` enum exist in the local DB. Seed data has none of them yet.
- Authorization: contractor_admin/contractor_pm can create conversations. Anyone with an active project membership who is added as a participant can read/send. Participant gate is enforced in the send-message and mark-read routes by checking `conversation_participants` (not just project membership).
- Create route requires every participant to be an active `project_user_memberships` row. **Known limitation:** contractor staff who access a project via the `contractor_org_staff` fallback (no explicit membership row) cannot currently be added as participants — the creator is always added, but other contractor staff must have a project_user_membership. If this bites during testing, extend the participant-check to also accept role_assignments rows for the contractor org.
- Audit events: `conversation.created` and `message.sent`. No activity-feed entries (messages are not approval-worthy).
- Loader computes `unreadCount` in JS from each user's own `lastReadAt` marker vs message `createdAt`, excluding messages the user sent themselves.
- Send-message handler updates `lastMessageAt`, `lastMessagePreview` (first 255 chars), and increments `messageCount` inside the same transaction. Also bumps the sender's `lastReadAt` so they don't show unread for their own message.

## Verification status

- TypeScript: `npx tsc --noEmit` is clean for all messaging-related files. One pre-existing unrelated error remains in `scripts/list-ids.ts(13,22)` (`p.projectCode` possibly null) — not introduced by this step, leave for later cleanup.
- Not yet tested in a browser. The dev server was not started. Pending manual test flow for the next session:
  1. Log in as a contractor on a project that has at least one subcontractor and one client with active project_user_memberships.
  2. Go to the contractor project page, scroll to "Messages", click "New conversation", paste in a participant user id (you can grab one from the DB or `scripts/list-ids.ts`), submit.
  3. Log in as that participant in another browser / incognito, open the same project — conversation should appear with unread badge.
  4. Send a message from each side; confirm unread badge clears on open and appears on the other side after a refresh.
  5. Verify audit_events rows for `conversation.created` and `message.sent`.

## Deferred (explicitly out of scope for this slice)

- Attachments: the schema supports `attached_document_id` and the send-message route accepts it, but the UI does not render attachments or provide a picker. Add when Step 18 (Documents) lands — the file browser will give us a natural place to pick a document to attach.
- Message editing / deletion.
- Beyond-participant visibility (`visibility_scope` beyond `participants_only`).
- Linked-object "jump to source" nav — the linkedObjectType/Id are stored and displayed as text, but there is no link.
- Auto-creating conversations from RFI/CO/Approval workflows (the `rfi_thread`, `change_order_thread`, `approval_thread` types exist but are only usable by manual creation for now).
- Email / push notification fan-out.
- New-conversation UI uses raw user-id text input. Real picker comes later with the team/participants UI.

## Suggested next step

Step 18 — Documents (read `docs/design/documents_file_management_shared.html`). After Documents ships, circle back and wire the attached-document picker into `messages-ui.tsx`.
