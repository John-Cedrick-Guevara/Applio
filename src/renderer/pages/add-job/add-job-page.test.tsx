import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import AddJobPage from './add-job-page';

describe('AddJobPage', () => {
  it('explains what is missing before analyzing', async () => {
    renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze job' }));
    expect(screen.getByText('Paste the job post first.')).toBeInTheDocument();
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
    expect(await screen.findByText(/Added\. Drafting the resume/)).toBeInTheDocument();
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
