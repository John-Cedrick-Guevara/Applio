import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AppStatus } from '../../../shared/types';
import { createMockApi } from '../../../shared/mock/mock-api';
import { resumeBody } from '../../../shared/templates/application-documents';
import { renderWithApp } from '../../../test/render';
import ReviewPage from './review-page';

const open = (id?: string) => renderWithApp(<ReviewPage params={id ? { id } : {}} />);

describe('ReviewPage', () => {
  it('opens on the most urgent tab with jobs, best match first', async () => {
    open();
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).getByRole('tab', { name: /Approve/ })).toHaveAttribute('aria-selected', 'true');
    const rows = within(within(queue).getByRole('tabpanel')).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Senior Backend Engineer');
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
  });

  it('says nothing needs a decision when the Inbox is empty', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const empty = { ...api, listJobs: async (f?: Parameters<typeof api.listJobs>[0]) => (f?.statuses?.some((st) => st === 'drafted' || st === 'approved') ? [] : api.listJobs(f)) };
    renderWithApp(<ReviewPage params={{}} />, empty);
    expect(await screen.findByText('Nothing needs a decision')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Matches' })).toHaveAttribute('href', '#/matches');
  });

  it('has no undrafted or below-bar footers: those live in Matches', async () => {
    open();
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).queryByText(/not scored yet|below your draft bar/)).not.toBeInTheDocument();
    expect(within(queue).queryByRole('button', { name: /Show/ })).not.toBeInTheDocument();
  });

  it('shows the selected draft with fit, gaps and the cover letter', async () => {
    open('j2');
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByRole('heading', { name: 'Full-stack Engineer (TypeScript)' })).toBeInTheDocument();
    expect(within(detail).getByText('GraphQL: one small project only')).toBeInTheDocument();
    expect(within(detail).getByText(/Hi Fieldwork team/)).toBeInTheDocument();
  });

  it('credits the board a job came from, linking back to it', async () => {
    open('j2');
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByRole('link', { name: 'Himalayas' })).toHaveAttribute('href', 'https://example.com/jobs/j2');
  });

  it('names a source that asks for no credit without a link', async () => {
    open('j3');
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByText(/via clipped from LinkedIn/)).toBeInTheDocument();
    expect(within(detail).queryByRole('link', { name: /LinkedIn/ })).not.toBeInTheDocument();
  });

  it('switches between the letter, resume and original post', async () => {
    open('j1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Resume' }));
    expect(screen.getByText(/p95 query time dropped/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Original post' }));
    expect(screen.getByText(/Apply: email jobs@northwind-labs.example/)).toBeInTheDocument();
  });

  it('previews the résumé with exactly the markup the PDF is printed from', async () => {
    const { api, container } = open('j2');
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    await userEvent.click(await within(detail).findByRole('tab', { name: 'Resume' }));
    const [draft, settings] = await Promise.all([api.getDraft('j2'), api.getSettings()]);
    expect(container.querySelector('.applio-doc')!.innerHTML).toBe(resumeBody(draft!, { name: settings.fullName, email: settings.gmailAddress }));
  });

  it('opens the generated PDF in the system viewer', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const openDraftFile = vi.spyOn(api, 'openDraftFile');
    renderWithApp(<ReviewPage params={{ id: 'j2' }} />, api);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    await userEvent.click(await within(detail).findByRole('button', { name: 'Open PDF' }));
    expect(openDraftFile).toHaveBeenCalledWith('j2', 'letter');
  });

  it('keeps Open PDF disabled until the files exist', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const job = await api.getJob('j2');
    vi.spyOn(api, 'getJob').mockResolvedValue({ ...job, folderPath: undefined });
    renderWithApp(<ReviewPage params={{ id: 'j2' }} />, api);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByRole('button', { name: 'Open PDF' })).toBeDisabled();
  });

  /** A mock with Gmail set up, so email drafts can be sent. */
  const withGmail = async (api = createMockApi({ latencyMs: 0 })) => {
    await api.saveSettings({ gmailAddress: 'sam@gmail.com', fullName: 'Sam Rivera' });
    await api.setSecret('gmailAppPassword', 'abcd efgh ijkl mnop');
    return api;
  };

  it('sends an email application on approval, saying where and naming the saved folder', async () => {
    const api = await withGmail();
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve & send email' }));
    const detail = screen.getByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByText(/Sent to jobs@northwind-labs.example/)).toBeInTheDocument();
    expect((await api.getJob('j1')).status).toBe('applied');
  });

  it('warns in red about a suspicious post and sends it only after an explicit second confirm', async () => {
    const api = await withGmail();
    const flagged: typeof api = { ...api, getJob: async (id) => ({ ...(await api.getJob(id)), suspicious: 'The post addresses AI tools directly.' }) };
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, flagged);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByText(/trying to manipulate automated tools/)).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('button', { name: 'Approve & send email' }));
    expect(await api.getSend('j1')).toBeNull();
    await userEvent.click(within(detail).getByRole('button', { name: 'Send anyway' }));
    await waitFor(async () => expect(await api.getSend('j1')).toMatchObject({ state: 'sent' }));
  });

  it('marks a draft made from an older profile and redrafts it on request', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveFact({ group: 'Northwind Labs — Senior Engineer', text: 'Led the billing rewrite' });
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, api);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByText('Made from an older profile.')).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('button', { name: /Redraft/ }));
    await waitFor(async () => expect((await api.getDraft('j1'))?.check?.stale).toBe(false));
  });

  it('shows one state card and folds the rest into More notes', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveFact({ group: 'Northwind Labs — Senior Engineer', text: 'Led the billing rewrite' });
    const flagged: typeof api = { ...api, getJob: async (id) => ({ ...(await api.getJob(id)), suspicious: 'The post addresses AI tools directly.' }) };
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, flagged);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByRole('alert')).toHaveTextContent(/trying to manipulate automated tools/);
    expect(within(detail).queryByText('Made from an older profile.', { selector: 'strong' })).not.toBeInTheDocument();
    await userEvent.click(within(detail).getByText(/more note/));
    expect(within(detail).getByRole('list', { name: 'More notes' })).toHaveTextContent('Made from an older profile.');
    expect(within(detail).getByText(/What happens next:/).parentElement).toHaveTextContent('Never sends on its own because the post looks suspicious.');
  });

  it('claims every line traced only when the check says so', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const plain = { ...api, getDraft: async (id: string) => ({ ...(await api.getDraft(id))!, check: { stale: false, unverified: [{ line: 'I am based in Marikina City.', terms: ['Marikina'] }], forbidden: [], placeholders: [] } }) };
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, plain);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByText('Résumé traced to facts · cover letter: 1 unverified line')).toBeInTheDocument();
    expect(within(detail).queryByText(/Every claim traced/)).not.toBeInTheDocument();
    expect(within(detail).getByText(/I am based in Marikina City/)).toBeInTheDocument();
  });

  it('waits to approve until the PDFs are saved, and says so', async () => {
    const api = await withGmail();
    // Main reports it is working on the job (its PDFs are printing), so this is saving, not stalled.
    const saving = { ...api, getStatus: async () => ({ ...(await api.getStatus()), drafting: ['j1'] }), getJob: async (id: string) => ({ ...(await api.getJob(id)), folderPath: undefined }) };
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, saving);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByText(/Saving the résumé and letter PDFs/)).toBeInTheDocument();
    expect(within(detail).getByRole('button', { name: 'Approve & send email' })).toBeDisabled();
    expect(within(detail).getByText('Approve turns on once the PDFs are saved.')).toBeInTheDocument();
    expect(within(within(detail).getByRole('list', { name: 'Progress' })).getByRole('listitem', { name: 'Drafted: in progress' })).toHaveAttribute('aria-current', 'step');
  });

  it('does not spin forever on a draft whose save stopped: it offers Save PDFs again', async () => {
    const api = await withGmail();
    let saved = false;
    // The draft was marked drafted, then Applio closed before printing: no folder, no failure note, nothing running.
    const stalled = { ...api, getJob: async (id: string) => ({ ...(await api.getJob(id)), ...(saved ? {} : { folderPath: undefined }) }), saveDraftFiles: async (id: string) => { saved = true; return api.saveDraftFiles(id); } };
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, stalled);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    const alert = await within(detail).findByRole('alert');
    expect(alert).toHaveTextContent(/PDFs didn't save.*Applio stopped before the PDFs were printed/);
    expect(within(detail).queryByText(/Saving the résumé and letter PDFs/)).not.toBeInTheDocument();
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry saving PDFs' }));
    await waitFor(() => expect(within(detail).getByRole('button', { name: 'Approve & send email' })).toBeEnabled());
  });

  it('retries saving the PDFs without drafting again, after a failed save', async () => {
    const api = await withGmail();
    const failed = { status: 'drafted' as const, at: '2026-11-08T09:00:00.000Z', note: "Couldn't save the files: printing took longer than 60 s" };
    let saved = false;
    const flaky = { ...api, getJob: async (id: string) => {
      const job = await api.getJob(id);
      return saved ? job : { ...job, folderPath: undefined, history: [...job.history, failed] };
    } };
    const save = vi.spyOn(flaky, 'saveDraftFiles').mockImplementation(async (id) => ((saved = true), api.getJob(id)));
    const redraft = vi.spyOn(flaky, 'redraft');
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, flaky);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    const alert = await within(detail).findByRole('alert');
    expect(alert).toHaveTextContent(/PDFs didn't save.*printing took longer than 60 s/);
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry saving PDFs' }));
    expect(save).toHaveBeenCalledWith('j1');
    expect(redraft).not.toHaveBeenCalled();
    await waitFor(() => expect(within(detail).getByRole('button', { name: 'Approve & send email' })).toBeEnabled());
  });

  it('turns Approve on by itself once main reports the PDFs were saved (QA 2026-11-08)', async () => {
    const api = await withGmail();
    let saved = false;
    const later = { ...api, getJob: async (id: string) => ({ ...(await api.getJob(id)), ...(saved ? {} : { folderPath: undefined }) }) };
    const listeners = new Set<(s: AppStatus) => void>();
    window.applioEvents = { onStatus: (l) => (listeners.add(l), () => listeners.delete(l)) };
    const push = async (jobsVersion: number) => {
      // While the PDFs print, main lists the job as drafting; once saved it doesn't.
      const status = { ...(await api.getStatus()), jobsVersion, drafting: saved ? [] : ['j1'] };
      act(() => listeners.forEach((l) => l(status)));
    };
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, later);
    const detail = await screen.findByRole('region', { name: 'Draft detail' });
    await push(1);
    expect(await within(detail).findByText(/Saving the résumé and letter PDFs/)).toBeInTheDocument();
    saved = true;
    await push(2);
    await waitFor(() => expect(within(detail).getByRole('button', { name: 'Approve & send email' })).toBeEnabled());
    expect(within(detail).queryByText(/Saving the résumé and letter PDFs/)).not.toBeInTheDocument();
    delete window.applioEvents;
  });

  it('offers Set up Gmail instead of Approve while Gmail is not set up', async () => {
    open('j1');
    expect(await screen.findByRole('link', { name: 'Set up Gmail to send' })).toHaveAttribute('href', '#/settings');
    expect(screen.queryByRole('button', { name: 'Approve & send email' })).not.toBeInTheDocument();
    expect(screen.getByText("Gmail isn't set up, so approving can't send this email.")).toBeInTheDocument();
  });

  it('keeps a refused send in the Inbox as Not sent with the reason and Retry, never as Sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let refuse: string | undefined = 'Gmail rejected the app password.';
    const api = await withGmail(createMockApi({ latencyMs: 0, sendFailure: () => refuse }));
    renderWithApp(<ReviewPage params={{ id: 'j1' }} />, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve & send email' }));

    const detail = screen.getByRole('region', { name: 'Draft detail' });
    expect(await within(detail).findByRole('alert')).toHaveTextContent('Not sent. Gmail rejected the app password.');
    expect(within(detail).queryByText(/Sent to/)).not.toBeInTheDocument();
    const queue = screen.getByRole('region', { name: 'Queue' });
    await waitFor(() => expect(within(queue).getByRole('tab', { name: /Fix first/ })).toHaveAttribute('aria-selected', 'true'));
    const fix = within(queue).getByRole('tabpanel');
    expect(within(fix).getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(within(fix).getByText('Not sent')).toBeInTheDocument();

    refuse = undefined;
    await userEvent.click(within(detail).getByRole('button', { name: 'Retry send' }));
    expect(await within(detail).findByText(/Sent to jobs@northwind-labs.example/)).toBeInTheDocument();
    expect(await api.getSend('j1')).toMatchObject({ state: 'sent' });
  });

  it('lists a job left approved but unsent after a reload, so it never drops out of every list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = await withGmail(createMockApi({ latencyMs: 0, sendFailure: () => 'Network down' }));
    await api.approveDraft('j1').catch(() => {});
    renderWithApp(<ReviewPage params={{}} />, api);
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).getByRole('tab', { name: /Fix first/ })).toHaveTextContent('1');
    expect(within(queue).getByRole('tab', { name: /Fix first/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(within(queue).getByRole('tabpanel')).getByText('Senior Backend Engineer')).toBeInTheDocument();
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

  it('moves through the queue with the arrow keys', async () => {
    open();
    const queue = await screen.findByRole('region', { name: 'Queue' });
    const [first, second] = within(queue).getAllByRole('link');
    first!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    await waitFor(() => expect(location.hash).toBe(second!.getAttribute('href')));
    await userEvent.keyboard('{ArrowUp}');
    expect(first).toHaveFocus();
  });

  it("leaves starting a scan to the sidebar's Get jobs button, and pausing to the activity bar", async () => {
    open();
    await screen.findByRole('region', { name: 'Queue' });
    expect(screen.queryByRole('link', { name: 'Get jobs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause auto-send' })).not.toBeInTheDocument();
  });

  it("opens a job from Matches in the detail: its fit and post, and Draft this one", async () => {
    const { api } = open('j5');
    const detail = await screen.findByRole('region', { name: 'Job detail' });
    expect(within(detail).getByRole('heading', { name: 'Senior Software Engineer, Platform' })).toBeInTheDocument();
    expect(within(detail).getByText(/below your draft bar \(75\)/)).toBeInTheDocument();
    expect(within(within(detail).getByRole('list', { name: 'Progress' })).getByRole('listitem', { name: 'Drafted: needs you' })).toHaveAttribute('aria-current', 'step');
    expect(within(detail).getByRole('link', { name: 'Original post' })).toHaveAttribute('href', 'https://example.com/jobs/j5');
    await userEvent.click(within(detail).getByRole('button', { name: /Draft this one/ }));
    await waitFor(async () => expect((await api.getJob('j5')).status).toBe('drafted'));
    expect(await screen.findByRole('region', { name: 'Draft detail' })).toBeInTheDocument();
  });

  it("disables Draft this one with the reason while today's token budget is used", async () => {
    const api = createMockApi({ latencyMs: 0 });
    const spent = { ...api, getStatus: async () => ({ ...(await api.getStatus()), budgetStop: "Today's Claude token budget is used up." }) };
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, spent);
    const detail = await screen.findByRole('region', { name: 'Job detail' });
    expect(within(detail).getByRole('button', { name: 'Draft this one' })).toBeDisabled();
    expect(within(detail).getByText("Today's Claude token budget is used up.")).toBeInTheDocument();
  });

  it('skips a below-bar job, which leaves the list for good', async () => {
    const { api } = open('j5');
    const detail = await screen.findByRole('region', { name: 'Job detail' });
    await userEvent.click(within(detail).getByRole('button', { name: 'Skip job' }));
    await waitFor(async () => expect((await api.getJob('j5')).status).toBe('skipped'));
  });

  it('opens a strong match a scan left undrafted, one click from a draft', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ draftThreshold: 60 });
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, api);
    const detail = await screen.findByRole('region', { name: 'Job detail' });
    expect(detail).toHaveTextContent('Strong match, not drafted yet. Its match score (67) is at or above your draft bar (60). Scans only draft when you ask.');
    expect(within(detail).getByRole('button', { name: 'Draft this one' })).toBeEnabled();
  });

  it('shows the effort level and the keywords the operator can claim, with gaps', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const [first] = await api.listJobs({ statuses: ['drafted'] });
    const draft = (await api.getDraft(first!.id))!;
    vi.spyOn(api, 'getDraft').mockResolvedValue({ ...draft, keywords: { claimed: [{ keyword: 'PostgreSQL', factId: 'f1' }], gaps: ['Kafka'] } });
    renderWithApp(<ReviewPage params={{ id: first!.id }} />, api);
    expect(await screen.findByText(/Effort: (High|Medium|Quick)/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Keywords you can claim' })).toHaveTextContent('PostgreSQL');
    expect(screen.getByRole('list', { name: 'Keyword gaps' })).toHaveTextContent('Kafka');
  });

  it('lists the jobs waiting on answers under the Answer tab', async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'listQuestions').mockResolvedValue([{ jobId: 'j5', questions: ['Have you worked with healthcare or HIPAA-regulated data?', 'Can you start within two weeks?'], askedAt: '2026-11-07T08:00:00.000Z' }]);
    renderWithApp(<ReviewPage params={{}} />, api);
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).getByRole('tab', { name: /Answer/ })).toHaveTextContent('1');
    await userEvent.click(within(queue).getByRole('tab', { name: /Answer/ }));
    expect(within(queue).getByRole('tabpanel')).toHaveTextContent('Senior Software Engineer, Platform');
  });

  it('asks the operator each question and drafts with the answers', async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'listQuestions').mockResolvedValue([{ jobId: 'j5', questions: ['Have you worked with healthcare or HIPAA-regulated data?', 'Can you start within two weeks?'], askedAt: '2026-11-07T08:00:00.000Z' }]);
    const answer = vi.spyOn(api, 'answerQuestions').mockResolvedValue({ ...(await api.getJob('j5')), status: 'drafted' });
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, api);
    const panel = await screen.findByRole('region', { name: 'Questions from Claude' });
    const submit = within(panel).getByRole('button', { name: 'Answer and draft' });
    await userEvent.type(within(panel).getByLabelText('Have you worked with healthcare or HIPAA-regulated data?'), 'Yes, patient intake forms at Acme.');
    await userEvent.click(within(panel).getAllByRole('checkbox', { name: 'Save to fact bank' })[0]!);
    await userEvent.selectOptions(within(panel).getAllByLabelText('Section')[0]!, 'Projects');
    await userEvent.type(within(panel).getByLabelText('Can you start within two weeks?'), 'Yes.');
    await userEvent.click(submit);
    expect(answer).toHaveBeenCalledWith('j5', [
      { question: 'Have you worked with healthcare or HIPAA-regulated data?', answer: 'Yes, patient intake forms at Acme.', saveTo: 'Projects' },
      { question: 'Can you start within two weeks?', answer: 'Yes.' },
    ]);
  });

  it('says which answer is missing when Answer and draft is clicked early, and drafts nothing', async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'listQuestions').mockResolvedValue([{ jobId: 'j5', questions: ['Have you worked with healthcare or HIPAA-regulated data?', 'Can you start within two weeks?'], askedAt: '2026-11-07T08:00:00.000Z' }]);
    const answer = vi.spyOn(api, 'answerQuestions');
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, api);
    const panel = await screen.findByRole('region', { name: 'Questions from Claude' });
    await userEvent.type(within(panel).getByLabelText(/Have you worked with healthcare/), 'Yes.');
    await userEvent.click(within(panel).getByRole('button', { name: 'Answer and draft' }));
    const second = within(panel).getByLabelText(/Can you start within two weeks/);
    expect(second).toHaveFocus();
    expect(second).toHaveAccessibleDescription('Add an answer so Claude can draft this part.');
    expect(answer).not.toHaveBeenCalled();
    await userEvent.type(second, 'Yes');
    expect(second).not.toHaveAccessibleDescription();
  });

  it('shows how long Claude has been drafting, stage by stage', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const status = await api.getStatus();
    vi.spyOn(api, 'getStatus').mockResolvedValue({ ...status, drafting: ['j5'], draftingSince: { j5: new Date(Date.now() - 90_000).toISOString() } });
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, api);
    const panel = await screen.findByRole('region', { name: 'Drafting' });
    expect(panel).toHaveTextContent(/1:[23]\d elapsed/);
    const steps = within(panel).getByRole('list', { name: 'Drafting steps' });
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Claude writes the résumé and letter from your fact bankIn progress', 'Save the PDFs']);
  });

  it('shows a job Claude is drafting in the background, live, until its draft lands', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const status = await api.getStatus();
    vi.spyOn(api, 'getStatus').mockResolvedValue({ ...status, drafting: ['j5'] });
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, api);
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).getByRole('list', { name: 'Drafting now' })).toHaveTextContent('Senior Software Engineer, Platform');
    const panel = screen.getByRole('region', { name: 'Drafting' });
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(panel).toHaveTextContent('Claude is writing the résumé and cover letter');
  });
});
