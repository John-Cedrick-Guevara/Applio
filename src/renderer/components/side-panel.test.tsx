import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SidePanel } from './side-panel';

function Harness({ position }: { position?: { index: number; total: number; onPrev: () => void; onNext: () => void } }) {
  const [open, setOpen] = useState(false);
  return (
    <div id="root">
      <button onClick={() => setOpen(true)}>Open job</button>
      {open ? (
        <SidePanel title="Backend Developer" onClose={() => setOpen(false)} position={position}>
          <button>Approve</button>
          <button>Skip</button>
        </SidePanel>
      ) : null}
    </div>
  );
}

describe('SidePanel', () => {
  it('moves focus in and returns it on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open job' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Backend Developer' })).toContainElement(document.activeElement as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape and on the dim layer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    await user.click(screen.getByTestId('side-panel-dim'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Tab inside', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('shows its position and steps', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Harness position={{ index: 3, total: 28, onPrev, onNext }} />);
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    expect(screen.getByText('3 of 28')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('disables Previous on the first item and Next on the last', async () => {
    const user = userEvent.setup();
    render(<Harness position={{ index: 1, total: 1, onPrev: () => {}, onNext: () => {} }} />);
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('labels the close button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('makes the page behind it inert while open and live again after', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const page = container.querySelector('#root') as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Open job' }));
    expect(page).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(page).not.toHaveAttribute('inert');
  });
});
