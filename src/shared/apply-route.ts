import { maxAutonomyFor } from './autonomy';
import type { ApplyChannel, Autonomy } from './types';

/** How Applio will apply through a channel, in words, and the most it may do alone (SPEC F5). */
export function describeRoute(channel: ApplyChannel | null, applyTarget: string, assistedFill = false): { channelLabel: string; route: string; maxAutonomy: Autonomy } {
  switch (channel) {
    case 'email': return { channelLabel: 'Email', route: `Sends from your Gmail to ${applyTarget}`, maxAutonomy: maxAutonomyFor('email') };
    case 'ats': return { channelLabel: 'Standard ATS form', route: 'Fills and submits in Applio’s own window', maxAutonomy: maxAutonomyFor('ats') };
    case 'platform': return { channelLabel: 'Platform apply', route: assistedFill ? 'Fills the form in your signed-in session; you click Submit' : 'Manual handoff (assisted fill is off)', maxAutonomy: maxAutonomyFor('platform') };
    case 'custom': return { channelLabel: 'Company career site', route: 'Manual handoff: Applio prepares everything, you apply', maxAutonomy: maxAutonomyFor('custom') };
    default: return { channelLabel: 'Not found in the post', route: 'Manual: reply to the post or message the poster yourself', maxAutonomy: 'draft' };
  }
}
