// Cost-estimate constants for ai_usage rows. NOT a live ledger —
// historical rows aren't repriced when these constants change. Update
// when provider list prices change; existing rows reflect the rate at
// the time of the call.
//
// Last reviewed: 2026-05-01 (Step 56).
//
// Sources:
//   - Whisper: $0.006 / minute (OpenAI list price)
//   - Claude Opus 4.7: $5 / 1M input tokens, $25 / 1M output tokens
//
// All values are in fractional cents to keep arithmetic in integers
// inside the schema while not losing precision on small calls.

export const WHISPER_CENTS_PER_SECOND = 0.6 / 60; // 0.01 cents/second

// Opus 4.7 — used for action item extraction.
export const CLAUDE_OPUS_47_INPUT_CENTS_PER_TOKEN = 500 / 1_000_000;
export const CLAUDE_OPUS_47_OUTPUT_CENTS_PER_TOKEN = 2500 / 1_000_000;

export function estimateWhisperCostCents(audioSeconds: number): number {
  return Math.ceil(audioSeconds * WHISPER_CENTS_PER_SECOND);
}

export function estimateClaudeCostCents(
  inputTokens: number,
  outputTokens: number,
): number {
  const cents =
    inputTokens * CLAUDE_OPUS_47_INPUT_CENTS_PER_TOKEN +
    outputTokens * CLAUDE_OPUS_47_OUTPUT_CENTS_PER_TOKEN;
  return Math.ceil(cents);
}

// Cost guardrail thresholds for transcribeAndExtract. Soft cap warns
// the user before kicking off; hard cap rejects the upload entirely.
// Tuned for portfolio mode — re-evaluate if real customers appear.
export const WHISPER_SOFT_CAP_SECONDS = 60 * 60; // 1 hour
export const WHISPER_HARD_CAP_SECONDS = 60 * 60 * 2; // 2 hours
