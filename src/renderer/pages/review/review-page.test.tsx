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

  it('shows the selected draft with fit, gaps and the cover letter', async () => {
    open('j2');
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByRole('heading', { name: 'Full-stack Engineer (TypeScript)' })).toBeInTheDocument();
    expect(within(detail).getByText('GraphQL: one small project only')).toBeInTheDocument();
    expect(within(detail).getByText(/Hi Fieldwork team/)).toBeInTheDocument();
  });

  it('switches between the letter, resume and original post', async () => {
    open('j1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Resume' }));
    expect(screen.getByText(/p95 query time dropped/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Original post' }));
    expect(screen.getByText(/Apply: email jobs@northwind-labs.example/)).toBeInTheDocument();
  });

  it('sends an email application on approval', async () => {
    const { api } = open('j1');
    await userEvent.click(await screen.findByRole('button', { name: 'Approve & send email' }));
    expect(await screen.findByText(/Sent to jobs@northwind-labs.example/)).toBeInTheDocument();
    expect((await api.getJob('j1')).status).toBe('applied');
  });

  it('routes platform jobs to the manual handoff', async () => {
    open('j3');
    expect(await screen.findByRole('link', { name: 'Open handoff' })).toHaveAttribute('href', '#/handoff/j3');
  });

  it('saves an edited cover letter and labels it', async () => {
    const { api } = open('j1');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText('Edit cover letter');
    await userEvent.clear(box);
    await userEvent.type(box, 'Short and sweet');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Edited by you')).toBeInTheDocument();
    expect((await api.getDraft('j1'))?.coverLetter).toBe('Short and sweet');
  });

  it('pauses automation and blocks manual runs', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Pause automation' }));
    expect(await screen.findByText(/Automation is paused/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  });
});
