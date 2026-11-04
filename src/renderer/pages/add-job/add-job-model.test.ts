import { describe, expect, it } from 'vitest';
import { inputError } from './add-job-model';

describe('inputError', () => {
  it('asks for input first', () => {
    expect(inputError('text', '  ')).toBe('Paste the job post first.');
    expect(inputError('link', '')).toBe('Paste a job link first.');
  });

  it('only accepts web links', () => {
    expect(inputError('link', 'linkedin.com/jobs/1')).toMatch(/should start with https:\/\//);
    expect(inputError('link', 'https://www.linkedin.com/jobs/view/1')).toBeNull();
  });

  it('accepts any pasted text', () => {
    expect(inputError('text', 'Hiring a Go dev, email jobs@x.example')).toBeNull();
  });
});
