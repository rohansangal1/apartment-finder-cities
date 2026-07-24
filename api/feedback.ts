/**
 * POST /api/feedback — a visitor's suggestion, bug report, or question.
 *
 * Deliberately unauthenticated: someone hitting a rough edge shouldn't have to
 * sign up to tell us about it. That makes it the only public *write* endpoint,
 * so it leans on two guardrails — the IP rate limit `withHandler` applies to
 * every request, and length caps enforced both here and by check constraints in
 * migration 0010.
 *
 * Rows are written with the service-role client because public.feedback has RLS
 * on with no policies: nothing can touch it from the browser, by design.
 */
import { withHandler } from './_lib/handler.js';
import { HttpError } from './_lib/env.js';
import { adminClient } from './_lib/supabase-admin.js';

const MAX_MESSAGE_LEN = 2000;
const MAX_EMAIL_LEN = 200;
const MAX_PATH_LEN = 200;

export default withHandler('POST', async (req) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < 4) throw new HttpError(400, 'Please write a little more.');
  if (message.length > MAX_MESSAGE_LEN) throw new HttpError(400, 'Message is too long.');

  // Optional — plenty of useful feedback comes from people who don't want a reply.
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, MAX_EMAIL_LEN) : '';
  // Which page they were on: the difference between "search is broken" and a repro.
  const path = typeof body.path === 'string' ? body.path.slice(0, MAX_PATH_LEN) : null;

  const { error } = await adminClient().from('feedback').insert({
    message,
    contact_email: email || null,
    path,
  });
  // Log the failure, never the message body.
  if (error) {
    console.error('feedback insert failed:', error.message);
    throw new HttpError(500, 'Could not save your feedback. Please try emailing instead.');
  }

  return { ok: true };
});
