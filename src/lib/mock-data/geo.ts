/**
 * Mock geocoding fixtures + city centroids. Phase 0 stand-in for
 * TravelTime/Google/Nominatim geocoding.
 *
 * KNOWN_ADDRESSES gives stable coordinates for a few common downtown work
 * addresses so the demo commute numbers feel realistic. Anything not listed
 * falls back to the city centroid (see geocode() in the mock client).
 */
import type { GeoPoint } from '../types';

export const CITY_CENTROIDS: Record<string, GeoPoint> = {
  'San Francisco': { lat: 37.7793, lng: -122.4193 },
  'New York': { lat: 40.7549, lng: -73.984 },
  Austin: { lat: 30.2672, lng: -97.7431 },
  Boston: { lat: 42.3601, lng: -71.0589 },
  Chicago: { lat: 41.8781, lng: -87.6298 },
  Seattle: { lat: 47.6062, lng: -122.3321 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
};

/** Lowercased substring match -> coordinates for well-known work locations. */
export const KNOWN_ADDRESSES: Array<{ match: string; lat: number; lng: number }> = [
  { match: 'salesforce tower', lat: 37.7897, lng: -122.3972 },
  { match: 'soma', lat: 37.7785, lng: -122.4056 },
  { match: 'financial district, san francisco', lat: 37.7946, lng: -122.4006 },
  { match: 'times square', lat: 40.758, lng: -73.9855 },
  { match: 'midtown', lat: 40.7549, lng: -73.984 },
  { match: 'wall street', lat: 40.7069, lng: -74.0089 },
  { match: 'downtown austin', lat: 30.2672, lng: -97.7431 },
  { match: 'the domain', lat: 30.4011, lng: -97.7259 },
  { match: 'back bay', lat: 42.3503, lng: -71.081 },
  { match: 'seaport', lat: 42.3519, lng: -71.0448 },
  { match: 'the loop', lat: 41.8786, lng: -87.63 },
  { match: 'river north', lat: 41.8925, lng: -87.634 },
  { match: 'south lake union', lat: 47.627, lng: -122.337 },
  { match: 'downtown seattle', lat: 47.605, lng: -122.332 },
  { match: 'downtown la', lat: 34.0407, lng: -118.2468 },
  { match: 'santa monica', lat: 34.0195, lng: -118.4912 },
];
