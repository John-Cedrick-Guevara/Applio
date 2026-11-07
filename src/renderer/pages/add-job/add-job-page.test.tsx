import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import AddJobPage from './add-job-page';

describe('AddJobPage', () => {
  it('explains what is missing before analyzing', async () => {
    renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze job' }));
    expect(screen.getByText('Paste the job post first.')).toBeInTheDocument();
  });

  it('says what is happening while the post is read and scored', async () => {
    const api = createMockApi({ latencyMs: 0 });
    // Held open, as a real 20–40 second analysis would be.
    vi.spyOn(api, 'analyzeJob').mockReturnValue(new Promise(() => {}));
    renderWithApp(<AddJobPage />, api);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze job' }));
    expect(screen.getByText(/Claude is reading and scoring the post/).closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Analyzing…' })).toHaveAttribute('aria-busy', 'true');
  });

  it('reads a pasted post, works out the channel and adds it to review', async () => {
    const { api } = renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze job' }));
    const result = await screen.findByRole('region', { name: 'Parsed job' });
    expect(result).toHaveTextContent('Senior TypeScript Engineer');
    expect(result).toHaveTextContent('Sends from your Gmail to hiring@brightline.example');
    expect(result).toHaveTextContent('Autonomous');
    expect((await api.listJobs()).some((j) => j.company === 'Brightline Studio')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Add to review queue' }));
    expect(await screen.findByText(/Added\. Claude is drafting/)).toBeInTheDocument();
    expect((await api.listJobs({ statuses: ['drafted'] })).some((j) => j.company === 'Brightline Studio')).toBe(true);
  });

  it('caps platform links at draft → approve', async () => {
    renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Paste link' }));
    await userEvent.type(screen.getByLabelText('Job link'), 'https://www.linkedin.com/jobs/view/1');
    await userEvent.click(screen.getByRole('button', { name: 'Analyze job' }));
    const result = await screen.findByRole('region', { name: 'Parsed job' });
    expect(result).toHaveTextContent('Manual handoff (assisted fill is off)');
    expect(result).toHaveTextContent('Draft → Approve');
  });
});
