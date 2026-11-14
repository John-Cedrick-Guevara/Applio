import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
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

  it('is headed "Usage & limits" with the light and bold title', async () => {
    renderWithApp(<UsagePage />);
    const heading = await screen.findByRole('heading', { level: 1, name: 'Usage & limits' });
    expect(heading.querySelector('strong')).toHaveTextContent('& limits');
  });

  it('shows the token budget as a ten-block meter, with any use filling at least one block', async () => {
    const { container } = renderWithApp(<UsagePage />);
    await screen.findByText('55% of daily budget');
    const meter = container.querySelector('.tile-meter')!;
    expect(meter.querySelectorAll('span')).toHaveLength(10);
    expect(meter.querySelectorAll('span.on')).toHaveLength(6);
  });

  it('puts each summary figure on its own tinted card', async () => {
    renderWithApp(<UsagePage />);
    await screen.findByText('55% of daily budget');
    const tint = (label: string) => [...screen.getByText(label, { selector: '.tile-label' }).closest('.tile')!.classList].find((c) => c.startsWith('tile-tint-'));
    expect(tint('Claude tokens')).toBe('tile-tint-lavender');
    expect(tint('Applications sent')).toBe('tile-tint-pink');
    expect(tint('Avg tokens per application')).toBe('tile-tint-ice');
    expect(tint('Saved by answer bank')).toBe('tile-tint-amber');
  });

  it('gives the token meter its own value, the same percentage as the note beside it', async () => {
    renderWithApp(<UsagePage />);
    await screen.findByText('55% of daily budget');
    expect(screen.getByRole('meter', { name: 'Claude tokens used' })).toHaveAttribute('aria-valuenow', '55');
  });

  it('shows 0% and an empty meter, not NaN, when the budget is zero', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const zero = { ...api, getUsage: async (p: Parameters<typeof api.getUsage>[0]) => { const u = await api.getUsage(p); return { ...u, summary: { ...u.summary, tokenBudget: 0 } }; } };
    const { container } = renderWithApp(<UsagePage />, zero);
    expect(await screen.findByText('0% of daily budget')).toBeInTheDocument();
    expect(container.querySelectorAll('.tile-meter span.on')).toHaveLength(0);
  });
});
