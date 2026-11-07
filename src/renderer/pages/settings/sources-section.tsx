import { AUTONOMY_LEVELS } from '../../../shared/autonomy';
import type { Autonomy, Source } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Card } from '../../components/card';
import { Toggle } from '../../components/form';
import { useAction } from '../../hooks/use-action';
import { AUTONOMY_LABEL } from '../../lib/labels';

/** Per-source on/off and autonomy (SPEC F2, F6). Sources with a ceiling can't pick past it. */
export function SourcesSection({ sources, onChange }: { sources: Source[]; onChange: (s: Source) => void }) {
  const api = useApi();
  const action = useAction();

  const update = async (source: Source, patch: Partial<Pick<Source, 'enabled' | 'autonomy'>>) => {
    const saved = patch.enabled !== undefined
      ? `${source.name} turned ${patch.enabled ? 'on' : 'off'}`
      : `${source.name} set to ${AUTONOMY_LABEL[patch.autonomy ?? source.autonomy]}`;
    const next = await action.run(`update ${source.name}`, () => api.updateSource(source.id, patch), saved);
    if (next) onChange(next);
  };

  return (
    <Card flush title="Sources and autonomy" description="Autonomous only sends through email and standard ATS forms. On any other channel it falls back to Draft → Approve.">
      {sources.map((source) => (
        <div key={source.id} className="settings-row">
          <Toggle hideLabel label={`Use ${source.name}`} checked={source.enabled} onChange={(enabled) => update(source, { enabled })} />
          <div className="settings-row-text">
            <div className="settings-row-name">{source.name}</div>
            <div className="cell-sub">{source.via}</div>
          </div>
          <div className={source.enabled ? 'tabs' : 'tabs is-off'} role="group" aria-label={`Autonomy for ${source.name}`}>
            {AUTONOMY_LEVELS.map((level: Autonomy) => {
              const blocked = level === 'autonomous' && source.maxAutonomy === 'draft';
              return (
                <button
                  key={level}
                  type="button"
                  className="tab"
                  aria-pressed={source.autonomy === level}
                  disabled={blocked}
                  title={blocked ? 'Never autonomous for this source' : undefined}
                  onClick={() => update(source, { autonomy: level })}
                >
                  {AUTONOMY_LABEL[level]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}
