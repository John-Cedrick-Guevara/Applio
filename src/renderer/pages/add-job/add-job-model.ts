/** Input-level check before spending tokens on analysis. Returns the message to show, or null. */
export function inputError(kind: 'text' | 'link', value: string): string | null {
  const v = value.trim();
  if (!v) return kind === 'link' ? 'Paste a job link first.' : 'Paste the job post first.';
  if (kind === 'link' && !/^https?:\/\//i.test(v)) return 'That does not look like a link. It should start with https://';
  return null;
}

export const EXAMPLES = {
  text: 'Brightline Studio is hiring a Senior TypeScript Engineer. Remote, worldwide, contract. Node.js, PostgreSQL, React. $60–75/hr. Send your CV to hiring@brightline.example\n\n(posted in Remote Devs, a Facebook group)',
  link: 'https://www.linkedin.com/jobs/view/0000000000',
} as const;
