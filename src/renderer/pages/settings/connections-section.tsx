import { useState } from 'react';
import type { ConnectionKind, SecretKey, Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { useToast } from '../../components/toast';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { EMAIL_PATTERN } from '../../../shared/patterns';

type Props = { settings: Settings; onChange: (s: Settings) => void };

/** Connections: AI engine, Gmail and Telegram. Secrets are write-only; the UI only knows if one is set. */
export function ConnectionsSection({ settings, onChange }: Props) {
  const gmailReady = settings.secretsSet.gmailAppPassword && !!settings.gmailAddress;
  const telegramReady = settings.secretsSet.telegramBotToken && !!settings.telegramChatId;

  return (
    <Card flush title="Connections">
      <EngineRow settings={settings} onChange={onChange} />
      <ConnectionRow
        title="Gmail"
        ready={gmailReady}
        readyText={`${settings.gmailAddress} · app password · sends with SMTP, watches replies with IMAP`}
        setupText="Use an app password from Google Account → Security, never your normal password."
        field={{ key: 'gmailAddress', label: 'Gmail address', value: settings.gmailAddress, valid: (v) => EMAIL_PATTERN.test(v), invalid: 'Enter a valid email address.' }}
        secret={{ key: 'gmailAppPassword', label: 'Gmail app password', isSet: settings.secretsSet.gmailAppPassword }}
        test={{ kind: 'gmail', label: 'Send test email' }}
        onChange={onChange}
      />
      <ConnectionRow
        title="Telegram"
        ready={telegramReady}
        readyText="New matches, drafts to approve, replies, follow-ups due, limit warnings"
        setupText="Create a bot with @BotFather, then send it /start to get your chat ID."
        field={{ key: 'telegramChatId', label: 'Chat ID', value: settings.telegramChatId, valid: (v) => /^-?\d+$/.test(v), invalid: 'Chat IDs are numbers, e.g. 123456789.' }}
        secret={{ key: 'telegramBotToken', label: 'Bot token', isSet: settings.secretsSet.telegramBotToken }}
        test={{ kind: 'telegram', label: 'Send test message' }}
        onChange={onChange}
      />
    </Card>
  );
}

/** Engine choice (SPEC §2): Claude Code subscription by default, API key as fallback. */
function EngineRow({ settings, onChange }: Props) {
  const api = useApi();
  const action = useAction();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [keyError, setKeyError] = useState(false);
  const isApi = settings.aiEngine === 'api-key';
  // A live check (Claude Code's sign-in, or the key with a free model lookup), re-run when the choice or key changes.
  const check = useAsync(() => api.testConnection('ai'), [api, settings.aiEngine, settings.secretsSet.anthropicApiKey]);
  const ready = check.data?.ok ?? (!isApi || settings.secretsSet.anthropicApiKey);

  const pick = async (engine: Settings['aiEngine']) => {
    const next = await action.run('switch the AI engine', () => api.saveSettings({ aiEngine: engine }));
    if (next) onChange(next);
  };

  const saveKey = async () => {
    if (!key.trim().startsWith('sk-ant-')) return setKeyError(true);
    const next = await action.run('save the API key', () => api.setSecret('anthropicApiKey', key.trim()));
    setKey(''); // never keep the secret in memory longer than needed
    if (next) {
      onChange(next);
      toast.show('API key saved to your system keychain', 'success');
    }
  };

  return (
    <div className="settings-row">
      <div className="settings-row-text wide">
        <div className="row">
          <span className="settings-row-name">AI engine</span>
          <span className={ready ? 'badge badge-success' : 'badge badge-warning'}>{ready ? 'Ready' : 'Needs setup'}</span>
        </div>
        {check.data && !check.data.ok ? <div className="cell-sub settings-desc">{check.data.message}</div> : null}
        <div className="cell-sub settings-desc">
          {isApi
            ? 'Anthropic API with your own key. Pay per token; budget caps still apply.'
            : 'Claude Code, headless, using your subscription. Only Applio’s tools are loaded.'}
        </div>
      </div>
      <div className="tabs" role="radiogroup" aria-label="AI engine">
        <button type="button" role="radio" className="tab" aria-checked={!isApi} onClick={() => pick('claude-code')}>Claude Code</button>
        <button type="button" role="radio" className="tab" aria-checked={isApi} onClick={() => pick('api-key')}>API key</button>
      </div>
      {isApi ? (
        <div className="secret-row">
          <div className="field grow">
            <label htmlFor="api-key">Anthropic API key</label>
            <input
              id="api-key"
              className="input mono"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={settings.secretsSet.anthropicApiKey ? 'Saved — paste to replace' : 'sk-ant-…'}
              value={key}
              onChange={(e) => { setKey(e.target.value); setKeyError(false); }}
            />
          </div>
          <Button variant="strong" busy={action.pending} onClick={saveKey}>Save to keychain</Button>
          {keyError ? <p className="field-error full" role="alert">Paste your key first. It starts with sk-ant-.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

interface ConnectionRowProps {
  title: string;
  ready: boolean;
  readyText: string;
  setupText: string;
  field: { key: 'gmailAddress' | 'telegramChatId'; label: string; value: string; valid: (v: string) => boolean; invalid: string };
  secret: { key: SecretKey; label: string; isSet: boolean };
  test: { kind: ConnectionKind; label: string };
  onChange: (s: Settings) => void;
}

/** A credential-backed integration: setup fields until connected, then a status line and a test button. */
function ConnectionRow({ title, ready, readyText, setupText, field, secret, test, onChange }: ConnectionRowProps) {
  const api = useApi();
  const action = useAction();
  const toast = useToast();
  const [value, setValue] = useState(field.value);
  const [secretValue, setSecretValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saveField = async () => {
    const v = value.trim();
    if (v === field.value) return;
    if (v && !field.valid(v)) return setError(field.invalid);
    const next = await action.run(`save the ${field.label.toLowerCase()}`, () => api.saveSettings({ [field.key]: v }), 'Saved');
    if (next) onChange(next);
  };

  const saveSecret = async () => {
    if (!secretValue) return;
    const next = await action.run(`save the ${secret.label.toLowerCase()}`, () => api.setSecret(secret.key, secretValue), `${secret.label} saved to your system keychain`);
    setSecretValue('');
    if (next) onChange(next);
  };

  const runTest = async () => {
    const result = await action.run(`test ${title}`, () => api.testConnection(test.kind));
    if (result) toast.show(result.message, result.ok ? 'success' : 'error');
  };

  return (
    <div className="settings-row settings-row-top">
      <div className="settings-row-text wide">
        <div className="row">
          <span className="settings-row-name">{title}</span>
          <span className={ready ? 'badge badge-success' : 'badge badge-warning'}>{ready ? 'Connected' : 'Not set up'}</span>
        </div>
        <div className="cell-sub settings-desc">{ready ? readyText : setupText}</div>
        {ready ? null : (
          <div className="connection-fields">
            <div className="field">
              <label htmlFor={`f-${field.key}`}>{field.label}</label>
              <input id={`f-${field.key}`} className="input" value={value} aria-invalid={error ? true : undefined} onChange={(e) => { setValue(e.target.value); setError(null); }} onBlur={saveField} />
              {error ? <p className="field-error" role="alert">{error}</p> : null}
            </div>
            <div className="field">
              <label htmlFor={`s-${secret.key}`}>{secret.label}</label>
              <div className="row nowrap-row">
                <input
                  id={`s-${secret.key}`}
                  className="input mono"
                  type="password"
                  autoComplete="off"
                  placeholder={secret.isSet ? 'Saved — paste to replace' : ''}
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                />
                <Button disabled={!secretValue} busy={action.pending} onClick={saveSecret}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Button busy={action.pending} onClick={runTest}>{action.pending ? 'Sending…' : test.label}</Button>
    </div>
  );
}
