import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('is a decorative moving bar: the words beside it say what is happening', () => {
    const { container } = render(<ProgressBar />);
    const bar = container.firstElementChild!;
    expect(bar).toHaveClass('indet');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });
});
