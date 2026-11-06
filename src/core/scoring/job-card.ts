import type { Job } from '../../shared/types';

/** Most of a posting's substance comes early; past this, it's repetition. */
const MAX_CHARS = 2_500;
/** A heading that opens a section scoring and drafting never need. */
const BOILERPLATE = /^(about (us|the company|[a-z0-9 .&-]{1,30})|who we are|our (story|mission|values|culture)|why (join|work)|what we offer|benefits|perks|compensation (and|&) benefits|equal (employment )?opportunit|eeo|diversity|accommodation|how to apply|privacy)/i;
/** A heading that opens a section worth keeping (the role, its requirements). */
const KEEP = /^(the role|about the (role|job|position)|role|responsibilities|what you('ll| will) do|requirements|qualifications|what you('ll| will) bring|skills|nice to have|bonus|preferred|must have|you have|you are|tech stack|stack)/i;

const isHeading = (line: string) => line.length <= 60 && !/[.!?]$/.test(line.trim()) && !line.trim().startsWith('-');

/**
 * A posting without its boilerplate: "About us", benefits, perks, how to apply
 * and equal-opportunity sections are dropped by their headings, for free, before
 * any token is spent (QA F5). What's left is capped, so a card stays small.
 */
export function essentialText(description: string): string {
  const kept: string[] = [];
  let skipping = false;
  for (const line of description.split('\n')) {
    const text = line.trim();
    if (isHeading(text) && BOILERPLATE.test(text) && !KEEP.test(text)) skipping = true;
    else if (isHeading(text) && KEEP.test(text)) skipping = false;
    if (!skipping) kept.push(line);
  }
  // A posting that's all "boilerplate" by heading still has to say something.
  const text = (kept.join('\n').trim() || description.trim());
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

/** One job as scoring sees it: the facts that decide a match, in a few hundred tokens. */
export function jobCard(job: Pick<Job, 'id' | 'company' | 'title' | 'location' | 'employmentType' | 'salary' | 'tags' | 'description'>) {
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    location: job.location,
    type: job.employmentType,
    ...(job.salary ? { pay: job.salary } : {}),
    tags: job.tags,
    posting: essentialText(job.description),
  };
}
