import type { JobPreview } from '../types';

/**
 * Mock stand-in for AI job parsing: detects the apply channel from the text
 * the way the real pipeline will (SPEC F5), with canned role details.
 */
export function analyze(input: string): JobPreview {
  const s = input.toLowerCase();
  const email = input.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const sourceName = s.includes('linkedin') ? 'clipped from LinkedIn' : s.includes('facebook') ? 'pasted from Facebook' : s.includes('upwork') ? 'pasted from Upwork' : 'pasted by you';
  const base = {
    company: 'Brightline Studio',
    title: 'Senior TypeScript Engineer',
    sourceName,
    tags: ['Remote · Worldwide', 'Contract', '$60–75 / hour', 'Node.js · PostgreSQL · React'],
    score: 84,
    summary: 'Build the TypeScript back end and React dashboard for a small design-tooling studio. Contract, async, worldwide.',
    tokensUsed: 1_100,
  };

  if (/linkedin|indeed|jobstreet|upwork/.test(s)) {
    return { ...base, channel: 'platform', channelLabel: 'Platform apply', route: 'Manual handoff (assisted fill is off)', applyTarget: 'Platform apply', maxAutonomy: 'draft' };
  }
  if (/greenhouse|lever\.co|ashbyhq|workable/.test(s)) {
    return { ...base, channel: 'ats', channelLabel: 'Standard ATS form', route: 'Fills and submits in Applio’s own window', applyTarget: 'ATS form', maxAutonomy: 'autonomous' };
  }
  if (email) {
    return { ...base, channel: 'email', channelLabel: 'Email', route: `Sends from your Gmail to ${email}`, applyTarget: email, maxAutonomy: 'autonomous' };
  }
  return { ...base, channel: null, channelLabel: 'Not found in the post', route: 'Manual: reply to the post or message the poster yourself', applyTarget: 'Manual', maxAutonomy: 'draft' };
}
