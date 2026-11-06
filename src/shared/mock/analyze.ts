import { describeRoute } from '../apply-route';
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
    previewId: `preview-${s.length}`,
    company: 'Brightline Studio',
    title: 'Senior TypeScript Engineer',
    sourceName,
    tags: ['Remote · Worldwide', 'Contract', '$60–75 / hour', 'Node.js · PostgreSQL · React'],
    score: 84,
    summary: 'Build the TypeScript back end and React dashboard for a small design-tooling studio. Contract, async, worldwide.',
    tokensUsed: 1_100,
  };

  if (/linkedin|indeed|jobstreet|upwork/.test(s)) {
    return { ...base, channel: 'platform', ...describeRoute('platform', 'Platform apply'), applyTarget: 'Platform apply' };
  }
  if (/greenhouse|lever\.co|ashbyhq|workable/.test(s)) {
    return { ...base, channel: 'ats', ...describeRoute('ats', 'ATS form'), applyTarget: 'ATS form' };
  }
  if (email) {
    return { ...base, channel: 'email', ...describeRoute('email', email), applyTarget: email };
  }
  return { ...base, channel: null, ...describeRoute(null, 'Manual'), applyTarget: 'Manual' };
}
