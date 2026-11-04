import { useState } from 'react';
import type { Answer } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';

interface AnswerBankProps {
  answers: Answer[];
  adding: boolean;
  onCloseAdd: () => void;
  onChange: (answers: Answer[]) => void;
}

/** Answer bank (SPEC F1): reused on forms before any AI call, so every row saves tokens. */
export function AnswerBank({ answers, adding, onCloseAdd, onChange }: AnswerBankProps) {
  return (
    <div>
      {adding ? (
        <AddAnswerForm
          onCancel={onCloseAdd}
          onSaved={(a) => {
            onChange([a, ...answers]);
            onCloseAdd();
          }}
        />
      ) : null}
      <div className="table-scroll">
        <table className="table answers-table">
          <thead>
            <tr>
              <th scope="col" className="col-question">Question</th>
              <th scope="col">Answer</th>
              <th scope="col">Written by</th>
              <th scope="col" className="num">Reused</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((a) => (
              <tr key={a.id}>
                <td className="cell-secondary">{a.question}</td>
                <td>{a.answer}</td>
                <td>
                  <span className={a.origin === 'ai' ? 'badge badge-accent' : 'badge badge-neutral'}>
                    {a.origin === 'ai' ? 'AI, approved by you' : 'You'}
                  </span>
                </td>
                <td className="num cell-secondary">{a.timesReused}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddAnswerForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (a: Answer) => void }) {
  const api = useApi();
  const action = useAction();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);

  const save = async () => {
    if (!question.trim() || !answer.trim()) return setError(true);
    const saved = await action.run('save the answer', () => api.saveAnswer({ question: question.trim(), answer: answer.trim() }), 'Answer saved to your answer bank');
    if (saved) onSaved(saved);
  };

  return (
    <div className="add-panel add-answer">
      <div className="field">
        <label htmlFor="new-q">Question</label>
        <input id="new-q" className="input" value={question} onChange={(e) => { setQuestion(e.target.value); setError(false); }} />
      </div>
      <div className="field">
        <label htmlFor="new-a">Your answer</label>
        <input id="new-a" className="input" value={answer} onChange={(e) => { setAnswer(e.target.value); setError(false); }} />
      </div>
      <div className="form-actions span-2">
        {error ? <span className="field-error grow" role="alert">Fill in both the question and the answer.</span> : null}
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save answer</Button>
      </div>
    </div>
  );
}
