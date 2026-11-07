import { useState } from 'react';
import type { Fact, FactSuggestion } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';

interface Props {
  fileName: string;
  suggestions: FactSuggestion[];
  onAdded: (fact: Fact) => void;
  onDone: () => void;
}

/**
 * Facts found in an imported résumé, waiting for the operator. Each one joins
 * the fact bank only when accepted, because the AI may only write from facts
 * the operator has vouched for (SPEC §1).
 */
export function ResumeSuggestions({ fileName, suggestions, onAdded, onDone }: Props) {
  const api = useApi();
  const action = useAction();
  const [left, setLeft] = useState(suggestions);

  const accept = async (s: FactSuggestion) => {
    const fact = await action.run('add the fact', () => api.saveFact({ group: s.group, text: s.text }));
    if (!fact) return;
    onAdded(fact);
    const next = left.filter((x) => x !== s);
    setLeft(next);
    if (next.length === 0) onDone();
  };

  return (
    <section className="card" aria-label={`Facts found in ${fileName}`}>
      <div className="card-header">
        <h2 className="card-title">Facts found in {fileName}</h2>
        <Button size="sm" onClick={onDone}>Dismiss the rest</Button>
      </div>
      {left.length === 0 ? (
        <p className="cell-sub">No new facts found. Everything in it is already in your fact bank.</p>
      ) : (
        <ul className="resume-suggestions">
          {left.map((s) => (
            <li key={`${s.group}|${s.text}`} className="fact-row">
              <div>
                <div className="fact-text">{s.text}</div>
                <div className="cell-sub">{s.group}</div>
              </div>
              <Button size="sm" busy={action.pending} onClick={() => accept(s)}>Add to fact bank</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
