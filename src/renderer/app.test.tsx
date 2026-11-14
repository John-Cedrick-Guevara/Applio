import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithApp } from '../test/render';
import { App } from './app';

afterEach(() => {
  window.location.hash = '';
});

describe('App shell', () => {
  it('has no banner above the pages, only the rail\'s activity block', async () => {
    window.location.hash = '#/applications';
    renderWithApp(<App />);
    expect(await screen.findByRole('link', { name: /Nothing running/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auto-send/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Engine status')).not.toBeInTheDocument();
  });
});

describe('App routing', () => {
  it('opens on the dashboard', async () => {
    window.location.hash = '';
    renderWithApp(<App />);
    await waitFor(() => expect(window.location.hash).toBe('#/dashboard'));
    expect(await screen.findByRole('heading', { level: 1, name: 'My job hunt' })).toBeInTheDocument();
  });

  it('redirects Find jobs and Add job to Get jobs', async () => {
    window.location.hash = '#/add-job';
    renderWithApp(<App />);
    await waitFor(() => expect(window.location.hash).toBe('#/get-jobs/paste'));
    window.location.hash = '#/find-jobs';
    await waitFor(() => expect(window.location.hash).toBe('#/get-jobs'));
  });

  it('redirects old Review links to the Inbox', async () => {
    window.location.hash = '#/review/j2';
    renderWithApp(<App />);
    await waitFor(() => expect(window.location.hash).toBe('#/inbox/j2'));
  });

  it('keeps a page mounted when only its route params change', async () => {
    window.location.hash = '#/inbox/j1';
    renderWithApp(<App />);
    // The sort is page state: a remount (the bug) would reset it to Best match first.
    await userEvent.selectOptions(await screen.findByLabelText('Sort'), 'oldest');
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/inbox\/j\d$/));
    await new Promise((r) => setTimeout(r, 50)); // let a remount happen if it's going to
    expect(screen.getByLabelText('Sort')).toHaveValue('oldest');
  });
});
