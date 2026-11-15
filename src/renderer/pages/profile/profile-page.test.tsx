import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import ProfilePage from './profile-page';

const tab = (name: RegExp) => userEvent.click(screen.getByRole('tab', { name }));

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

  describe('fact bank filter', () => {
    const filter = (name: RegExp) => screen.getByRole('button', { name });

    it('opens on All with counts, and narrows to one kind', async () => {
      renderWithApp(<ProfilePage />);
      await screen.findByRole('heading', { name: '[Previous Company] — Senior Software Engineer' });
      expect(filter(/^All/)).toHaveAttribute('aria-pressed', 'true');
      expect(filter(/^Projects/)).toHaveAccessibleName('Projects, 1 fact');
      await userEvent.click(filter(/^Projects/));
      expect(filter(/^Projects/)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: '[Previous Company] — Senior Software Engineer' })).not.toBeInTheDocument();
    });

    it('shows the same total on the Fact bank tab and the All filter', async () => {
      renderWithApp(<ProfilePage />);
      const total = (await screen.findByRole('button', { name: /^All/ })).querySelector('.tab-count')!.textContent;
      expect(screen.getByRole('tab', { name: /^Fact bank/ }).querySelector('.tab-count')).toHaveTextContent(total!);
    });

    it('says what is missing and what to do when a filter is empty', async () => {
      const api = createMockApi({ latencyMs: 0 });
      await api.deleteFact('f6'); // the only project fact
      renderWithApp(<ProfilePage />, api);
      await userEvent.click(await screen.findByRole('button', { name: /^Projects/ }));
      expect(screen.getByText("No projects yet. Set a section's kind to Project with its Edit section button.")).toBeInTheDocument();
    });

    it('keeps the filter after editing a fact', async () => {
      renderWithApp(<ProfilePage />);
      await userEvent.click(await screen.findByRole('button', { name: /^Projects/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit fact' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(filter(/^Projects/)).toHaveAttribute('aria-pressed', 'true');
    });

    it('preselects a section of the active kind when adding a fact', async () => {
      renderWithApp(<ProfilePage />);
      await userEvent.click(await screen.findByRole('button', { name: /^Projects/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Add fact' }));
      expect(screen.getByLabelText('Add to')).toHaveValue('Projects');
    });

    it('adds, de-duplicates and removes skills', async () => {
      const { api } = renderWithApp(<ProfilePage />);
      await userEvent.click(await screen.findByRole('button', { name: /^Skills/ }));
      await userEvent.type(screen.getByLabelText('New skill'), 'Rust{Enter}');
      expect(await screen.findByText('Rust')).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('New skill'), 'rust{Enter}');
      expect((await api.getProfile()).skills.filter((x) => x.toLowerCase() === 'rust')).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', { name: 'Remove Rust' }));
      await waitFor(async () => expect((await api.getProfile()).skills).not.toContain('Rust'));
    });

    it('refuses an empty skill', async () => {
      renderWithApp(<ProfilePage />);
      await userEvent.click(await screen.findByRole('button', { name: /^Skills/ }));
      await userEvent.type(screen.getByLabelText('New skill'), '{Enter}');
      expect(screen.getByRole('alert')).toHaveTextContent('Write a skill first.');
    });
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
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Preferences/);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit preferences' }));
    const roles = screen.getByLabelText(/Target roles/);
    await userEvent.clear(roles);
    await userEvent.type(roles, 'Staff Engineer, Tech Lead');
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText('Tech Lead')).toBeInTheDocument();
    expect((await api.getProfile()).preferences.targetRoles).toEqual(['Staff Engineer', 'Tech Lead']);
  });

  it('edits work type and remote-only, and saves pay with its currency and period', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Preferences/);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit preferences' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Freelance' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Remote only' }));
    await userEvent.clear(screen.getByLabelText('Minimum pay amount'));
    await userEvent.type(screen.getByLabelText('Minimum pay amount'), '30000');
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'PHP');
    await userEvent.selectOptions(screen.getByLabelText('Per'), 'month');
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    const saved = await waitFor(async () => {
      const p = (await api.getProfile()).preferences;
      expect(p.minimumPay).toBe('30,000 PHP / month');
      return p;
    });
    // The seed has all three types and remote-only on; one click turns each off.
    expect(saved.employmentTypes).toEqual(['full-time', 'contract']);
    expect(saved.remoteOnly).toBe(false);
  });

  it('asks for a currency and period when the saved minimum pay has neither', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.savePreferences({ ...(await api.getProfile()).preferences, minimumPay: '30,000' });
    renderWithApp(<ProfilePage />, api);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Preferences/);
    expect(await screen.findByText(/Pick a currency and period so Applio can compare pay/)).toBeInTheDocument();
  });

  it('saves contact details and links for the résumé header', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Résumé/);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit contact and links' }));
    const phone = screen.getByLabelText('Phone');
    await userEvent.clear(phone);
    await userEvent.type(phone, '+63 954 115 2016');
    const links = screen.getByLabelText(/Links/);
    await userEvent.clear(links);
    await userEvent.type(links, 'Portfolio https://guevix.com{enter}LinkedIn https://linkedin.com/in/x');
    await userEvent.click(screen.getByRole('button', { name: 'Save contact and links' }));
    expect(await screen.findByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://linkedin.com/in/x');
    expect((await api.getProfile()).contact).toMatchObject({ phone: '+63 954 115 2016', links: [{ label: 'Portfolio', url: 'https://guevix.com' }, { label: 'LinkedIn', url: 'https://linkedin.com/in/x' }] });
  });

  it('points at a link line with no web address instead of saving', async () => {
    renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Résumé/);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit contact and links' }));
    const links = screen.getByLabelText(/Links/);
    await userEvent.clear(links);
    await userEvent.type(links, 'GitHub github.com/x');
    await userEvent.click(screen.getByRole('button', { name: 'Save contact and links' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Line 1 needs a label and a link starting with https://');
  });

  it("edits a section's kind, dates, context and link", async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit section Projects' }));
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'project');
    await userEvent.type(screen.getByLabelText('Context line'), 'Offline-first desktop app. Electron, SQLite.');
    await userEvent.type(screen.getByLabelText('Link'), 'https://example.com/app');
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(await screen.findByText('Offline-first desktop app. Electron, SQLite.')).toBeInTheDocument();
    expect((await api.getProfile()).factGroups.find((g) => g.name === 'Projects')).toEqual({ name: 'Projects', kind: 'project', context: 'Offline-first desktop app. Electron, SQLite.', link: 'https://example.com/app' });
  });

  it('imports a résumé and adds only the suggested facts the operator accepts', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Résumé/);
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    const review = await screen.findByRole('region', { name: 'Facts found in resume.pdf' });
    expect(screen.getByText(/found 2 facts/)).toBeInTheDocument();
    expect(screen.getByText('Found 2 new facts in resume.pdf. Add the ones that are right.')).toBeInTheDocument();
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
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Résumé/);
    await userEvent.click(await screen.findByRole('button', { name: 'Preview template' }));
    const preview = screen.getByRole('region', { name: 'Resume template preview' });
    // The locked layout with the operator's own sections and dates.
    expect(within(preview).getByText('EXPERIENCE')).toBeInTheDocument();
    expect(within(preview).getByText('2022 – now')).toBeInTheDocument();
  });

  it('shows four pill tabs, opens on the fact bank, and puts each section under its own tab', async () => {
    renderWithApp(<ProfilePage />);
    const tabs = within(await screen.findByRole('tablist', { name: 'Profile sections' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(['Fact bank', 'Answer bank', 'Preferences', 'Résumé']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Edit preferences' })).not.toBeInTheDocument();
    await tab(/^Preferences/);
    expect(screen.getByRole('button', { name: 'Edit preferences' })).toBeInTheDocument();
    await tab(/^Résumé/);
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
  });

  it('offers Add fact and Add answer only on their own tabs', async () => {
    renderWithApp(<ProfilePage />);
    expect(await screen.findByRole('button', { name: 'Add fact' })).toBeInTheDocument();
    await tab(/^Answer bank/);
    expect(screen.getByRole('button', { name: 'Add answer' })).toBeInTheDocument();
    await tab(/^Preferences/);
    expect(screen.queryByRole('button', { name: /^Add (fact|answer)$/ })).not.toBeInTheDocument();
  });

  it('keeps the résumé suggestions while the operator looks at another tab', async () => {
    renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Résumé/);
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await screen.findByRole('region', { name: 'Facts found in resume.pdf' });
    await tab(/^Fact bank/);
    await tab(/^Résumé/);
    expect(screen.getByRole('region', { name: 'Facts found in resume.pdf' })).toBeInTheDocument();
  });

  it('keeps a half-typed new fact while the operator looks at another tab', async () => {
    renderWithApp(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add fact' }));
    await userEvent.type(screen.getByRole('textbox', { name: /fact/i }), 'Led a team of six');
    await tab(/^Preferences/);
    await tab(/^Fact bank/);
    expect(screen.getByRole('textbox', { name: /fact/i })).toHaveValue('Led a team of six');
  });

  it('keeps every accepted résumé suggestion in the fact bank and its count', async () => {
    const { api } = renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    const before = (await api.getProfile()).facts.length;
    await tab(/^Résumé/);
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    const review = await screen.findByRole('region', { name: 'Facts found in resume.pdf' });
    // The row's button is busy while a save runs, so a second accept waits for the first.
    await userEvent.click(within(review).getAllByRole('button', { name: 'Add to fact bank' })[0]!);
    await screen.findByText('1 added to your Fact bank.');
    await userEvent.click(within(review).getAllByRole('button', { name: 'Add to fact bank' })[0]!);
    await waitFor(async () => expect((await api.getProfile()).facts).toHaveLength(before + 2));
    expect(screen.getByRole('tab', { name: /^Fact bank/ })).toHaveTextContent(String(before + 2));
  });

  it('says where an accepted résumé suggestion went', async () => {
    renderWithApp(<ProfilePage />);
    await screen.findByRole('tab', { name: /^Fact bank/ });
    await tab(/^Résumé/);
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    const review = await screen.findByRole('region', { name: 'Facts found in resume.pdf' });
    await userEvent.click(within(review).getAllByRole('button', { name: 'Add to fact bank' })[0]!);
    expect(await screen.findByText('1 added to your Fact bank.')).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys, labelling each panel by its tab', async () => {
    renderWithApp(<ProfilePage />);
    const first = await screen.findByRole('tab', { name: /^Fact bank/ });
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Answer bank/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Answer bank/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /^Résumé/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Fact bank/ })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', first.id);
  });
});
