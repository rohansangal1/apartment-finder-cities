/**
 * Supabase-backed UserStore (Phase 2). Reads/writes Postgres tables protected by
 * Row-Level Security, so a user only ever touches their own saved_listings,
 * preferences, and reviews — while reviews stay publicly readable.
 *
 * Factory takes the authenticated user id so every write is correctly scoped
 * (RLS enforces it server-side too; this keeps the client honest).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Review, NewReview, UserPreferences } from '../types';
import type { UserStore } from './types';

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
  return {
    async listSavedIds() {
      const { data, error } = await supabase
        .from('saved_listings')
        .select('listing_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.listing_id as string);
    },

    async setSaved(listingId, saved) {
      if (saved) {
        const { error } = await supabase
          .from('saved_listings')
          .upsert({ user_id: user.id, listing_id: listingId }, { onConflict: 'user_id,listing_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_listings')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId);
        if (error) throw error;
      }
    },

    async getPreferences() {
      const { data, error } = await supabase
        .from('users')
        .select('home_city, default_work_address, default_prefs')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const prefs = (data.default_prefs ?? {}) as Pick<UserPreferences, 'commuteMode' | 'weights'>;
      return {
        homeCity: data.home_city ?? undefined,
        workAddress: data.default_work_address ?? undefined,
        commuteMode: prefs.commuteMode,
        weights: prefs.weights,
      };
    },

    async savePreferences(prefs) {
      const { error } = await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email,
          home_city: prefs.homeCity ?? null,
          default_work_address: prefs.workAddress ?? null,
          default_prefs: { commuteMode: prefs.commuteMode, weights: prefs.weights },
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
  };
}
