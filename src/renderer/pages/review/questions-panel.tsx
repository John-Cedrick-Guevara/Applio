import { useState } from 'react';
import type { Job, QuestionAnswer } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useToast } from '../../components/toast';
import { useAction } from '../../hooks/use-action';
import { navigate } from '../../lib/router';

interface Props {
  job: Job;
  questions: string[];
  /** Fact-bank sections an answer can be saved into. */
  sections: string[];
  /** Called once the job is answered (drafted or skipped), to reload Review. */
  onAnswered: () => void;
}

interface Row {
  answer: string;
  save: boolean;
  section: string;
  /** Edited and left: from then on an empty answer shows its error (blur-first). */
  touched: boolean;
}

/**
 * Claude's questions for one job (SPEC F4): something it needs for a truthful
 * draft that the fact bank doesn't say. Answers are used for this draft; ticked
 * ones also join the fact bank as the new truth.
 */
export function QuestionsPanel({ job, questions, sections, onAnswered }: Props) {
  const api = useApi();
  const action = useAction();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => questions.map(() => ({ answer: '', save: false, section: sections[0] ?? '', touched: false })));
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  // Set by a click on Answer and draft: every empty answer shows its error, not just the ones left.
  const [tried, setTried] = useState(false);
  const missing = (i: number) => (tried || rows[i]!.touched) && !rows[i]!.answer.trim();

  const submit = async () => {
    const empty = rows.findIndex((r) => !r.answer.trim());
    if (empty >= 0) {
      setTried(true);
      document.getElementById(`q-${empty}`)?.focus();
      return;
    }
    const answers: QuestionAnswer[] = questions.map((question, i) => {
      const row = rows[i]!;
      return { question, answer: row.answer.trim(), ...(row.save && row.section ? { saveTo: row.section } : {}) };
    });
    const next = await action.run('answer and draft', () => api.answerQuestions(job.id, answers));
    if (!next) return;
    toast.show(next.status === 'drafted' ? `Drafted ${job.title} with your answers` : `Answers saved. ${job.title} wasn't drafted yet; see its timeline.`, next.status === 'drafted' ? 'success' : 'info');
    onAnswered();
    navigate(`/review/${job.id}`);
  };

  const skip = async () => {
    const next = await action.run('skip the job', () => api.skipJob(job.id), `Skipped ${job.title} at ${job.company}`);
    if (next) onAnswered();
  };

  return (
    <section className="card draft-panel questions-panel" aria-label="Questions from Claude">
      <div>
        <div className="cell-sub">{job.company} · {job.sourceName}</div>
        <h2 className="draft-title">{job.title}</h2>
        <p className="body-text">Claude needs these before it can draft without guessing. Every answer is required. They're used for this application; tick one to keep it in your fact bank for future drafts too.</p>
      </div>
      {questions.map((q, i) => (
        <div key={q} className="question-row">
          <label htmlFor={`q-${i}`} className="settings-row-name">{q}</label>
          <textarea
            id={`q-${i}`}
            className="textarea"
            rows={2}
            required
            aria-invalid={missing(i) || undefined}
            aria-describedby={missing(i) ? `q-${i}-error` : undefined}
            value={rows[i]!.answer}
            onChange={(e) => set(i, { answer: e.target.value })}
            onBlur={() => rows[i]!.answer && set(i, { touched: true })}
          />
          {missing(i) ? <span id={`q-${i}-error`} className="field-error">Add an answer so Claude can draft this part.</span> : null}
          <div className="question-save">
            <label className="row">
              <input type="checkbox" checked={rows[i]!.save} onChange={(e) => set(i, { save: e.target.checked })} />
              Save to fact bank
            </label>
            {rows[i]!.save ? (
              <label className="row">
                Section
                <select className="select" value={rows[i]!.section} onChange={(e) => set(i, { section: e.target.value })}>
                  {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        </div>
      ))}
      <div className="draft-footer">
        <span className="cell-sub">{action.pending ? 'Drafting with your answers… this takes a minute or two.' : 'Drafting uses about 15k tokens.'}</span>
        <div className="row">
          <Button busy={action.pending} onClick={skip}>Skip job</Button>
          <Button variant="strong" busy={action.pending} onClick={submit}>Answer and draft</Button>
        </div>
      </div>
    </section>
  );
}
