import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Blocks } from './blocks';

describe('Blocks', () => {
  it('draws the total as blocks and fills the first n', () => {
    const { container } = render(<Blocks filled={3} total={8} tone="ice" />);
    expect(container.querySelectorAll('.blocks > span')).toHaveLength(8);
    expect(container.querySelectorAll('.blocks > span.on')).toHaveLength(3);
  });

  it('is decorative unless it is given a meter label and value', () => {
    const { container, rerender } = render(<Blocks filled={1} total={10} tone="lavender" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<Blocks filled={1} total={10} tone="lavender" meter={{ label: 'Tokens used', now: 55 }} />);
    const meter = screen.getByRole('meter', { name: 'Tokens used' });
    expect(meter).toHaveAttribute('aria-valuenow', '55');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
  });

  it('passes extra classes through for page hooks', () => {
    const { container } = render(<Blocks filled={0} total={2} tone="lavender" className="x-meter" />);
    expect(container.querySelector('.blocks.x-meter')).not.toBeNull();
  });
});
