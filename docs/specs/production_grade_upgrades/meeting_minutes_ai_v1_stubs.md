# Meeting Minutes AI: V1 Stubs to Productionize

**Surfaced during:** Step 56 (Meeting Minutes AI), 2026-05-01.
**Status:** Stubs shipping with Step 56; production gaps noted.

---

This spec catalogs the deliberate approximations in Step 56 v1. None
blocks the v1 demo (one polished AI agent, end-to-end). Promote in the
order below if real customers ever appear.

---

## 1. Live in-browser recording

### Current approximation
Upload-only. The "Generate from audio" affordance is a hidden file
input that accepts MP3, WAV, M4A, WebM, OGG. Step 56 explicitly
deferred MediaRecorder per the require-design-input proposal — the
upload path covered the demo end-to-end without burning bandwidth on
a flow we couldn't test without a real meeting.

### Production gap
"Tap a button mid-meeting and let it record" is the natural mobile
ergonomic. Step 55 already wired Web Speech API for short dictation
on the Quick RFI FAB; the Meeting Minutes flow wants something
sturdier (long, multi-speaker, silence-tolerant).

### Target design
- New `MediaRecorder`-backed component that captures `audio/webm`
  blobs (universally supported), shows a live timer, and uploads on
  stop.
- Re-uses the same R2 presign + Trigger.dev path the upload flow uses
  — only the producer side changes.
- Pause/resume support for "step out for a phone call" mid-meeting.
- Soft cap warning at 1h, hard stop at 2h matches the upload-side
  guardrails.

### Why deferred
Mobile-record UX needs a real meeting to validate (battery behavior,
backgrounding, accidental stops). Adding it without that feedback is
guesswork.

---

## 2. Tests for AI surface (Whisper wrapper, Claude wrapper, API routes)

### Current approximation
Step 56 ships with zero new tests. The existing 202 tests still pass
end-to-end and the build/lint are clean, but the new code paths
(`src/lib/ai/*`, `src/jobs/meeting-minutes-ai.ts`, the three AI API
routes under `src/app/api/meetings/[id]/minutes/ai/`) are validated
only by manual smoke testing.

### Production gap
Per the project's Definition of Done (Phase 4+ build guide):

> 8. Any new API route has basic authorization tests (role-based —
> deny the wrong portal, deny the wrong org)

The three AI routes (`/upload`, `/transcribe`, `/status`) need:
- Sub portal denied (only contractor_admin / contractor_pm allowed)
- Wrong-org member denied
- Already-finalized minutes return 409
- Audio missing from R2 returns 400 from `/transcribe`

The Claude extraction wrapper is also worth pinning with a fixture
test that asserts the JSON shape conforms to the schema and that
hallucinated userIds get sanitized to null.

### Target design
- Add `tests/api/meetings-minutes-ai.test.ts` with role/org gating.
- Add `tests/lib/ai/extract-minutes.test.ts` that mocks the Anthropic
  SDK with a canned response and asserts roster validation logic.
- Mock OpenAI + Anthropic at the SDK level (`vi.mock`) — no live API
  calls in CI.

### Why deferred
Step 56 was explicitly scoped as "ship one AI agent well, in the
demo this is the wow moment." Time was spent on the end-to-end UX,
not the test pyramid. Promote before shipping to a real customer.

---

## 3. Server-side transcript retention

### Current approximation
Whisper's raw transcript is read into memory, passed straight to
Claude, then garbage-collected. Only Claude's reformatted minutes
land in `meeting_minutes.content`. The raw transcript is lost.

### Production gap
- **Audit:** "Why does the action item say X?" can't be answered
  without the transcript.
- **Re-extraction:** if the prompt or model improves, you can't
  re-run extraction without re-transcribing (= re-paying Whisper).
- **Compliance / discovery:** regulated industries may require the
  source recording or transcript to be retained for N years.

### Target design
- New `meeting_transcripts` table: `meetingId` (FK, unique),
  `transcriptText`, `whisperDurationSeconds`, `language` (Whisper
  auto-detects), `createdAt`. Org-scoped RLS via the `meetings` →
  `projects` chain (same template as `meeting_minutes`).
- Task writes the row alongside `meeting_minutes` updates.
- Add a "Re-extract action items" button on the Minutes tab that
  re-runs Claude against the saved transcript without re-uploading.

### Why deferred
Schema change (universal stop-and-ask trigger) and not needed for
the demo flow. Easy bolt-on when retention requirements crystallize.

---

## 4. Hard duration cap inside the Trigger.dev task

### Current approximation
The browser reads HTML5 `<audio>` metadata pre-upload and refuses
files over 2h. The API route enforces a 200MB byte cap. The task
itself does NOT abort on Whisper-reported duration — it always
proceeds to Claude.

### Production gap
If the browser's metadata read fails (some MP4/M4A containers in
some browsers), a 4-hour file could slip through, get transcribed
($1.44 in Whisper costs), then hit Claude with a massive context.

### Target design
Inside `src/jobs/meeting-minutes-ai.ts`, after `transcribeAudio`
returns:

```ts
if (whisper.durationSeconds > WHISPER_HARD_CAP_SECONDS) {
  await dbAdmin.insert(aiUsage).values({
    /* error row */
    errorMessage: `Audio exceeded hard cap: ${whisper.durationSeconds}s > ${WHISPER_HARD_CAP_SECONDS}s`,
  });
  throw new Error("Audio exceeded hard cap");
}
```

Whisper has already been paid at this point, but Claude (the more
expensive call) is averted.

### Why deferred
Browser metadata read works on the formats the upload route accepts
(MP3, WAV, M4A, WebM, OGG) in Chrome/Firefox/Safari. The hole only
opens for malformed files, which is also why the API route's byte
cap is a reasonable backstop.

---

## 5. Per-org cost dashboard + hard monthly cutoff

### Current approximation
`ai_usage` rows are written for every Whisper + Claude call, but
nothing surfaces the spend. No "you've used $X of your monthly cap"
banner, no admin dashboard, no hard cutoff at quota.

### Production gap
- Cost surprises if a contractor org transcribes 100 hours of
  meetings.
- No way for a contractor admin to see what they've spent.
- No way for the platform to refuse new AI runs once an org hits a
  monthly quota.

### Target design
- Settings page: contractor admin sees `SUM(cost_estimate_cents)`
  this month, broken down by operation (Whisper vs Claude),
  alongside the count of transcribed meetings.
- Optional `organizations.ai_monthly_cap_cents` column; the
  `/transcribe` route checks before triggering.
- Audit event `ai.quota_exceeded` for visibility.

### Why deferred
Portfolio mode (per `project_billing_model.md` — only contractors
pay for the platform; usage tier-gating doesn't matter without
real customers paying). The data is being captured, so this is a
read-side dashboard plus a guard, both straightforward additions
when needed.

---

## 6. Action-item idempotency on re-run

### Current approximation
Hitting "Generate from audio" twice on the same meeting (e.g. user
re-uploads after Claude misread some names) **inserts a second set
of action items** alongside the first. The user has to manually
delete the old set before finalizing. Trigger.dev's own dedupe
prevents the same exact run from firing twice, but a fresh upload =
a fresh run.

### Production gap
Cluttered Actions tab after a regenerate; reviewers can't tell which
items are from which run.

### Target design
Two options:
1. **Replace mode (default):** before inserting the new items, soft-
   delete (or hard-delete with `WHERE created_by_user_id = system_user
   AND status = 'open'`) any prior AI-generated items on this meeting.
   Tag rows with `source = 'ai'` to distinguish.
2. **Append mode (toggle):** UI checkbox "Replace AI items" defaulting
   on; off keeps both runs side-by-side.

Either way needs a `meeting_action_items.source` enum
(`manual | ai | carry_forward`) so the UI can render an "AI
generated" pill.

### Why deferred
Schema change (new column + enum). The clean re-run flow is a v2
quality-of-life upgrade, not a v1 blocker.

---

## 7. External (email-only) attendees as candidate assignees

### Current approximation
The roster passed to Claude is filtered to `userId IS NOT NULL`
attendees. External invitees (architects, owners with no platform
account, anyone identified by email) are dropped. If Whisper hears
"Sarah from the architect's office said she'd send the revised
drawings," Claude has no way to assign that to Sarah.

### Production gap
Real meetings frequently have external attendees making real
commitments. Dropping them from the roster means those action items
either land unassigned (low signal) or are extracted with the wrong
assignee (worse).

### Target design
- Pass the full attendee list (including email-only) to Claude with a
  hybrid roster shape: `{ userId | externalEmail, name, org }`.
- Schema: add `meeting_action_items.external_assignee_email` column
  (nullable text); CHECK constraint that exactly one of
  `assignedUserId` / `external_assignee_email` is populated when
  status = 'open'.
- UI surfaces external assignees as a chip with a "convert to
  invited user" hover action.

### Why deferred
Schema change + identity model expansion. Step 56 v1 keeps the
identity model strictly userId-scoped (matches the rest of the
action-items surface). Promotes cleanly when external collaborator
workflows mature.

---

## 8. Sub-step progress events from the Trigger.dev task

### Current approximation
The UI shows three labels — "Uploading…", "Transcribing…",
"Extracting action items…" — but `extracting` is fired by a
client-side `setTimeout(15000)` after the run flips to `EXECUTING`.
There's no real signal from the task that Whisper finished and
Claude started.

### Production gap
The progress labels lie. On a 5-minute audio Whisper might take 8
seconds and Claude 2 seconds — the UI shows "Transcribing…" the
whole time. On a 60-minute audio Whisper might take 90 seconds and
Claude 30 seconds — the UI flips to "Extracting…" 75 seconds early.

### Target design
- Use Trigger.dev v3's `metadata.set()` from inside the task to
  publish progress checkpoints (`{ phase: "transcribing" }`, etc.).
- Status route reads `runs.retrieve(runId).metadata` and surfaces
  the real phase to the client.
- OR switch the client to `useRealtimeRun()` from
  `@trigger.dev/react-hooks` for live event streaming.

### Why deferred
Cosmetic. Adds a dep (`@trigger.dev/react-hooks`) for the polling
alternative, or a few lines of metadata plumbing for the simpler
fix. Not blocking; just makes the demo feel more honest.

---
