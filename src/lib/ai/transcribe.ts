import OpenAI, { toFile } from "openai";

// Thin Whisper wrapper. Returns the transcript text + the audio
// duration Whisper reports (used to bill ai_usage). Throws on missing
// key — callers in /jobs run server-side and crash loudly is the
// right failure mode.

export type WhisperResult = {
  text: string;
  durationSeconds: number;
};

export async function transcribeAudio(params: {
  audio: Buffer;
  filename: string;
  mimeType: string;
}): Promise<WhisperResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set; required for transcribeAudio()",
    );
  }
  const openai = new OpenAI({ apiKey });
  const file = await toFile(params.audio, params.filename, {
    type: params.mimeType,
  });

  // verbose_json gives us `duration` in seconds, which we feed into
  // ai_usage.audio_seconds. Plain "json" or "text" omit it.
  const res = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  // Type narrowing: `verbose_json` returns a Verbose response with
  // `duration`; the SDK union types both shapes.
  const text = (res as { text: string }).text ?? "";
  const duration =
    typeof (res as { duration?: unknown }).duration === "number"
      ? (res as { duration: number }).duration
      : 0;
  return { text, durationSeconds: duration };
}
