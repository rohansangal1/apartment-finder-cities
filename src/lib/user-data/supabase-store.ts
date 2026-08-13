/**
 * Supabase-backed UserStore (Phase 2). Reads/writes Postgres tables protected by
 * Row-Level Security, so a user only ever touches their own saved_listings,
 * preferences, and reviews — while reviews stay publicly readable.
 *
 * Factory takes the authenticated user id so every write is correctly scoped
 * (RLS enforces it server-side too; this keeps the client honest).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Listing, Review, NewReview, UserPreferences, SearchCriteria } from '../types';
import type { UserStore, SavedListing, SavedSearch, SavedAddress } from './types';
import type { SocialProfile } from '../social/types';
import type { AiNotes } from '../ai-notes';
import { buildRoommateSignal } from '../match/roommate-signal';

interface ReviewRow {
  id: string;
  listing_id: string;
  user_id: string;
  stars: number;
  text: string;
  lived_here_verified: boolean;
  created_at: string;
}

const toReview = (r: ReviewRow): Review => ({
  id: r.id,
  listingId: r.listing_id,
  userId: r.user_id,
  stars: r.stars,
  text: r.text,
  livedHereVerified: r.lived_here_verified,
  createdAt: r.created_at,
});

export function createSupabaseStore(supabase: SupabaseClient, user: User): UserStore {
  // Recompute and persist the derived roommate signal from the user's current
  // saves — but ONLY if they've opted in. Called after saves change and on
  // profile save. Best-effort: never let a signal write break the caller (the
  // save itself already succeeded), so failures are swallowed by callers.
  async function refreshRoommateSignal(): Promise<void> {
    const { data } = await supabase
      .from('social_profiles')
      .select('roommate_opt_in')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data?.roommate_opt_in) return; // opted out → nothing to expose
    const saved = await supabase
      .from('saved_listings')
      .select('listing')
      .eq('user_id', user.id);
    const listings = (saved.data ?? [])
      .map((r) => r.listing as Listing | null)
      .filter((l): l is Listing => Boolean(l));
    await supabase
      .from('social_profiles')
      .update({ roommate_signal: buildRoommateSignal(listings), updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }

  return {
    async listSaved() {
      const { data, error } = await supabase
        .from('saved_listings')
        .select('listing, saved_at, notes')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        // Rows saved before the snapshot migration have listing = null; skip them.
        .filter((r) => r.listing)
        .map((r): SavedListing => ({
          listing: r.listing as Listing,
          savedAt: r.saved_at as string,
          note: (r.notes as string | null) ?? undefined,
        }));
    },

    async setSaved(listing, saved) {
      if (saved) {
        const { error } = await supabase.from('saved_listings').upsert(
          { user_id: user.id, listing_id: listing.id, listing },
          { onConflict: 'user_id,listing_id' }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_listings')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listing.id);
        if (error) throw error;
      }
      // Keep the roommate signal in step with saves (opted-in users only). The
      // save above already succeeded, so a signal-refresh failure must not
      // surface as a failed save — swallow it.
      refreshRoommateSignal().catch((e) => console.error('signal refresh failed', e));
    },

    async setNote(listingId, note) {
      const { error } = await supabase
        .from('saved_listings')
        .update({ notes: note })
        .eq('user_id', user.id)
        .eq('listing_id', listingId);
      if (error) throw error;
    },

    async listAiNotes() {
      const { data, error } = await supabase
        .from('ai_notes')
        .select('listing_id, notes')
        .eq('user_id', user.id);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((r) => [r.listing_id as string, r.notes as AiNotes])
      );
    },

    async saveAiNotes(listingId, notes) {
      const { error } = await supabase
        .from('ai_notes')
        .upsert(
          { user_id: user.id, listing_id: listingId, notes },
          { onConflict: 'user_id,listing_id' }
        );
      if (error) throw error;
    },

    async getPreferences() {
      const { data, error } = await supabase
        .from('users')
        .select('home_city, default_work_address, default_prefs')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const prefs = (data.default_prefs ?? {}) as Pick<
        UserPreferences,
        'commuteMode' | 'weights' | 'monthlyIncome'
      >;
      return {
        homeCity: data.home_city ?? undefined,
        workAddress: data.default_work_address ?? undefined,
        commuteMode: prefs.commuteMode,
        weights: prefs.weights,
        monthlyIncome: prefs.monthlyIncome,
      };
    },

    async savePreferences(prefs) {
      // Mirror the name from auth metadata into public.users so the profile row
      // is self-describing (set at sign-up for email accounts, by Google for OAuth).
      const meta = user.user_metadata ?? {};
      const { error } = await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email,
          first_name: (meta.first_name as string | undefined) ?? null,
          last_name: (meta.last_name as string | undefined) ?? null,
          home_city: prefs.homeCity ?? null,
          default_work_address: prefs.workAddress ?? null,
          default_prefs: {
            commuteMode: prefs.commuteMode,
            weights: prefs.weights,
            monthlyIncome: prefs.monthlyIncome,
          },
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
    },

    async getReviews(listingId) {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ReviewRow[] | null ?? []).map(toReview);
    },

    async addReview(review: NewReview) {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          listing_id: review.listingId,
          user_id: user.id,
          stars: review.stars,
          text: review.text,
          lived_here_verified: review.livedHereVerified,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toReview(data as ReviewRow);
    },

    async listSearches() {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('id, name, criteria, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (r): SavedSearch => ({
          id: r.id as string,
          name: r.name as string,
          criteria: r.criteria as SearchCriteria,
          createdAt: r.created_at as string,
        })
      );
    },

    async saveSearch(name: string, criteria: SearchCriteria) {
      const { data, error } = await supabase
        .from('saved_searches')
        .insert({ user_id: user.id, name, criteria })
        .select('id, name, criteria, created_at')
        .single();
      if (error) throw error;
      return {
        id: data.id as string,
        name: data.name as string,
        criteria: data.criteria as SearchCriteria,
        createdAt: data.created_at as string,
      };
    },

    async deleteSearch(id: string) {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('user_id', user.id)
        .eq('id', id);
      if (error) throw error;
    },

    async listAddresses() {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('id, label, address, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (r): SavedAddress => ({
          id: r.id as string,
          label: r.label as string,
          address: r.address as string,
          createdAt: r.created_at as string,
        })
      );
    },

    async saveAddress(label: string, address: string) {
      const { data, error } = await supabase
        .from('saved_addresses')
        .insert({ user_id: user.id, label, address })
        .select('id, label, address, created_at')
        .single();
      if (error) throw error;
      return {
        id: data.id as string,
        label: data.label as string,
        address: data.address as string,
        createdAt: data.created_at as string,
      };
    },

    async deleteAddress(id: string) {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('user_id', user.id)
        .eq('id', id);
      if (error) throw error;
    },

    async getSocialProfile() {
      const { data, error } = await supabase
        .from('social_profiles')
        .select('roommate_opt_in, display_name, bio, age_range, move_in_month, budget_min, budget_max, contact_email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        roommateOptIn: Boolean(data.roommate_opt_in),
        displayName: data.display_name ?? undefined,
        bio: data.bio ?? undefined,
        ageRange: data.age_range ?? undefined,
        moveInMonth: data.move_in_month ?? undefined,
        budgetMin: data.budget_min ?? undefined,
        budgetMax: data.budget_max ?? undefined,
        contactEmail: data.contact_email ?? undefined,
      } satisfies SocialProfile;
    },

    async saveSocialProfile(profile: SocialProfile) {
      // Default the contact email to the account email so the reveal-on-accept
      // flow has something to hand over even if the user didn't type one.
      const { error } = await supabase.from('social_profiles').upsert(
        {
          user_id: user.id,
          roommate_opt_in: profile.roommateOptIn,
          display_name: profile.displayName ?? null,
          bio: profile.bio ?? null,
          age_range: profile.ageRange ?? null,
          move_in_month: profile.moveInMonth ?? null,
          budget_min: profile.budgetMin ?? null,
          budget_max: profile.budgetMax ?? null,
          contact_email: profile.contactEmail ?? user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      // Opting in: publish a fresh signal so matches appear immediately.
      // Opting out: clear the signal so nothing lingers in the pool.
      if (profile.roommateOptIn) {
        await refreshRoommateSignal();
      } else {
        await supabase
          .from('social_profiles')
          .update({ roommate_signal: null })
          .eq('user_id', user.id);
      }
    },
  };
}
