import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import GetJobsPage from './get-jobs-page';

afterEach(() => {
  window.location.hash = '';
});

describe('GetJobsPage', () => {
  it('opens on Scan sources and switches to Paste a job', async () => {
    renderWithApp(<GetJobsPage params={{}} />);
    expect(screen.getByRole('tab', { name: 'Scan sources' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('list', { name: 'Sources this scan checks' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Paste a job' }));
    expect(window.location.hash).toBe('#/get-jobs/paste');
  });

  it('opens on Paste a job from its link', async () => {
    renderWithApp(<GetJobsPage params={{ tab: 'paste' }} />);
    expect(screen.getByRole('tab', { name: 'Paste a job' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByLabelText('Job post')).toBeInTheDocument();
  });
});
