import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithApp } from '../test/render';
import { App } from './app';

afterEach(() => {
  window.location.hash = '';
});

describe('App routing', () => {
  it('keeps a page mounted when only its route params change', async () => {
    window.location.hash = '#/review';
    renderWithApp(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Skip job' }));
    await waitFor(() => expect(window.location.hash).toBe('#/review/j2'));
    await new Promise((r) => setTimeout(r, 50)); // let a remount (the bug) happen if it's going to
    // The skipped draft stays in the live queue, marked Skipped, instead of the page reloading.
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).getAllByRole('listitem')).toHaveLength(4);
    expect(within(queue).getByText('Skipped')).toBeInTheDocument();
  });
});
