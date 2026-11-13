import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import { App } from '../../app';
import GetJobsPage from './get-jobs-page';

afterEach(() => {
  window.location.hash = '';
});

// Hidden panels have no accessible name in Testing Library, so they're found by their label.
const panel = (label: string) => screen.getAllByRole('tabpanel', { hidden: true }).find((p) => p.getAttribute('aria-label') === label)!;

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

  it('keeps a running scan on screen while the operator looks at the other tab', async () => {
    const api = createMockApi({ latencyMs: 0 });
    let finish: () => void = () => {};
    const slow = { ...api, runDiscovery: () => new Promise<Awaited<ReturnType<typeof api.runDiscovery>>>((resolve) => { finish = () => void api.runDiscovery().then(resolve); }) };
    window.location.hash = '#/get-jobs';
    renderWithApp(<App />, slow);
    await userEvent.click(await screen.findByRole('button', { name: 'Start scan' }));
    expect(await screen.findByRole('region', { name: 'Scan in progress' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Paste a job' }));
    await screen.findByLabelText('Job post');
    // The scan's panel stays mounted but hidden, so assistive tech and sighted users see only the Paste tab.
    expect(panel('Scan sources')).not.toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Scan sources' }));
    expect(panel('Paste a job')).not.toBeVisible();
    expect(await screen.findByRole('region', { name: 'Scan in progress' })).toBeInTheDocument();
    await act(async () => finish());
  });
});
