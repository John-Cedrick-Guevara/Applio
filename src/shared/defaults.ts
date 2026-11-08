import type { Contact, Preferences, Settings, Source } from './types';

/** What a fresh install starts with (PR-10 AC-5). The mock seeds from these too, so both stay in step. */
export const DEFAULT_SETTINGS: Omit<Settings, 'secretsSet' | 'checks'> = {
  outputFolder: '~/Applio',
  fullName: '',
  aiEngine: 'claude-code',
  gmailAddress: '',
  telegramChatId: '',
  assistedFill: { platform: false, custom: false },
  followUpDays: 7,
  draftThreshold: 75,
  autoSendThreshold: 85,
  maxPerChannelPerDay: 10,
  dailyTokenBudget: 150_000,
  monthlyTokenBudget: 3_000_000,
  discoveryIntervalHours: 6,
  launchAtLogin: false,
  blocklist: [],
};

export const EMPTY_CONTACT: Contact = { phone: '', location: '', links: [], education: '', notes: '' };

export const DEFAULT_PREFERENCES: Preferences = {
  targetRoles: [],
  seniority: '',
  employmentTypes: ['full-time', 'contract', 'freelance'],
  remoteOnly: true,
  hoursOverlap: '',
  minimumPay: '',
};

const source = (id: string, name: string, kind: Source['kind'], autonomy: Source['autonomy'], via: string, extra: Partial<Source> = {}): Source => ({
  id, name, kind, autonomy, via, enabled: true, ...extra,
});

/** Every source SPEC F2 lists, with its fetch method; clipped and Upwork are capped at draft. */
export const DEFAULT_SOURCES: readonly Source[] = [
  source('remoteok', 'RemoteOK', 'board', 'draft', 'Public JSON API · 4 polls a day'),
  source('remotive', 'Remotive', 'board', 'draft', 'Public JSON API · 4 polls a day'),
  source('himalayas', 'Himalayas', 'board', 'draft', 'Public JSON API'),
  source('wwr', 'WeWorkRemotely', 'board', 'draft', 'RSS feed'),
  source('jobicy', 'Jobicy', 'board', 'notify', 'Public JSON API'),
  source('arbeitnow', 'Arbeitnow', 'board', 'draft', 'Public JSON API · 4 polls a day'),
  source('ats', 'ATS watchlist', 'ats-watchlist', 'draft', 'Greenhouse, Lever, Ashby, Workable · your company list (empty for now)'),
  source('hn', 'HN Who is hiring', 'api', 'draft', 'Monthly thread via Algolia API'),
  // Off until the Upwork API key is approved (SPEC §6); paste Upwork jobs through Add job meanwhile.
  source('upwork', 'Upwork', 'api', 'draft', 'Official API · not available yet, paste Upwork jobs instead', { maxAutonomy: 'draft', enabled: false }),
  source('clip', 'Clipped jobs', 'clip', 'draft', 'LinkedIn, Indeed, JobStreet, Facebook, anything you clip', { maxAutonomy: 'draft' }),
  source('jsearch', 'JSearch', 'api', 'notify', 'Optional · free tier 200 calls a month', { enabled: false }),
];
