/**
 * socialClient — the UI's single entry point for roommate matching + the agent
 * directory. Mirrors the dataClient pattern: views never talk to Supabase or /api
 * directly, they call these functions.
 *
 * Two backends, chosen by whether Supabase is configured:
 *   Supabase on  → real: agent reads/writes go straight to Postgres (RLS), while
 *                  cross-user matching + the connect reveal go through the
 *                  service-role /api endpoints (authenticated with the user's JWT).
 *   Supabase off → mock fixtures, so the pages stay explorable with no backend.
 */
import { supabase, isSupabaseEnabled } from '../supabase';
import type {
  RoommateCandidate,
  RoommateConnection,
  AgentProfile,
} from './types';
import {
  MOCK_ROOMMATE_CANDIDATES,
  MOCK_CONNECTIONS,
  MOCK_AGENTS,
} from './mock-social';

const BASE = import.meta.env?.VITE_API_BASE_URL || '';

/** True when we have a real backend AND a signed-in session to authenticate with. */
async function accessToken(): Promise<string | null> {
  if (!isSupabaseEnabled || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** POST to a social /api endpoint with the caller's bearer token. */
async function authedPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

// ---- Roommate matching ----------------------------------------------------

/** Anonymized candidate matches for the signed-in user (empty if opted out). */
export async function matchRoommates(): Promise<RoommateCandidate[]> {
  const token = await accessToken();
  if (!token) return MOCK_ROOMMATE_CANDIDATES;
  const { candidates } = await authedPost<{ candidates: RoommateCandidate[] }>(
    '/api/match-roommates',
    {},
    token
  );
  return candidates;
}

/** The user's connection requests (incoming + outgoing); emails only on accept. */
export async function listConnections(): Promise<RoommateConnection[]> {
  const token = await accessToken();
  if (!token) return MOCK_CONNECTIONS;
  const { connections } = await authedPost<{ connections: RoommateConnection[] }>(
    '/api/roommate-connect',
    { action: 'list' },
    token
  );
  return connections;
}

/** Send a connection request to a candidate. */
export async function requestConnect(targetUserId: string): Promise<void> {
  const token = await accessToken();
  if (!token) return; // mock demo: no-op
  await authedPost('/api/roommate-connect', { action: 'request', targetUserId }, token);
}

/** Accept or decline an incoming request. */
export async function respondConnect(connectionId: string, accept: boolean): Promise<void> {
  const token = await accessToken();
  if (!token) return; // mock demo: no-op
  await authedPost('/api/roommate-connect', { action: 'respond', connectionId, accept }, token);
}

// ---- Agent directory ------------------------------------------------------

const AGENT_COLS =
  'user_id, is_agent, display_name, brokerage, license_no, cities, bio, photo_url, contact_email, booking_url, specialties, verified';

interface AgentRow {
  user_id: string;
  is_agent: boolean;
  display_name: string | null;
  brokerage: string | null;
  license_no: string | null;
  cities: string[] | null;
  bio: string | null;
  photo_url: string | null;
  contact_email: string | null;
  booking_url: string | null;
  specialties: string[] | null;
  verified: boolean;
}

function toAgent(r: AgentRow): AgentProfile {
  return {
    userId: r.user_id,
    isAgent: r.is_agent,
    displayName: r.display_name ?? undefined,
    brokerage: r.brokerage ?? undefined,
    licenseNo: r.license_no ?? undefined,
    cities: r.cities ?? [],
    bio: r.bio ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    contactEmail: r.contact_email ?? undefined,
    bookingUrl: r.booking_url ?? undefined,
    specialties: r.specialties ?? [],
    verified: r.verified,
  };
}

const cityMatches = (agentCities: string[], city?: string) =>
  !city || agentCities.some((c) => c.toLowerCase() === city.toLowerCase());

/** Agents serving `city` (or all agents when no city given), verified first. */
export async function listAgents(city?: string): Promise<AgentProfile[]> {
  if (!isSupabaseEnabled || !supabase) {
    return MOCK_AGENTS.filter((a) => cityMatches(a.cities, city));
  }
  let query = supabase.from('agent_profiles').select(AGENT_COLS).eq('is_agent', true);
  if (city) query = query.contains('cities', [city]);
  const { data, error } = await query;
  if (error) throw error;
  const agents = (data as AgentRow[] | null ?? []).map(toAgent);
  // verified first, then alphabetical for a stable directory order.
  return agents.sort(
    (a, b) => Number(b.verified) - Number(a.verified) ||
      (a.displayName ?? '').localeCompare(b.displayName ?? '')
  );
}

/** The signed-in user's own agent profile (null if they haven't started one). */
export async function getMyAgentProfile(): Promise<AgentProfile | null> {
  if (!isSupabaseEnabled || !supabase) return null;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('agent_profiles')
    .select(AGENT_COLS)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? toAgent(data as AgentRow) : null;
}

/** Create/update the signed-in user's agent profile. */
export async function saveAgentProfile(profile: AgentProfile): Promise<void> {
  if (!isSupabaseEnabled || !supabase) throw new Error('Sign in to publish an agent profile.');
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  const email = sess.session?.user.email;
  if (!uid) throw new Error('Sign in to publish an agent profile.');
  const { error } = await supabase.from('agent_profiles').upsert(
    {
      user_id: uid,
      is_agent: profile.isAgent,
      display_name: profile.displayName ?? null,
      brokerage: profile.brokerage ?? null,
      license_no: profile.licenseNo ?? null,
      cities: profile.cities,
      bio: profile.bio ?? null,
      photo_url: profile.photoUrl ?? null,
      contact_email: profile.contactEmail ?? email ?? null,
      booking_url: profile.bookingUrl ?? null,
      specialties: profile.specialties,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

/** Record a lead when a searcher contacts an agent (best-effort; ignored on mock). */
export async function contactAgent(agentId: string, city?: string, message?: string): Promise<void> {
  if (!isSupabaseEnabled || !supabase) return;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return; // must be signed in to record a lead; UI reveals contact regardless
  await supabase.from('agent_leads').insert({
    agent_id: agentId,
    searcher_id: uid,
    city: city ?? null,
    message: message ?? null,
  });
}
