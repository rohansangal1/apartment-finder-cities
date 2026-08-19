import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamNotes, __test, type AiNotes, type NotesEvent } from './ai-notes';
import type { Listing } from './types';

// Notes runs are authenticated, so the client reads the current Supabase
// session for a bearer token. Signed in by default; the auth tests vary it.
const session = { access_token: 'jwt-abc' } as { access_token: string } | null;
const auth = { session };
vi.mock('./supabase', () => ({
  isSupabaseEnabled: true,
  supabase: { auth: { getSession: async () => ({ data: { session: auth.session } }) } },
}));

const { parseFrame } = __test;

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  source: 'rentcast',
  listingUrl: 'https://example.com/l1',
  address: '123 Main St',
  neighborhood: 'Bushwick',
  city: 'Brooklyn',
  lat: 40.7,
  lng: -73.9,
  rentMonthly: 2400,
  bedrooms: 1,
  tags: ['Apartment'],
  ratingValue: null,
  ratingSource: 'google',
  ...over,
});

/** Build a Response whose body streams `chunks` verbatim, so tests can split
 * SSE frames at deliberately awkward byte boundaries. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

const DONE: AiNotes = {
  text: 'Solid block.',
  sources: ['Google Places'],
  model: 'gemma-4-31b-it',
  generatedAt: '2026-08-13T00:00:00.000Z',
};

const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe('parseFrame', () => {
  it('reads the event name and JSON payload', () => {
    expect(parseFrame('event: step\ndata: {"label":"Reading the listing"}')).toEqual({
      event: 'step',
      data: { label: 'Reading the listing' },
    });
  });

  it('defaults to "message" when no event name is given', () => {
    expect(parseFrame('data: {"a":1}')).toEqual({ event: 'message', data: { a: 1 } });
  });

  it('returns null for a frame with no data line', () => {
    expect(parseFrame('event: step')).toBeNull();
  });

  it('returns null rather than throwing on malformed JSON', () => {
    expect(parseFrame('event: step\ndata: {oops')).toBeNull();
  });
});

describe('streamNotes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    auth.session = { access_token: 'jwt-abc' };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports each step and token, then resolves with the finished notes', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        frame('step', { label: 'Reading the listing' }),
        frame('step', { label: 'Comparing rent' }),
        frame('token', { text: 'Solid ' }),
        frame('token', { text: 'block.' }),
        frame('done', DONE),
      ])
    );

    const events: string[] = [];
    const notes = await streamNotes(listing(), {}, (e) =>
      events.push(
        e.type === 'step' ? `step:${e.label}` : e.type === 'token' ? `token:${e.text}` : 'reset'
      )
    );

    expect(events).toEqual([
      'step:Reading the listing',
      'step:Comparing rent',
      'token:Solid ',
      'token:block.',
    ]);
    expect(notes).toEqual(DONE);
  });

  // ---- Regression ----
  // Network reads split wherever they like. An earlier draft assumed one read
  // equals one event, which dropped any frame straddling a chunk boundary.
  it('reassembles frames split across chunk boundaries', async () => {
    const whole = frame('step', { label: 'Reading the listing' }) + frame('done', DONE);
    // Cut mid-JSON, and again mid-"data:" prefix.
    const chunks = [whole.slice(0, 20), whole.slice(20, 47), whole.slice(47)];
    vi.mocked(fetch).mockResolvedValue(sseResponse(chunks));

    const events: string[] = [];
    const notes = await streamNotes(listing(), {}, (e) => {
      if (e.type === 'step') events.push(e.label);
    });

    expect(events).toEqual(['Reading the listing']);
    expect(notes).toEqual(DONE);
  });

  // The model sometimes narrates before calling a tool ("Let me check the
  // rent…"). That prose isn't part of the notes, so the server sends `reset`
  // and the panel drops what it has shown.
  it('forwards reset so the UI can discard pre-tool-call prose', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        frame('token', { text: 'Let me check the rent.' }),
        frame('reset', {}),
        frame('token', { text: 'Solid block.' }),
        frame('done', DONE),
      ])
    );

    const events: NotesEvent[] = [];
    await streamNotes(listing(), {}, (e) => events.push(e));

    expect(events.map((e) => e.type)).toEqual(['token', 'reset', 'token']);
  });

  // ---- Regression ----
  // SSE permits \r\n terminators and the Gemini API uses them. A reader that
  // only splits on \n\n yields NO frames at all — the buffer just grows and the
  // run ends looking like the model returned nothing. Silent and horrible.
  it('handles CRLF frame terminators', async () => {
    const crlf = (event: string, data: unknown) =>
      `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([crlf('step', { label: 'Reading the listing' }), crlf('done', DONE)])
    );

    const steps: string[] = [];
    const notes = await streamNotes(listing(), {}, (e) => {
      if (e.type === 'step') steps.push(e.label);
    });

    expect(steps).toEqual(['Reading the listing']);
    expect(notes).toEqual(DONE);
  });

  // The same split-boundary hazard, but landing between the \r and the \n.
  it('handles a chunk boundary falling inside a CRLF pair', async () => {
    const whole = `event: done\r\ndata: ${JSON.stringify(DONE)}\r\n\r\n`;
    const cut = whole.indexOf('\r\n\r\n') + 3; // between the second \r and its \n
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([whole.slice(0, cut), whole.slice(cut)])
    );

    await expect(streamNotes(listing(), {}, () => {})).resolves.toEqual(DONE);
  });

  it('rejects with the message from an error event', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        frame('step', { label: 'Reading the listing' }),
        frame('error', { message: 'AI notes are busy right now.' }),
      ])
    );

    await expect(streamNotes(listing(), {}, () => {})).rejects.toThrow(
      'AI notes are busy right now.'
    );
  });

  // A stream ending without `done` means the connection dropped. Resolving with
  // partial text would let the UI offer to save half a set of notes.
  it('rejects when the stream ends before the done event', async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse([frame('token', { text: 'Solid' })]));

    await expect(streamNotes(listing(), {}, () => {})).rejects.toThrow(/connection dropped/i);
  });

  it('surfaces the JSON error body when the request fails before streaming', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      body: null,
      json: async () => ({ error: 'Missing required environment variable: GEMINI_API_KEY.' }),
    } as unknown as Response);

    await expect(streamNotes(listing(), {}, () => {})).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('sends the listing and commute context to the endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse([frame('done', DONE)]));

    await streamNotes(
      listing({ id: 'l9' }),
      { workAddress: '1 Main St', commuteMode: 'bike' },
      () => {}
    );

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.listing.id).toBe('l9');
    expect(body.workAddress).toBe('1 Main St');
    expect(body.commuteMode).toBe('bike');
  });

  // ---- Auth ----
  // The endpoint bills a shared model quota to a user id, so it rejects anything
  // without a verified session. The client has to actually send the token.
  it('authenticates the request with the current session token', async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse([frame('done', DONE)]));

    await streamNotes(listing(), {}, () => {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-abc');
  });

  // Failing here rather than at the network boundary keeps a signed-out click
  // from burning a request that can only ever come back 401.
  it('refuses to send a run when signed out', async () => {
    auth.session = null;

    await expect(streamNotes(listing(), {}, () => {})).rejects.toThrow(/sign in/i);
    expect(fetch).not.toHaveBeenCalled();
  });
});
