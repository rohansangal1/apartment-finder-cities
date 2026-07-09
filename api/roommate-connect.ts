/**
 * POST /api/roommate-connect — the mutual opt-in reveal for roommate matching.
 *
 * Actions (JSON body `action`):
 *   'request'  { targetUserId }            → create/refresh a pending request.
 *   'respond'  { connectionId, accept }    → target accepts or declines a request.
 *   'list'     {}                          → the caller's connections, with the
 *                                            other party's contact email attached
 *                                            ONLY for accepted rows.
 *
 * Email is never exposed before both sides agree: the reveal happens here, server-
 * side, reading each party's social_profiles.contact_email (owner-only under RLS,
 * readable to the service-role client) and returning it solely for status='accepted'.
 */
import { withHandler } from './_lib/handler.js';
import { HttpError } from './_lib/env.js';
import { adminClient, requireUserId } from './_lib/supabase-admin.js';

interface ConnRow {
  id: string;
  requester_id: string;
  target_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export default withHandler('POST', async (req) => {
  const userId = await requireUserId(req);
  const db = adminClient();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action;

  if (action === 'request') {
    const targetUserId = String(body.targetUserId ?? '');
    if (!targetUserId || targetUserId === userId) {
      throw new HttpError(400, 'A valid targetUserId is required.');
    }
    // Only connect to users who are actually opted in.
    const target = await db
      .from('social_profiles')
      .select('roommate_opt_in')
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (!target.data?.roommate_opt_in) {
      throw new HttpError(404, 'That user is not open to roommate connections.');
    }
    const { error } = await db.from('roommate_connections').upsert(
      {
        requester_id: userId,
        target_id: targetUserId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'requester_id,target_id' }
    );
    if (error) throw error;
    return { ok: true };
  }

  if (action === 'respond') {
    const connectionId = String(body.connectionId ?? '');
    const accept = Boolean(body.accept);
    if (!connectionId) throw new HttpError(400, 'connectionId is required.');
    // Only the TARGET of the request may accept/decline it.
    const { data, error } = await db
      .from('roommate_connections')
      .update({ status: accept ? 'accepted' : 'declined', updated_at: new Date().toISOString() })
      .eq('id', connectionId)
      .eq('target_id', userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Request not found.');
    return { ok: true };
  }

  if (action === 'list') {
    const { data, error } = await db
      .from('roommate_connections')
      .select('id, requester_id, target_id, status, created_at')
      .or(`requester_id.eq.${userId},target_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data as ConnRow[]) ?? [];

    // Fetch the other parties' display names (+ emails for accepted rows only).
    const otherIds = Array.from(
      new Set(rows.map((r) => (r.requester_id === userId ? r.target_id : r.requester_id)))
    );
    const profiles = otherIds.length
      ? await db
          .from('social_profiles')
          .select('user_id, display_name, contact_email')
          .in('user_id', otherIds)
      : { data: [] as { user_id: string; display_name: string | null; contact_email: string | null }[] };
    const byId = new Map(
      (profiles.data ?? []).map((p) => [p.user_id, p] as const)
    );

    const connections = rows.map((r) => {
      const incoming = r.target_id === userId;
      const otherUserId = incoming ? r.requester_id : r.target_id;
      const prof = byId.get(otherUserId);
      return {
        id: r.id,
        otherUserId,
        direction: incoming ? 'incoming' : 'outgoing',
        status: r.status,
        displayName: prof?.display_name ?? undefined,
        // Reveal contact ONLY on mutual accept.
        contactEmail: r.status === 'accepted' ? prof?.contact_email ?? undefined : undefined,
        createdAt: r.created_at,
      };
    });
    return { connections };
  }

  throw new HttpError(400, `Unknown action: ${String(action)}`);
});
