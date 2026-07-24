/**
 * Where to reach the person building Nester.
 *
 * The address is assembled at runtime rather than written as one literal so it
 * isn't sitting in the shipped bundle (or the rendered HTML) as a ready-to-grab
 * string. This stops naive scrapers, not a headless browser — it's a cheap
 * spam tax, not a secret.
 */
const USER = ['rohan', 'ss', 'sangal'].join('.');
const DOMAIN = ['gmail', 'com'].join('.');

export const CONTACT_EMAIL = `${USER}@${DOMAIN}`;
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

/** Mirrors the check constraint on public.feedback.message (migration 0010). */
export const MAX_FEEDBACK_LEN = 2000;
/** Mirrors the check constraint on public.feedback.contact_email. */
export const MAX_CONTACT_EMAIL_LEN = 200;
