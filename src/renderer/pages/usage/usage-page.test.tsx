import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import UsagePage from './usage-page';

const row = async (name: string, sub: RegExp) => {
  const guard = await screen.findByRole('table', { name: 'Free-limit guard' });
  return within(guard).getAllByRole('row').find((r) => r.textContent?.includes(name) && sub.test(r.textContent ?? ''))!;
};

describe('UsagePage', () => {
  it("summarizes today's spend against the budget", async () => {
    renderWithApp(<UsagePage />);
    const tile = (await screen.findByText('Claude tokens', { selector: '.tile-label' })).closest('.tile')!;
    expect(tile).toHaveTextContent('82k/ 150k');
    expect(tile).toHaveTextContent('55% of daily budget');
  });

  it('shows each free limit with its state', async () => {
    renderWithApp(<UsagePage />);
    expect(within(await row('Upwork API', /Requests per day/)).getByText('Warning')).toBeInTheDocument();
    expect(within(await row('Remotive', /Polls per day/)).getByText('Done for today')).toBeInTheDocument();
    expect(within(await row('JSearch', /Optional/)).getByText('Off')).toBeInTheDocument();
    expect(within(await row('Gmail sends', /Per day/)).getByRole('meter')).toHaveAttribute('aria-valuenow', '4');
  });

  it('shows how many jobs each filter dropped before AI, biggest first', async () => {
    renderWithApp(<UsagePage />);
    const list = await screen.findByRole('list', { name: 'Dropped by filter' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Above your level42', 'Outside your country18', 'Not a target role4']);
    expect(screen.getByText(/83 found · 0 already seen · 19 scored · 77% dropped for free/)).toBeInTheDocument();
  });

  it('switches to this month', async () => {
    renderWithApp(<UsagePage />);
    await screen.findByText('55% of daily budget');
    await userEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(await screen.findByText(/of monthly budget/)).toBeInTheDocument();
    expect(screen.getByText('This month, by pipeline step')).toBeInTheDocument();
  });

  it('describes the 7-day chart for screen readers', async () => {
    renderWithApp(<UsagePage />);
    expect(await screen.findByRole('img', { name: /^Tokens per day:/ })).toBeInTheDocument();
  });
});
