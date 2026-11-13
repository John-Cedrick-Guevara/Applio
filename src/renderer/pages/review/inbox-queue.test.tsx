import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Job } from '../../../shared/types';
import { InboxQueue } from './inbox-queue';
import { inboxTabs, type InboxSort } from './review-model';

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id, sourceId: 's', sourceName: 'Remote OK', company: `Co ${id}`, title: `Role ${id}`, url: '', location: '', employmentType: 'full-time',
  postedAt: '', status: 'drafted', channel: 'email', description: '', tags: [], strengths: [], gaps: [], applyTarget: 'acme.com',
  factsUsed: 0, tokensUsed: 0, score: 50, history: [{ status: 'found', at: '2026-11-10T00:00:00.000Z' }], ...over,
});

function queue(jobs: Job[], { currentId, drafting = [], sort = 'score' as InboxSort, onSort = vi.fn() } = {} as { currentId?: string; drafting?: Job[]; sort?: InboxSort; onSort?: (s: InboxSort) => void }) {
  return render(<InboxQueue tabs={inboxTabs(jobs, [], sort)} drafting={drafting} {...(currentId ? { currentId } : {})} sort={sort} onSort={onSort} />);
}
const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('InboxQueue', () => {
  it('opens on the most urgent tab with jobs, with a count on every tab', () => {
    queue([job('a'), job('b', { channel: 'custom' })]);
    expect(tab(/Approve/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Fix first/)).toHaveTextContent('0');
    expect(tab(/Hand off/)).toHaveTextContent('1');
    expect(within(screen.getByRole('tabpanel')).getByText('Role a')).toBeInTheDocument();
    expect(screen.queryByText('Role b')).not.toBeInTheDocument();
  });

  it('opens on the tab of the job in the URL', () => {
    queue([job('a'), job('b', { channel: 'custom' })], { currentId: 'b' });
    expect(tab(/Hand off/)).toHaveAttribute('aria-selected', 'true');
  });

  it('switches tabs', async () => {
    queue([job('a'), job('b', { channel: 'custom' })]);
    await userEvent.click(tab(/Hand off/));
    expect(within(screen.getByRole('tabpanel')).getByText('Role b')).toBeInTheDocument();
  });

  it('shows one line per job with a label only for exceptions', () => {
    queue([job('a', { suspicious: 'It addresses AI tools.' }), job('u', { status: 'approved' })]);
    const rows = within(screen.getByRole('tabpanel')).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Check post');
    expect(rows[1]).toHaveTextContent('Not sent');
    expect(rows[0]).toHaveTextContent('Role a · Co a');
  });

  it('keeps the full title available when a long one is cut to one line', () => {
    queue([job('a', { title: 'Full-Stack Engineer (Backend Leaning) - Payments Engineering' })]);
    expect(screen.getByRole('link', { name: /Full-Stack Engineer/ })).toHaveAttribute('title', 'Full-Stack Engineer (Backend Leaning) - Payments Engineering · Co a');
  });

  it('sorts by best match or oldest', async () => {
    const onSort = vi.fn();
    queue([job('a')], { onSort });
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'oldest');
    expect(onSort).toHaveBeenCalledWith('oldest');
  });

  it('lists jobs Claude is drafting, each linked', () => {
    queue([job('a')], { drafting: [job('d', { status: 'scored', title: 'Data Engineer' })] });
    const drafting = screen.getByRole('list', { name: 'Drafting now' });
    expect(within(drafting).getByRole('link', { name: /Data Engineer/ })).toHaveAttribute('href', '#/inbox/d');
  });

  it('points an empty tab to the next one with jobs', async () => {
    queue([job('a', { channel: 'custom' })]);
    await userEvent.click(tab(/Approve/));
    expect(screen.getByText('Approve is clear.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to Hand off' }));
    expect(tab(/Hand off/)).toHaveAttribute('aria-selected', 'true');
  });
});
