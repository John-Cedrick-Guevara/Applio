import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import ApplicationsPage from './applications-page';

const table = () => screen.findByRole('table');

describe('ApplicationsPage', () => {
  it('lists only applications that were sent', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    expect(within(t).getByText('Quanta Robotics')).toBeInTheDocument();
    expect(within(t).queryByText('Northwind Labs')).not.toBeInTheDocument();
  });

  it('filters by status group and search', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    await userEvent.click(screen.getByRole('button', { name: /^Closed/ }));
    expect(within(t).getByText('Brightwave')).toBeInTheDocument();
    expect(within(t).queryByText('Quanta Robotics')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search applications' }), 'zzz');
    expect(screen.getByText('No applications match')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(t).getByText('Quanta Robotics')).toBeInTheDocument();
  });

  it('shows the timeline and what was sent for the selected application', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Corvid Health/ }));
    const detail = screen.getByRole('complementary', { name: 'Application detail' });
    expect(within(detail).getByRole('heading', { name: 'Backend Engineer, Integrations' })).toBeInTheDocument();
    expect(within(detail).getByText('Found on Lever watchlist')).toBeInTheDocument();
    expect(await within(detail).findByText('resume.pdf')).toBeInTheDocument();
  });

  it('generates interview prep for replies and interviews', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Corvid Health/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Interview prep' }));
    expect(await screen.findByText('Likely questions')).toBeInTheDocument();
  });

  it('drafts and sends a follow-up when one is due', async () => {
    const { api } = renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Draft follow-up' }));
    expect((screen.getByLabelText('Follow-up to Tessellate') as HTMLTextAreaElement).value).toContain('Following up on my application');
    await userEvent.type(screen.getByLabelText('Follow-up to Tessellate'), ' Thanks!');
    expect((await api.getJob('j10')).history.at(-1)?.note).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Send follow-up' }));
    expect((await screen.findAllByText(/Follow-up sent/)).length).toBeGreaterThan(0);
    expect((await api.getJob('j10')).history.at(-1)?.note).toBe('Follow-up sent');
  });
});
