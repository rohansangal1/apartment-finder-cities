/**
 * POST /api/match-roommates — server-computed, privacy-preserving roommate matches.
 *
 * Why server-side: matching reads ACROSS users, but saved_listings + social_profiles
 * are owner-only under RLS. This endpoint uses the service-role client (which bypasses
 * RLS) to compare *derived signals only*, and returns anonymized candidate cards —
 * never a raw saved address, listing id, private note, or email. Contact is exchanged
 * later, on mutual accept, via /api/roommate-connect.
 *
 * Auth: caller identified by their Supabase JWT (Bearer token). Opted-out callers, and
 * users the caller doesn't overlap with at all, get an empty list.
 */
import { withHandler } from './_lib/handler.js';
import { adminClient, requireUserId } from './_lib/supabase-admin.js';
import { roommateSimilarity, sharedFacets, type RoommateSignal } from '../src/lib/match/roommate-signal.js';

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  age_range: string | null;
  move_in_month: string | null;
  bio: string | null;
  roommate_signal: RoommateSignal | null;
}

const MAX_CANDIDATES = 20;

export default withHandler('POST', async (req) => {
  const userId = await requireUserId(req);
  const db = adminClient();

  // The caller must be opted in and have a signal, or there's nothing to match on.
  const me = await db
    .from('social_profiles')
    .select('roommate_opt_in, roommate_signal')
    .eq('user_id', userId)
    .maybeSingle();
  const mySignal = me.data?.roommate_signal as RoommateSignal | null;
  if (!me.data?.roommate_opt_in || !mySignal) return { candidates: [] };

  // Everyone else who is opted in and has published a signal.
  const others = await db
    .from('social_profiles')
    .select('user_id, display_name, age_range, move_in_month, bio, roommate_signal')
    .eq('roommate_opt_in', true)
    .not('roommate_signal', 'is', null)
    .neq('user_id', userId);
  if (others.error) throw others.error;

  const candidates = (others.data as ProfileRow[])
    .map((row) => {
      const theirSignal = row.roommate_signal as RoommateSignal;
      const score = roommateSimilarity(mySignal, theirSignal);
      const shared = sharedFacets(mySignal, theirSignal);
      return {
        userId: row.user_id,
        score,
        displayName: row.display_name ?? undefined,
        ageRange: row.age_range ?? undefined,
        moveInMonth: row.move_in_month ?? undefined,
        bio: row.bio ?? undefined,
        budgetBand: theirSignal.budgetBand ?? null,
        sharedCities: shared.cities,
        sharedNeighborhoods: shared.neighborhoods,
      };
    })
    // Only surface real overlap; sort strongest first; cap the list.
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  return { candidates };
});
