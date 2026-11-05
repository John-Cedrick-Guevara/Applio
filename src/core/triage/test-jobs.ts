import type { DiscoveredJob } from '../jobs/source';

/** A plausible discovered job; tests override only what they're about. */
export const discovered = (over: Partial<DiscoveredJob> = {}): DiscoveredJob => ({
  sourceId: 'remotive', sourceName: 'Remotive', externalId: 'x1', company: 'Acme', title: 'Senior Backend Engineer',
  boardUrl: 'https://remotive.com/j/1', applyUrl: 'https://remotive.com/j/1', description: 'Build APIs.', location: 'Worldwide',
  postedAt: '2026-11-05T00:00:00.000Z', tags: [], remote: true, ...over,
});
