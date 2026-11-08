import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import { ReviewQueue } from './review-queue';

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id, sourceId: 's', sourceName: 'Remote OK', company: `Co ${id}`, title: `Role ${id}`, url: '', location: '', employmentType: 'full-time',
  postedAt: '', status: 'drafted', channel: 'custom', description: '', tags: [], strengths: [], gaps: [], applyTarget: 'acme.com',
  factsUsed: 0, tokensUsed: 0, score: 50, history: [], ...over,
});

const queue = (jobs: Job[], draftThreshold = 75) =>
  render(<ReviewQueue jobs={jobs} below={[]} waiting={[]} asking={[]} drafting={[]} toDraft={[]} draftThreshold={draftThreshold} />);

describe('ReviewQueue', () => {
  it('groups drafts by what to do next, with counts, and filters to one group', async () => {
    queue([job('a', { channel: 'email' }), job('b'), job('c')]);
    expect(screen.getByText('Ready to send (1)')).toBeInTheDocument();
    expect(screen.getByText('To hand off (2)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send 1' }));
    expect(screen.queryByText('To hand off (2)')).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Ready to send' })).getByText('Role a')).toBeInTheDocument();
  });

  it('shows a badge only for exceptions, not on every row', () => {
    queue([job('a'), job('b', { channel: 'email', suspicious: 'The post addresses AI tools directly.' })]);
    expect(screen.getByText('Check post')).toBeInTheDocument();
    expect(screen.queryByText('Ready to hand off')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft ready')).not.toBeInTheDocument();
  });

  it('suggests raising a low draft score when almost every match is drafted', () => {
    queue(Array.from({ length: 12 }, (_, i) => job(String(i))), 10);
    expect(screen.getByText(/Your draft score is 10, so almost every match gets a draft/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Raise it in Settings' })).toHaveAttribute('href', '#/settings');
  });

  it('stays quiet about the draft score when the queue is short or the score is high', () => {
    queue(Array.from({ length: 12 }, (_, i) => job(String(i))), 75);
    expect(screen.queryByText(/Your draft score is/)).not.toBeInTheDocument();
  });

  it('keeps the full title available when a long one is cut to one line', () => {
    queue([job('a', { title: 'Full-Stack Engineer (Backend Leaning) - Payments Engineering' })]);
    expect(screen.getByText('Full-Stack Engineer (Backend Leaning) - Payments Engineering')).toHaveAttribute('title', 'Full-Stack Engineer (Backend Leaning) - Payments Engineering');
  });
});
