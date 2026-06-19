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
];
