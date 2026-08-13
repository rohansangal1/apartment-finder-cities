/**
 * Gemma 4 client — Google's open-weight model, served over the Gemini API.
 *
 * Why Gemma and not Gemini: on the Gemini API, Gemma 4 is free of charge. That
 * is not a discount, it's the only tier — the pricing page lists Gemma's paid
 * tier as "not available". So the quota is per-project and shared across every
 * user of this app, and a busy day means HTTP 429 rather than a bill. The whole
 * feature is designed around that: notes are generated once per listing, every
 * lookup is cached, and a 429 surfaces as an honest "try again in a minute".
 *
 * Hand-rolled `fetch` rather than an SDK, matching every other provider in
 * `_lib/providers/` — the request shape is small and one dependency is not worth
 * it for a single endpoint.
 *
 * Docs: https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
 */
import { requireEnv, HttpError } from '../env.js';
import type { FunctionDeclaration } from './tools.js';

/** The 31B dense instruction-tuned model — the strongest Gemma 4 on the API. */
export const MODEL = 'gemma-4-31b-it';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Hard ceiling on model round-trips per notes run. Three is enough for a couple
 * of parallel tool batches plus the write-up; without a cap a confused model can
 * loop on tool calls and burn the shared free quota for everyone.
 */
const MAX_TURNS = 4;

/** A Gemini API content part — text, a tool request, or a tool result. */
type Part =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/** What one model turn produced. */
export interface Turn {
  /** Tool calls the model wants run. Empty when it answered instead. */
  calls: FunctionCall[];
  /** The prose it produced this turn (empty when it only called tools). */
  text: string;
}

export interface GenerateOptions {
  system: string;
  contents: Content[];
  tools: FunctionDeclaration[];
  /** Called with each text fragment as it arrives, for live streaming to the UI. */
  onToken?: (text: string) => void;
}

/**
 * Run one model turn, streaming its text out through `onToken`.
 *
 * Uses `streamGenerateContent?alt=sse` for both tool-calling and answering turns
 * so there's a single code path: we accumulate parts either way, and only the
 * text ones get streamed onward.
 */
export async function generateTurn({
  system,
  contents,
  tools,
  onToken,
}: GenerateOptions): Promise<Turn> {
  const apiKey = requireEnv('GEMINI_API_KEY');

  const res = await fetch(`${BASE}/${MODEL}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      ...(tools.length ? { tools: [{ functionDeclarations: tools }] } : {}),
      // maxOutputTokens has to cover the model's reasoning, not just its answer.
      // Gemma 4 always thinks before replying and cannot be told not to — the
      // API rejects thinkingConfig for this model — and those tokens come out of
      // the same budget. At 800 the reasoning consumed all of it and the answer
      // never arrived (empty response, every time). ~200-600 goes on thinking
      // for a notes-sized prompt, so this leaves ample room for the write-up.
      generationConfig: { temperature: 0.4, maxOutputTokens: 4000 },
    }),
  });

  if (res.status === 429) {
    throw new HttpError(
      429,
      'AI notes are busy right now — Gemma’s free tier is shared. Try again in a minute.'
    );
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const calls: FunctionCall[] = [];
  let text = '';

  for await (const chunk of readSseJson(res.body)) {
    const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      // Gemma 4 reasons before answering and returns that scratchpad as its own
      // part flagged `thought: true` ("Task: … Constraint: … slightly awkward").
      // It is not the answer — streaming it would show the user the model
      // second-guessing itself and then save it as their notes.
      if (part.thought) continue;
      if (typeof part.text === 'string' && part.text) {
        text += part.text;
        onToken?.(part.text);
      } else if (part.functionCall?.name) {
        calls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
      }
    }
  }

  return { calls, text };
}

/** Shape of the fragments the Gemini API streams back. */
interface StreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        /** Marks the model's internal reasoning rather than its answer. */
        thought?: boolean;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }>;
    };
  }>;
}

/**
 * Parse an SSE body into decoded JSON chunks.
 *
 * Network reads split wherever they like, so we buffer until a blank line marks
 * a complete frame rather than assuming one chunk equals one event.
 *
 * The CRLF normalization is load-bearing, not defensive tidying: the Gemini API
 * terminates frames with \r\n\r\n. Splitting on \n\n alone matches nothing, the
 * buffer grows to the whole response, and every turn comes back empty.
 */
async function* readSseJson(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Normalize the whole buffer, not each chunk: a read can split a frame
    // between the \r and the \n, and neither half would match on its own.
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');

    let split: number;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload) as StreamChunk;
        } catch {
          // A frame we can't parse is a fragment of the stream, not a failure —
          // skip it rather than aborting a run that's otherwise fine.
        }
      }
    }
  }
}

export { MAX_TURNS };
