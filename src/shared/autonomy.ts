import type { ApplyChannel, Autonomy } from './types';

/** Least → most autonomous; index order is what "capping" compares. */
export const AUTONOMY_LEVELS: readonly Autonomy[] = ['notify', 'draft', 'autonomous'];

/**
 * Highest autonomy each channel may run at (SPEC F5). Platform and custom
 * sites never send on their own — that is the no-ban-risk principle.
 */
const CHANNEL_MAX: Record<ApplyChannel, Autonomy> = {
  email: 'autonomous',
  ats: 'autonomous',
  platform: 'draft',
  custom: 'draft',
};

/** Returns the autonomy ceiling for a channel. */
export function maxAutonomyFor(channel: ApplyChannel): Autonomy {
  return CHANNEL_MAX[channel];
}

/**
 * Effective autonomy for a job: the lower of what its source asks for and
 * what its apply channel allows. Used to label what will actually happen.
 */
export function capAutonomy(requested: Autonomy, channel: ApplyChannel): Autonomy {
  const ceiling = CHANNEL_MAX[channel];
  return AUTONOMY_LEVELS.indexOf(requested) <= AUTONOMY_LEVELS.indexOf(ceiling) ? requested : ceiling;
}
