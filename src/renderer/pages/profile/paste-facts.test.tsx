import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ApplioApi } from '../../../shared/api';
import { createMockApi } from '../../../shared/mock/mock-api';
import type { FactExtraction, FactSource } from '../../../shared/types';
import { renderWithApp } from '../../../test/render';
import ProfilePage from './profile-page';

const EMPTY: FactExtraction = { suggestions: [], dropped: 0, alreadyInBank: 0, tokensUsed: 0 };
const FOUND: FactExtraction = {
  suggestions: [
    { group: 'Acme — Engineer', kind: 'experience', text: 'Cut p95 query time from 900 ms to 120 ms.' },
    { group: 'Side project', kind: 'project', text: 'Built an offline-first notes app.' },
    { group: 'Skills', kind: 'skills', text: 'Rust' },
  ],
  dropped: 2, alreadyInBank: 1, tokensUsed: 900,
};

/** The mock API with `extractFacts` answering as the test says, and a record of what was asked. */
const withExtraction = (answer: () => Promise<FactExtraction>) => {
  const asked: FactSource[] = [];
  const base = createMockApi({ latencyMs: 0 });
  const api: ApplioApi = { ...base, extractFacts: async (source) => (asked.push(source), answer()) };
  return { api, asked };
};

const open = async (api: ApplioApi) => {
  const view = renderWithApp(<ProfilePage />, api);
  await userEvent.click(await screen.findByRole('tab', { name: /^Résumé/ }));
  return view;
};
const paste = async (value: string) => {
  await userEvent.type(screen.getByLabelText('Résumé text or portfolio link'), value);
  await userEvent.click(screen.getByRole('button', { name: 'Find facts' }));
};
const row = (text: string) => screen.getByDisplayValue(text).closest('li')!;

describe('paste facts', () => {
  it('asks for something to read, and sends nothing when the box is empty', async () => {
    const { api, asked } = withExtraction(async () => EMPTY);
    await open(api);
    await userEvent.click(screen.getByRole('button', { name: 'Find facts' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Paste your résumé text or a portfolio link first.');
    expect(asked).toEqual([]);
  });

  it('sends a lone https address as a link and anything else as text', async () => {
    const { api, asked } = withExtraction(async () => EMPTY);
    await open(api);
    await paste('https://jane.dev/portfolio');
    await waitFor(() => expect(asked).toEqual([{ kind: 'link', value: 'https://jane.dev/portfolio' }]));
    await userEvent.clear(screen.getByLabelText('Résumé text or portfolio link'));
    await paste('Built things at https://jane.dev');
    await waitFor(() => expect(asked[1]).toEqual({ kind: 'text', value: 'Built things at https://jane.dev' }));
  });

  it('lists suggestions with section and kind, and says what was dropped or already there', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('my résumé');
    const first = await screen.findByDisplayValue('Cut p95 query time from 900 ms to 120 ms.');
    expect(within(first.closest('li')!).getByLabelText('Section')).toHaveValue('Acme — Engineer');
    expect(within(first.closest('li')!).getByLabelText('Kind')).toHaveValue('experience');
    expect(screen.getByText('2 suggestions dropped: not found in your text.')).toBeInTheDocument();
    expect(screen.getByText('1 already in your fact bank.')).toBeInTheDocument();
  });

  it('adds a fact to the bank, creating its section with the chosen kind, and cannot add it twice', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('my résumé');
    const item = row('Built an offline-first notes app.');
    await userEvent.click(within(item).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(within(item).getByText('Added')).toBeInTheDocument());
    expect(within(item).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    const profile = await api.getProfile();
    expect(profile.facts.filter((f) => f.text === 'Built an offline-first notes app.')).toHaveLength(1);
    expect(profile.factGroups.find((g) => g.name === 'Side project')?.kind).toBe('project');
  });

  it('keeps the kind of a section that already has one', async () => {
    const { api } = withExtraction(async () => ({ ...EMPTY, suggestions: [{ group: 'Projects', kind: 'experience', text: 'Wrote a parser.' }] }));
    await open(api);
    await paste('x');
    await userEvent.click(within(row('Wrote a parser.')).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await api.getProfile()).facts.some((f) => f.text === 'Wrote a parser.')).toBe(true));
    expect((await api.getProfile()).factGroups.find((g) => g.name === 'Projects')?.kind).toBe('project');
  });

  it('adds what the operator edited, in the section they chose', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('x');
    const item = row('Built an offline-first notes app.');
    const text = within(item).getByLabelText('Fact');
    await userEvent.clear(text);
    await userEvent.type(text, 'Built a notes app.');
    await userEvent.clear(within(item).getByLabelText('Section'));
    await userEvent.type(within(item).getByLabelText('Section'), 'Projects');
    await userEvent.click(within(item).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await api.getProfile()).facts.find((f) => f.text === 'Built a notes app.')?.group).toBe('Projects'));
  });

  it('adds a skills suggestion to Skills, not to the facts', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('x');
    await userEvent.click(within(row('Rust')).getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await api.getProfile()).skills).toContain('Rust'));
    expect((await api.getProfile()).facts.some((f) => f.text === 'Rust')).toBe(false);
  });

  it('skips a suggestion without adding it', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('x');
    await userEvent.click(within(row('Rust')).getByRole('button', { name: 'Skip' }));
    expect(screen.queryByDisplayValue('Rust')).not.toBeInTheDocument();
    expect((await api.getProfile()).skills).not.toContain('Rust');
  });

  it('adds every remaining suggestion once, and a second Add all finds nothing left', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('x');
    await userEvent.click(within(row('Built an offline-first notes app.')).getByRole('button', { name: 'Skip' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add all' }));
    await waitFor(async () => expect((await api.getProfile()).skills).toContain('Rust'));
    const profile = await api.getProfile();
    expect(profile.facts.filter((f) => f.text.startsWith('Cut p95'))).toHaveLength(1);
    expect(profile.facts.some((f) => f.text.startsWith('Built an offline'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Add all' })).not.toBeInTheDocument();
  });

  it('says nothing new was found instead of showing an empty list', async () => {
    const { api } = withExtraction(async () => ({ ...EMPTY, alreadyInBank: 3 }));
    await open(api);
    await paste('x');
    expect(await screen.findByText('Nothing new to add. 3 already in your fact bank.')).toBeInTheDocument();
  });

  it('warns that a link reading cannot be checked against the page', async () => {
    const { api } = withExtraction(async () => FOUND);
    await open(api);
    await paste('https://jane.dev');
    expect(await screen.findByText(/Claude read this page itself/)).toBeInTheDocument();
    expect(screen.queryByText(/not found in your text/)).not.toBeInTheDocument();
  });

  it('shows why it failed and what to do next, and lists nothing', async () => {
    const { api } = withExtraction(async () => { throw new Error('Reading a link needs Claude Code as the AI engine (Settings). Paste the page text instead.'); });
    await open(api);
    await paste('https://jane.dev');
    expect(await screen.findByRole('alert')).toHaveTextContent('Reading a link needs Claude Code');
    expect(screen.queryByRole('button', { name: 'Add all' })).not.toBeInTheDocument();
  });

  it('refuses text over the limit without calling the AI', async () => {
    const { api, asked } = withExtraction(async () => EMPTY);
    await open(api);
    const box = screen.getByLabelText('Résumé text or portfolio link');
    await userEvent.click(box);
    await userEvent.paste('x'.repeat(60_001));
    await userEvent.click(screen.getByRole('button', { name: 'Find facts' }));
    expect(screen.getByRole('alert')).toHaveTextContent('too long');
    expect(asked).toEqual([]);
  });
});
