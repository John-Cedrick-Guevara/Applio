import { describe, expect, it } from 'vitest';
import { API_METHODS } from './api';
import { InvalidRequestError, parseApiArgs, API_ARGS } from './schemas';
import { seedSettings } from './mock/fixtures';

const rejects = (method: Parameters<typeof parseApiArgs>[0], args: unknown[]) => () => parseApiArgs(method, args);

describe('API argument schemas', () => {
  it('has a schema for every API method', () => {
    expect(Object.keys(API_ARGS).sort()).toEqual([...API_METHODS].sort());
  });

  describe('jobs and drafts', () => {
    it('accepts the calls the UI makes', () => {
      expect(parseApiArgs('listJobs', [])).toEqual([]);
      expect(parseApiArgs('listJobs', [{ statuses: ['drafted'], minScore: 75, search: 'rust' }])).toHaveLength(1);
      expect(parseApiArgs('getJob', ['j1'])).toEqual(['j1']);
      expect(parseApiArgs('setStatus', ['j1', 'interview'])).toEqual(['j1', 'interview']);
      expect(parseApiArgs('setStatus', ['j1', 'rejected', 'Position filled'])).toHaveLength(3);
      expect(parseApiArgs('updateCoverLetter', ['j1', 'Dear team,\n\n…'])).toHaveLength(2);
    });

    it('rejects a missing or empty id', () => {
      expect(rejects('getJob', [])).toThrow(InvalidRequestError);
      expect(rejects('getJob', [''])).toThrow(/id/);
    });

    it('rejects an unknown status', () => {
      expect(rejects('setStatus', ['j1', 'hired'])).toThrow(InvalidRequestError);
    });

    it('rejects an overlong cover letter', () => {
      expect(rejects('updateCoverLetter', ['j1', 'x'.repeat(50_001)])).toThrow(/too long/i);
    });

    it('rejects a score filter out of range or not a number', () => {
      expect(rejects('listJobs', [{ minScore: 101 }])).toThrow(InvalidRequestError);
      expect(rejects('listJobs', [{ minScore: Number.NaN }])).toThrow(InvalidRequestError);
    });

    it('rejects extra arguments and unknown fields', () => {
      expect(rejects('getJob', ['j1', 'extra'])).toThrow(InvalidRequestError);
      expect(rejects('listJobs', [{ status: 'drafted' }])).toThrow(InvalidRequestError);
    });
  });

  describe('automation and OS', () => {
    it('accepts a pause toggle and rejects a non-boolean', () => {
      expect(parseApiArgs('setAutomationPaused', [true])).toEqual([true]);
      expect(rejects('setAutomationPaused', ['yes'])).toThrow(InvalidRequestError);
    });

    it('rejects an overlong link', () => {
      expect(parseApiArgs('openExternal', ['https://example.com/job'])).toHaveLength(1);
      expect(rejects('openExternal', [`https://example.com/${'a'.repeat(2048)}`])).toThrow(InvalidRequestError);
    });
  });

  describe('add job', () => {
    it('accepts pasted text or a link and rejects other kinds', () => {
      expect(parseApiArgs('analyzeJob', [{ kind: 'link', value: 'https://jobs.example.com/1' }])).toHaveLength(1);
      expect(rejects('analyzeJob', [{ kind: 'file', value: '/etc/passwd' }])).toThrow(InvalidRequestError);
    });

    it('accepts a preview and rejects one with a score above 100', () => {
      const preview = {
        company: 'Acme', title: 'Engineer', sourceName: 'Clipped', tags: ['Remote'], score: 80, summary: 'Builds things.',
        channel: null, channelLabel: 'No apply route', route: 'None found', applyTarget: '', maxAutonomy: 'draft', tokensUsed: 900,
      };
      expect(parseApiArgs('addJob', [preview])).toHaveLength(1);
      expect(rejects('addJob', [{ ...preview, score: 140 }])).toThrow(InvalidRequestError);
    });
  });

  describe('profile', () => {
    it('accepts a new or edited fact and rejects an empty one', () => {
      expect(parseApiArgs('saveFact', [{ group: 'Projects', text: 'Built X' }])).toHaveLength(1);
      expect(parseApiArgs('saveFact', [{ id: 'f1', group: 'Projects', text: 'Built X' }])).toHaveLength(1);
      expect(rejects('saveFact', [{ group: 'Projects', text: '' }])).toThrow(InvalidRequestError);
    });

    it('accepts preferences and rejects an unknown employment type', () => {
      const prefs = { targetRoles: ['Backend'], seniority: 'Senior', employmentTypes: ['full-time'], remoteOnly: true, hoursOverlap: '4h', minimumPay: '$80k' };
      expect(parseApiArgs('savePreferences', [prefs])).toHaveLength(1);
      expect(rejects('savePreferences', [{ ...prefs, employmentTypes: ['internship'] }])).toThrow(InvalidRequestError);
    });
  });

  describe('sources, usage and settings', () => {
    it('accepts a source patch and rejects an unknown autonomy', () => {
      expect(parseApiArgs('updateSource', ['remoteok', { enabled: false }])).toHaveLength(2);
      expect(rejects('updateSource', ['remoteok', { autonomy: 'yolo' }])).toThrow(InvalidRequestError);
    });

    it('accepts a usage period and rejects others', () => {
      expect(parseApiArgs('getUsage', ['month'])).toEqual(['month']);
      expect(rejects('getUsage', ['year'])).toThrow(InvalidRequestError);
    });

    it('accepts every saved setting and rejects thresholds out of range', () => {
      const settings: Partial<ReturnType<typeof seedSettings>> = seedSettings();
      delete settings.secretsSet;
      expect(parseApiArgs('saveSettings', [settings])).toHaveLength(1);
      expect(rejects('saveSettings', [{ draftThreshold: 120 }])).toThrow(InvalidRequestError);
      expect(rejects('saveSettings', [{ maxPerChannelPerDay: 2.5 }])).toThrow(InvalidRequestError);
    });

    it('accepts exactly the email addresses the Settings field accepts', () => {
      expect(parseApiArgs('saveSettings', [{ gmailAddress: 'me@x.c' }])).toHaveLength(1);
      expect(parseApiArgs('saveSettings', [{ gmailAddress: '' }])).toHaveLength(1);
      expect(rejects('saveSettings', [{ gmailAddress: 'not an email' }])).toThrow(InvalidRequestError);
    });

    it('refuses to let saveSettings mark a secret as set', () => {
      expect(rejects('saveSettings', [{ secretsSet: { anthropicApiKey: true } }])).toThrow(InvalidRequestError);
    });

    it('accepts a known secret key and rejects an unknown one', () => {
      expect(parseApiArgs('setSecret', ['telegramBotToken', '123:abc'])).toHaveLength(2);
      expect(rejects('setSecret', ['awsKey', 'x'])).toThrow(InvalidRequestError);
    });

    it('never puts the rejected value in the error message', () => {
      const secret = 'sk-ant-very-secret-value';
      expect(rejects('setSecret', ['awsKey', secret])).toThrow(expect.objectContaining({ message: expect.not.stringContaining(secret) }));
      expect(rejects('setSecret', ['gmailAppPassword', secret.repeat(200)])).toThrow(expect.objectContaining({ message: expect.not.stringContaining(secret) }));
    });
  });
});
