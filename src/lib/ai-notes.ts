/**
 * AI-generated notes — the *seam* for a future feature, not the feature itself.
 *
 * Pattern: a "feature flag" + a stub. We're designing the shape of the thing
 * (what it's called, what it takes, what it returns) before we build the guts, so
 * the UI can wire up honestly today and the implementation can drop in later
 * without touching call sites. Nothing here makes a network call or fakes output —
 * an honest "coming soon" beats a fake result that erodes trust.
 *
 * To ship for real later:
 *   1. Flip AI_NOTES_ENABLED to true.
 *   2. Replace generateNotes' body with a call to an /api/ai-notes endpoint.
 *   3. The button in ai-notes-button.tsx already reads the flag, so it lights up.
 */
import type { Listing } from './types';

/** Master switch. False until the real implementation lands. */
export const AI_NOTES_ENABLED = false;

/**
 * Generate a short AI summary/notes for a listing.
 *
 * Intentionally throws for now — it's a placeholder so the type signature exists
 * and callers can be written against it. It should never actually run while
 * AI_NOTES_ENABLED is false; the UI keeps the trigger disabled.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateNotes(_listing: Listing): Promise<string> {
  throw new Error('AI notes are not implemented yet (AI_NOTES_ENABLED is false).');
}
