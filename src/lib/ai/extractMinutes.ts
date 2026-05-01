import Anthropic from "@anthropic-ai/sdk";

// Claude-backed action item extractor for Step 56 (Meeting Minutes
// AI). Takes a Whisper transcript + the meeting's known attendees,
// returns a draft minutes paragraph and a structured list of action
// items with assignees mapped to userIds where possible.
//
// Design choices baked in:
//   - Opus 4.7 with adaptive thinking (skill default; extraction
//     quality on construction transcripts is intelligence-sensitive,
//     and a one-shot call doesn't justify a Haiku downgrade).
//   - output_config.format with a json_schema, NOT tool-use. Cleaner
//     idiom for "give me a JSON list"; tool-use is for tool calls.
//   - Assignee matching: model gets the candidate roster in the
//     prompt and is instructed to either return a userId from the
//     roster, or null + a `confidence: "low"` flag. No client-side
//     fuzzy fallback — if Claude can't confidently match, that's the
//     signal for the UI to surface a yellow chip prompting reassign.

const ACTION_ITEM_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["minutes", "actionItems"],
  properties: {
    minutes: {
      type: "string",
      description:
        "A clean, structured prose summary of the meeting suitable for the meeting_minutes.content field. Group by topic, mark decisions explicitly. Plain text, no markdown headers.",
    },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "description",
          "assignedUserId",
          "dueDate",
          "context",
          "confidence",
        ],
        properties: {
          description: {
            type: "string",
            description: "What needs to be done. Action-oriented imperative.",
          },
          assignedUserId: {
            type: ["string", "null"],
            description:
              "The userId from the candidate roster who is responsible. Null if no confident match — set confidence='low' in that case.",
          },
          dueDate: {
            type: ["string", "null"],
            description:
              "Due date as YYYY-MM-DD if explicitly mentioned in the transcript. Null otherwise.",
          },
          context: {
            type: "string",
            description:
              "A short verbatim quote (max 200 chars) from the transcript showing where this action was decided. Lets reviewers verify the extraction.",
          },
          confidence: {
            type: "string",
            enum: ["high", "low"],
            description:
              "high = clear assignee + clear action. low = ambiguous assignee or uncertain commitment; UI surfaces these for review.",
          },
        },
      },
    },
  },
} as const;

export type ExtractedActionItem = {
  description: string;
  assignedUserId: string | null;
  dueDate: string | null;
  context: string;
  confidence: "high" | "low";
};

export type ExtractedMinutes = {
  minutes: string;
  actionItems: ExtractedActionItem[];
  inputTokens: number;
  outputTokens: number;
};

export type Attendee = {
  userId: string;
  name: string;
  roleLabel: string | null;
  orgName: string;
};

const SYSTEM_PROMPT = `You are a construction project meeting minutes assistant. You receive a raw transcript of a construction meeting (OAC, coordination, safety, etc.) and extract two things:

1. A clean, structured paragraph summary of what was discussed and decided.
2. A list of action items with their assignees, due dates, and supporting quotes.

Construction meetings have specific norms: subcontractors are referred to by company ("Acme Mechanical will handle the duct rerouting"), the GC's PM coordinates, the architect issues clarifications. Use the candidate attendee roster to resolve names and companies to userIds.

When the assignee is clearly named or referenced ("Mike, can you...", "Acme will..."), set confidence to "high". When ambiguous ("someone needs to...", "we should..."), leave assignedUserId null and set confidence to "low".

Be conservative on dueDate — only extract if the transcript explicitly states a date or relative date you can resolve to YYYY-MM-DD using the meeting date provided in the prompt.`;

export async function extractMinutesAndActionItems(params: {
  transcript: string;
  meetingTitle: string;
  meetingDate: string; // YYYY-MM-DD, used to resolve relative due dates
  attendees: Attendee[];
}): Promise<ExtractedMinutes> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set; required for extractMinutesAndActionItems()",
    );
  }
  const client = new Anthropic({ apiKey });

  const rosterLines = params.attendees
    .map(
      (a) =>
        `- userId: ${a.userId} | ${a.name}${a.roleLabel ? ` (${a.roleLabel})` : ""} — ${a.orgName}`,
    )
    .join("\n");

  const userPrompt = `Meeting: ${params.meetingTitle}
Date: ${params.meetingDate}

Candidate attendees (use these userIds when assigning action items):
${rosterLines || "  (no roster provided — leave all assignedUserId fields null)"}

Transcript:
${params.transcript}`;

  // Stream because extraction can take 30-60s on long transcripts and
  // Opus 4.7 with adaptive thinking + json_schema constraints can
  // exceed the SDK's default HTTP timeout otherwise.
  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: {
        type: "json_schema",
        schema: ACTION_ITEM_JSON_SCHEMA,
      },
    },
  });

  const final = await stream.finalMessage();

  const textBlock = final.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    throw new Error("Claude returned no text content for minutes extraction");
  }

  let parsed: { minutes: string; actionItems: ExtractedActionItem[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `Claude returned non-JSON output despite json_schema: ${(err as Error).message}`,
    );
  }

  // Validate userIds against the roster — if Claude hallucinated a
  // userId not in the candidate list, treat it as low confidence with
  // null assignee. The roster is the authoritative source.
  const knownUserIds = new Set(params.attendees.map((a) => a.userId));
  const sanitized: ExtractedActionItem[] = parsed.actionItems.map((item) => {
    if (item.assignedUserId && !knownUserIds.has(item.assignedUserId)) {
      return { ...item, assignedUserId: null, confidence: "low" };
    }
    return item;
  });

  return {
    minutes: parsed.minutes,
    actionItems: sanitized,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
  };
}
