/**
 * Client-facing types for the social layer: roommate matching + agent directory.
 * These are the shapes the views consume; the DB columns (snake_case) are mapped
 * to these (camelCase) in the store / social client.
 */
import type { RoommateSignal } from '../match/roommate-signal';

/** A user's opt-in social profile. `roommateOptIn` gates ALL visibility. */
export interface SocialProfile {
  roommateOptIn: boolean;
  displayName?: string;
  bio?: string;
  ageRange?: string;
  moveInMonth?: string;
  budgetMin?: number;
  budgetMax?: number;
  contactEmail?: string;
}

/** A default, opted-out profile — the safe starting state for a new/guest user. */
export const EMPTY_SOCIAL_PROFILE: SocialProfile = { roommateOptIn: false };

/** An anonymized roommate match, as returned by /api/match-roommates. No email. */
export interface RoommateCandidate {
  /** The other user's id — used to request a connection. Not shown in the UI. */
  userId: string;
  /** Similarity 0–100 (same scale as a listing match score). */
  score: number;
  displayName?: string;
  ageRange?: string;
  moveInMonth?: string;
  bio?: string;
  budgetBand: [number, number] | null;
  sharedCities: string[];
  sharedNeighborhoods: string[];
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

/** A connection request as shown in the Requests section. `direction` says whether
 * the current user sent it (outgoing) or received it (incoming). `contactEmail` is
 * populated by the server ONLY when status === 'accepted'. */
export interface RoommateConnection {
  id: string;
  otherUserId: string;
  direction: 'incoming' | 'outgoing';
  status: ConnectionStatus;
  displayName?: string;
  /** Revealed only on mutual accept. */
  contactEmail?: string;
  createdAt: string;
}

/** A self-serve real-estate agent's public directory profile. */
export interface AgentProfile {
  userId: string;
  isAgent: boolean;
  displayName?: string;
  brokerage?: string;
  licenseNo?: string;
  cities: string[];
  bio?: string;
  photoUrl?: string;
  contactEmail?: string;
  bookingUrl?: string;
  specialties: string[];
  verified: boolean;
}

/** A blank agent profile for the onboarding form. */
export const EMPTY_AGENT_PROFILE: AgentProfile = {
  userId: '',
  isAgent: false,
  cities: [],
  specialties: [],
  verified: false,
};

export type { RoommateSignal };
