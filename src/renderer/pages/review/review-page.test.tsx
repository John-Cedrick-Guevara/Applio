import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { resumeBody } from '../../../shared/templates/application-documents';
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

  it('tells the operator what Run now did', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Run now' }));
    expect(await screen.findByText('Run finished: 2 jobs passed your filters, 0 drafted.')).toBeInTheDocument();
  });

  it('confirms a skip', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText(/^Skipped /)).toBeInTheDocument();
  });

  it('pauses automation and blocks manual runs', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Pause automation' }));
    expect(await screen.findByText(/Automation is paused/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  });

  it('lists the jobs scored below the draft threshold when asked, each linking to its posting', async () => {
    open();
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).queryByText('Senior Software Engineer, Platform')).not.toBeInTheDocument();
    await userEvent.click(within(queue).getByRole('button', { name: 'Show them' }));
    const link = within(queue).getByRole('link', { name: /Senior Software Engineer, Platform/ });
    expect(link).toHaveTextContent('67');
    expect(link).toHaveAttribute('href', 'https://example.com/jobs/j5');
  });

  it('lists jobs still waiting to be scored or drafted, with the reason, so none go missing', async () => {
    open();
    const queue = await screen.findByRole('region', { name: 'Queue' });
    expect(within(queue).getByText(/1 not scored or drafted yet; the next run retries them\./)).toBeInTheDocument();
    await userEvent.click(within(queue).getByRole('button', { name: 'Show waiting jobs' }));
    const link = within(queue).getByRole('link', { name: /Frontend Developer/ });
    expect(link).toHaveTextContent('Not scored yet');
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

  it('lists the jobs waiting on answers in the queue', async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'listQuestions').mockResolvedValue([{ jobId: 'j5', questions: ['Have you worked with healthcare or HIPAA-regulated data?', 'Can you start within two weeks?'], askedAt: '2026-11-07T08:00:00.000Z' }]);
    renderWithApp(<ReviewPage params={{}} />, api);
    const queue = await screen.findByRole('region', { name: 'Queue' });
    const asking = within(queue).getByRole('list', { name: 'Needs your answers' });
    expect(asking).toHaveTextContent('Senior Software Engineer, Platform');
  });

  it('asks the operator each question and drafts with the answers', async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'listQuestions').mockResolvedValue([{ jobId: 'j5', questions: ['Have you worked with healthcare or HIPAA-regulated data?', 'Can you start within two weeks?'], askedAt: '2026-11-07T08:00:00.000Z' }]);
    const answer = vi.spyOn(api, 'answerQuestions').mockResolvedValue({ ...(await api.getJob('j5')), status: 'drafted' });
    renderWithApp(<ReviewPage params={{ id: 'j5' }} />, api);
    const panel = await screen.findByRole('region', { name: 'Questions from Claude' });
    const submit = within(panel).getByRole('button', { name: 'Answer and draft' });
    expect(submit).toBeDisabled();
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
