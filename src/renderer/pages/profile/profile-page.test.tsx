import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApp } from '../../../test/render';
import ProfilePage from './profile-page';

describe('ProfilePage', () => {
  it('shows facts grouped by role with how often each was used', async () => {
    renderWithApp(<ProfilePage />);
    const group = (await screen.findByRole('heading', { name: '[Previous Company] — Senior Software Engineer' })).closest('section')!;
    expect(within(group).getByText(/p95 query time dropped/)).toBeInTheDocument();
    expect(within(group).getByText('used 14×')).toBeInTheDocument();
  });

  it('adds a fact to a chosen group', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add fact' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save fact' }));
    expect(screen.getByText('Write the fact first.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/New fact/), 'Cut cold start from 4s to 900ms.');
    await userEvent.selectOptions(screen.getByLabelText('Add to'), 'Projects');
    await userEvent.click(screen.getByRole('button', { name: 'Save fact' }));
    expect(await screen.findByText('Cut cold start from 4s to 900ms.')).toBeInTheDocument();
    expect((await api.getProfile()).facts.find((f) => f.text.startsWith('Cut cold'))?.group).toBe('Projects');
  });

  it('edits a fact inline and deletes one', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    const [edit] = await screen.findAllByRole('button', { name: 'Edit fact' });
    await userEvent.click(edit!);
    const input = screen.getByLabelText('Fact text');
    await userEvent.clear(input);
    await userEvent.type(input, 'Rewritten fact');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Rewritten fact')).toBeInTheDocument();

    const [editAgain] = screen.getAllByRole('button', { name: 'Edit fact' });
    await userEvent.click(editAgain!);
    await userEvent.click(screen.getByRole('button', { name: 'Delete fact' }));
    expect(await screen.findByText('Fact deleted')).toBeInTheDocument();
    expect((await api.getProfile()).facts.some((f) => f.text === 'Rewritten fact')).toBe(false);
  });

  it('lists saved answers and adds one', async () => {
    renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Answer bank/ }));
    expect(screen.getByText('AI, approved by you')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add answer' }));
    await userEvent.type(screen.getByLabelText('Question'), 'Earliest start date');
    await userEvent.click(screen.getByRole('button', { name: 'Save answer' }));
    expect(screen.getByText('Fill in both the question and the answer.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your answer'), 'Two weeks from offer');
    await userEvent.click(screen.getByRole('button', { name: 'Save answer' }));
    expect(await screen.findByText('Two weeks from offer')).toBeInTheDocument();
  });

  it('edits what the operator is looking for', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit preferences' }));
    const roles = screen.getByLabelText(/Target roles/);
    await userEvent.clear(roles);
    await userEvent.type(roles, 'Staff Engineer, Tech Lead');
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText('Tech Lead')).toBeInTheDocument();
    expect((await api.getProfile()).preferences.targetRoles).toEqual(['Staff Engineer', 'Tech Lead']);
  });

  it('imports a résumé and adds only the suggested facts the operator accepts', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    const review = await screen.findByRole('region', { name: 'Facts found in resume.pdf' });
    expect(screen.getByText(/found 2 facts/)).toBeInTheDocument();
    expect((await api.getProfile()).facts.some((f) => f.text.startsWith('Cut monthly AWS'))).toBe(false);

    const first = within(review).getByText(/Cut monthly AWS spend/).closest('li')!;
    await userEvent.click(within(first).getByRole('button', { name: 'Add to fact bank' }));
    expect(await screen.findByText('Cut monthly AWS spend by 30% by right-sizing ECS tasks.', { selector: '.fact-text' })).toBeInTheDocument();

    await userEvent.click(within(review).getByRole('button', { name: 'Dismiss the rest' }));
    expect(screen.queryByRole('region', { name: /Facts found/ })).not.toBeInTheDocument();
    const texts = (await api.getProfile()).facts.map((f) => f.text);
    expect(texts).toContain('Cut monthly AWS spend by 30% by right-sizing ECS tasks.');
    expect(texts).not.toContain('Maintain an open-source CLI for PostgreSQL migrations.');
  });

  it('toggles the ATS template preview', async () => {
    renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Preview template' }));
    expect(screen.getByRole('region', { name: 'Resume template preview' })).toBeInTheDocument();
  });
});
