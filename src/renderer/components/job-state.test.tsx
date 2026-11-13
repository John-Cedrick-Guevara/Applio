import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Callout, JobStateCard, StatusChip, StepList, Stepper } from './job-state';
import { ConfirmDialog } from './confirm-dialog';

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

describe('ConfirmDialog', () => {
  const open = () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog title='Skip job "Platform Engineer" at Ledgerly?' confirmLabel="Skip job" onConfirm={onConfirm} onCancel={onCancel}>It leaves your queue.</ConfirmDialog>);
    return { onConfirm, onCancel, dialog: screen.getByRole('dialog', { name: 'Skip job "Platform Engineer" at Ledgerly?' }) };
  };

  it('starts on Cancel, so Enter never confirms by accident', () => {
    open();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('cancels on Escape without confirming', async () => {
    const { onConfirm, onCancel } = open();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', async () => {
    open();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Skip job' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms with the named action', async () => {
    const { onConfirm, dialog } = open();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Skip job' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('gives focus back to what opened it once closed', () => {
    render(<button type="button">Skip job</button>);
    const trigger = screen.getByRole('button', { name: 'Skip job' });
    trigger.focus();
    const { unmount } = render(<ConfirmDialog title="Skip?" confirmLabel="Skip job" onConfirm={() => {}} onCancel={() => {}}>x</ConfirmDialog>);
    unmount();
    expect(trigger).toHaveFocus();
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
