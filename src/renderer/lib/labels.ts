import type { ApplyChannel, Autonomy, EmploymentType, JobStatus } from '../../shared/types';

/** Operator-facing names, shared so every screen words things the same way. */
export const AUTONOMY_LABEL: Record<Autonomy, string> = {
  notify: 'Notify',
  draft: 'Draft → Approve',
  autonomous: 'Autonomous',
};

export const CHANNEL_LABEL: Record<ApplyChannel, string> = {
  email: 'Email',
  ats: 'ATS form',
  platform: 'Platform apply',
  custom: 'Career site',
};

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  'full-time': 'Full-time',
  contract: 'Contract',
  freelance: 'Freelance',
};

export const STATUS_LABEL: Record<JobStatus, string> = {
  found: 'Found',
  scored: 'Scored',
  drafted: 'Drafted',
  approved: 'Approved, not sent',
  applied: 'Applied',
  replied: 'Replied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'No reply',
  skipped: 'Skipped',
};
