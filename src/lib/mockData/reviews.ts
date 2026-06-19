/**
 * Mock first-party reviews. These exist from day one even though early ratings
 * lean on scraped/API sources — the schema supports the cold-start handoff to
 * platform reviews. `livedHereVerified` marks the high-trust reviews from users
 * who found their place through the platform.
 */
import type { Review } from '../types';

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-001',
    listingId: 'sf-001',
    userId: 'user-aaa',
    stars: 5,
    text: 'Lived here two years — landlord is responsive and the Mission location is unbeatable for restaurants.',
    livedHereVerified: true,
    createdAt: '2025-11-02T18:30:00Z',
  },
  {
    id: 'rev-002',
    listingId: 'sf-001',
    userId: 'user-bbb',
    stars: 4,
    text: 'Great unit, a bit of street noise on the weekends but the in-unit laundry is a lifesaver.',
    livedHereVerified: false,
    createdAt: '2025-09-14T12:00:00Z',
  },
  {
    id: 'rev-003',
    listingId: 'sf-002',
    userId: 'user-ccc',
    stars: 5,
    text: 'Doorman building right by the ballpark. Gym is well kept. Worth the premium.',
    livedHereVerified: true,
    createdAt: '2026-01-20T09:15:00Z',
  },
  {
    id: 'rev-004',
    listingId: 'ny-001',
    userId: 'user-ddd',
    stars: 4,
    text: 'Williamsburg at its best. Rooftop has skyline views. Walls are a little thin.',
    livedHereVerified: true,
    createdAt: '2025-12-05T20:45:00Z',
  },
  {
    id: 'rev-005',
    listingId: 'atx-001',
    userId: 'user-eee',
    stars: 5,
    text: 'East Austin gem. Found it through the platform and the move-in was smooth.',
    livedHereVerified: true,
    createdAt: '2026-02-11T16:00:00Z',
  },
  {
    id: 'rev-006',
    listingId: 'atx-001',
    userId: 'user-fff',
    stars: 4,
    text: 'Patio is great for the dog. Parking can fill up on busy nights.',
    livedHereVerified: false,
    createdAt: '2025-10-22T14:20:00Z',
  },
];
