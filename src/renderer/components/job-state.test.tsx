import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Callout, JobStateCard, StatusChip, StepList, Stepper } from './job-state';

describe('StatusChip', () => {
  it('says the state in words, never by color alone', () => {
    render(<StatusChip tone="failed">PDFs didn't save</StatusChip>);
    expect(screen.getByText("PDFs didn't save")).toHaveClass('status-chip', 'status-chip-failed');
  });
});

describe('Callout', () => {
  it('announces a failure as an alert with its next step', async () => {
    const retry = vi.fn();
    render(<Callout tone="failed" title="PDFs didn't save." action={{ label: 'Retry saving PDFs', onClick: retry }}>The draft is safe.</Callout>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("PDFs didn't save. The draft is safe.");
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry saving PDFs' }));
    expect(retry).toHaveBeenCalled();
  });

  it('announces other states politely', () => {
    render(<Callout tone="done" title="Ready to send.">PDFs saved.</Callout>);
    expect(screen.getByRole('status')).toHaveTextContent('Ready to send. PDFs saved.');
  });
});

describe('Stepper', () => {
  it('marks the step the job is on, and says when it is blocked', () => {
    render(<Stepper label="Progress" steps={[{ label: 'Found', state: 'done' }, { label: 'Scored', state: 'blocked' }, { label: 'Drafted', state: 'todo' }]} />);
    const steps = within(screen.getByRole('list', { name: 'Progress' })).getAllByRole('listitem');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).toHaveAccessibleName('Scored: needs you');
    expect(steps[0]).toHaveAccessibleName('Found: done');
    expect(steps[2]).not.toHaveAttribute('aria-current');
  });
});

describe('StepList', () => {
  it('lists each stage with its state', () => {
    render(<StepList label="Drafting steps" steps={[{ label: 'Claude drafting', state: 'done' }, { label: 'Saving PDFs', state: 'active', note: '0:42' }]} />);
    const list = screen.getByRole('list', { name: 'Drafting steps' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Claude draftingDone', 'Saving PDFs0:42']);
  });
});

describe('StepList pending step', () => {
  it("gives a pending step's dot its own class, so the row keeps its width", () => {
    render(<StepList label="Drafting steps" steps={[{ label: 'Write', state: 'active' }, { label: 'Save the PDFs', state: 'pending' }]} />);
    const row = screen.getByText('Save the PDFs').closest('li')!;
    expect(row).toHaveClass('step-list-pending');
    expect(row.querySelector('.step-list-dot')).not.toBeNull();
    expect(row.querySelector('.step-list-pending')).toBeNull();
  });
});

describe('JobStateCard', () => {
  it('says what is true, why, and what happens next, with its action', async () => {
    const onRetry = vi.fn();
    render(
      <JobStateCard card={{ tone: 'failed', title: 'Not sent.', body: 'Gmail rejected the app password.' }} next="It stays in the Inbox until it sends or you skip it." notes={[]}>
        <button type="button" onClick={onRetry}>Retry send</button>
      </JobStateCard>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Not sent. Gmail rejected the app password.');
    expect(screen.getByText(/It stays in the Inbox until it sends/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry send' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('is a polite status unless something failed', () => {
    render(<JobStateCard card={{ tone: 'done', title: 'Ready to approve.', body: 'PDFs saved.' }} notes={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Ready to approve.');
  });

  it('folds the other states under More notes, with a count', async () => {
    render(<JobStateCard card={{ tone: 'failed', title: 'Check post.', body: 'x' }} notes={['Made from an older profile.', 'Saving the PDFs.']} />);
    const more = screen.getByText('2 more notes');
    await userEvent.click(more);
    expect(screen.getByRole('list', { name: 'More notes' })).toHaveTextContent('Made from an older profile.');
  });

  it('leaves More notes out when nothing else applies', () => {
    render(<JobStateCard card={{ tone: 'done', title: 'Ready.', body: 'x' }} notes={[]} />);
    expect(screen.queryByText(/more note/)).not.toBeInTheDocument();
  });
});
