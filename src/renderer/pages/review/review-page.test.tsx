import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import ReviewPage from './review-page';

const open = (id?: string) => renderWithApp(<ReviewPage params={id ? { id } : {}} />);

describe('ReviewPage', () => {
  it('lists drafts waiting on the operator, best match first', async () => {
    open();
    const queue = await screen.findByRole('region', { name: 'Queue' });
    const rows = within(queue).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    const first = within(rows[0]!).getByRole('link');
    expect(first).toHaveTextContent('Senior Backend Engineer');
    expect(first).toHaveAttribute('aria-current', 'true');
  });

  it('pauses automation and blocks manual runs', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Pause automation' }));
    expect(await screen.findByText(/Automation is paused/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  });
});