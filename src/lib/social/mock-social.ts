/**
 * In-browser fixtures for the social layer, used whenever Supabase isn't configured
 * (VITE_DATA_SOURCE=mock / guest demo). Keeps the Roommates and Agents pages fully
 * explorable with zero backend — same role the mock-data fixtures play for listings.
 */
import type { RoommateCandidate, RoommateConnection, AgentProfile } from './types';

export const MOCK_ROOMMATE_CANDIDATES: RoommateCandidate[] = [
  {
    userId: 'mock-u1',
    score: 88,
    displayName: 'Priya',
    ageRange: '25–29',
    moveInMonth: 'September',
    bio: 'Grad student, tidy, early riser. Looking to split a 2BR near campus.',
    budgetBand: [1800, 2400],
    sharedCities: ['Austin'],
    sharedNeighborhoods: ['Hyde Park', 'North Loop'],
  },
  {
    userId: 'mock-u2',
    score: 73,
    displayName: 'Marcus',
    ageRange: '30–34',
    moveInMonth: 'August',
    bio: 'Remote engineer, dog-friendly, loves cooking. Flexible on layout.',
    budgetBand: [2000, 2800],
    sharedCities: ['Austin'],
    sharedNeighborhoods: ['North Loop'],
  },
  {
    userId: 'mock-u3',
    score: 61,
    displayName: 'Dana',
    ageRange: '22–24',
    moveInMonth: 'September',
    bio: 'New to the city for a first job. Social but respects quiet hours.',
    budgetBand: [1600, 2100],
    sharedCities: ['Austin'],
    sharedNeighborhoods: [],
  },
];

export const MOCK_CONNECTIONS: RoommateConnection[] = [
  {
    id: 'mock-c1',
    otherUserId: 'mock-u4',
    direction: 'incoming',
    status: 'pending',
    displayName: 'Sam',
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'mock-c2',
    otherUserId: 'mock-u1',
    direction: 'outgoing',
    status: 'accepted',
    displayName: 'Priya',
    contactEmail: 'priya@example.com',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export const MOCK_AGENTS: AgentProfile[] = [
  {
    userId: 'mock-a1',
    isAgent: true,
    displayName: 'Elena Ruiz',
    brokerage: 'Lone Star Realty',
    licenseNo: 'TX-0192837',
    cities: ['Austin', 'Round Rock'],
    bio: '12 years helping renters and first-time buyers across Central Texas.',
    photoUrl: undefined,
    contactEmail: 'elena@lonestar.example',
    bookingUrl: 'https://cal.example/elena',
    specialties: ['Rentals', 'First-time buyers', 'Relocation'],
    verified: true,
  },
  {
    userId: 'mock-a2',
    isAgent: true,
    displayName: 'Jordan Webb',
    brokerage: 'Urban Key',
    licenseNo: 'TX-0475621',
    cities: ['Austin'],
    bio: 'Downtown + east side specialist. Fast, no-pressure, text-friendly.',
    photoUrl: undefined,
    contactEmail: 'jordan@urbankey.example',
    bookingUrl: undefined,
    specialties: ['Condos', 'Luxury rentals'],
    verified: false,
  },
];
