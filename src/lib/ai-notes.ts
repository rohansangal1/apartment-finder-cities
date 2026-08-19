/**
 * AI-generated notes about a listing — the client half of /api/ai-notes.
 *
 * The model is Gemma 4, Google's open-weight model, served over the Gemini API
 * where it costs nothing. "Free" has a real shape here: the quota is per-project
 * and shared by everyone using this app, so notes are generated at most once per
 * listing, cached server-side, and a busy moment surfaces as an honest error
 * rather than a queue.
 *
 * The endpoint streams Server-Sent Events so the panel can narrate the run.
 * Each `step` corresponds to a lookup the server actually performed — a rent
 * comparison, a Places search, a routing call — never a decorative timer.
 *
 * Notes are stored per listing id (see UserDataContext), independently of the
 * shortlist, so generating from a results card doesn't force a save and saving
 * later carries the notes across.
 */
import type { Listing, CommuteMode } from './types';
import { supabase, isSupabaseEnabled } from './supabase';

/** The feature is live. (Kept as a named export: call sites read it.) */
export const AI_NOTES_ENABLED = true;

/** A finished set of notes, as persisted against a listing id. */
export interface AiNotes {
  /** The prose the model wrote, lightly marked up with **bold** headings. */
  text: string;
  /** Which lookups fed it, e.g. ['Google Places', 'RentCast comparables']. */
  sources: string[];
  /** Model id, so old notes stay attributable after a model change. */
  model: string;
  generatedAt: string;
}

/**
 * Progress from a run in flight.
 *
 * `reset` means the prose streamed so far was the model talking itself into a
 * tool call, not the notes — the UI should clear what it has shown, so the user
 * never reads text that won't be in the result they save.
 */
export type NotesEvent =
  | { type: 'step'; label: string }
  | { type: 'token'; text: string }
  | { type: 'reset' };

const BASE = import.meta.env?.VITE_API_BASE_URL || '';

/**
 * The caller's Supabase access token, or null when signed out.
 *
 * Read fresh per run rather than captured once: the SDK rotates the token on
 * refresh, and a stale one would come back as a 401 partway through a session.
 */
async function accessToken(): Promise<string | null> {
  if (!isSupabaseEnabled || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Generate notes for a listing, reporting progress as it goes.
 *
 * Requires a signed-in user: every run spends from a shared model quota, so the
 * endpoint attributes it to an account. The UI gates the trigger on the same
 * condition — this check is the honest failure for the case where a session
 * expires between opening the panel and the request going out.
 *
 * Resolves with the finished notes, or rejects with a human-readable message —
 * including the 429 the shared free tier will occasionally produce.
 */
export async function streamNotes(
  listing: Listing,
  options: { workAddress?: string; commuteMode?: CommuteMode; signal?: AbortSignal },
  onEvent: (event: NotesEvent) => void
): Promise<AiNotes> {
  const token = await accessToken();
  if (!token) throw new Error('Sign in to generate notes.');

  const res = await fetch(`${BASE}/api/ai-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      listing,
      workAddress: options.workAddress,
      commuteMode: options.commuteMode,
    }),
    signal: options.signal,
  });

  // Failures that happen before the stream opens come back as ordinary JSON,
  // the same shape every other endpoint uses.
  if (!res.ok || !res.body) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Non-JSON body — keep the status-code message.
    }
    throw new Error(message);
  }

  let notes: AiNotes | null = null;
  let failure: string | null = null;

  for await (const frame of readEventStream(res.body)) {
    if (frame.event === 'step') {
      onEvent({ type: 'step', label: String((frame.data as { label?: string }).label ?? '') });
    } else if (frame.event === 'token') {
      onEvent({ type: 'token', text: String((frame.data as { text?: string }).text ?? '') });
    } else if (frame.event === 'reset') {
      onEvent({ type: 'reset' });
    } else if (frame.event === 'done') {
      notes = frame.data as AiNotes;
    } else if (frame.event === 'error') {
      failure = String((frame.data as { message?: string }).message ?? 'Something went wrong.');
    }
  }

  if (failure) throw new Error(failure);
  // A stream that ends without `done` means the connection dropped mid-run.
  if (!notes) throw new Error('The connection dropped before the notes were finished.');
  return notes;
}

interface Frame {
  event: string;
  data: unknown;
}

/**
 * Parse an SSE response body into `{event, data}` frames.
 *
 * `EventSource` can't POST, so we read the stream by hand. Chunks split at
 * arbitrary byte boundaries, so we buffer until a blank line completes a frame
 * rather than assuming one read equals one event.
 *
 * CRLF is normalized because SSE permits either terminator and a proxy in front
 * of the function may rewrite them. Splitting on \n\n alone silently yields no
 * frames at all, which is a miserable failure to diagnose.
 */
async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<Frame> {
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
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const frame = parseFrame(raw);
      if (frame) yield frame;
    }
  }
}

/** One `event:`/`data:` block → a frame, or null if it's unusable. */
function parseFrame(raw: string): Frame | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

/** Exported for tests — the frame parser is the part worth pinning down. */
export const __test = { parseFrame };
