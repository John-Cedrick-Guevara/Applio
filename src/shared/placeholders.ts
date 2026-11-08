/**
 * The first template placeholder left in text meant to be sent, like "[Your Name]"
 * or "[Company]", or undefined when there is none. Sends refuse text that has one,
 * so a recruiter never gets a half-filled template.
 */
export function findPlaceholder(text: string): string | undefined {
  return /\[[^\]\n]{1,40}\]/.exec(text)?.[0];
}
