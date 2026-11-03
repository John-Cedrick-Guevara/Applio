import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import HandoffPage from './handoff-page';

const open = () => renderWithApp(<HandoffPage params={{ id: 'j3' }} />);

describe('HandoffPage', () => {
  it('walks through applying on the platform', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Apply to Ledgerly on LinkedIn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open on LinkedIn' })).toBeInTheDocument();
    expect(screen.getByText('How many years of experience do you have with Kubernetes?')).toBeInTheDocument();
  });

  it('copies an answer to the clipboard', async () => {
    const user = userEvent.setup();
    open();
    const buttons = await screen.findAllByRole('button', { name: /^Copy answer/ });
    await user.click(buttons[0]!);
    expect(await navigator.clipboard.readText()).toBe('4');
    expect(buttons[0]).toHaveTextContent('Copied');
  });

  it('logs the application once the operator is done', async () => {
    const { api } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as applied' }));
    expect(await screen.findByText(/Logged as applied via LinkedIn Easy Apply/)).toBeInTheDocument();
    expect((await api.getJob('j3')).status).toBe('applied');
  });

  it('records when the operator decided not to apply', async () => {
    const { api } = open();
    await userEvent.click(await screen.findByRole('button', { name: "I didn't apply" }));
    expect(await screen.findByText(/Marked as not applied/)).toBeInTheDocument();
    expect((await api.getJob('j3')).status).toBe('skipped');
  });
});
