import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TabList, TabPanel } from './tabs';

const TABS = [{ id: 'a', label: 'Alpha', count: 3 }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];

function Demo() {
  const [value, setValue] = useState('a');
  return (
    <>
      <TabList label="Sections" idPrefix="demo" tabs={TABS} value={value} onChange={setValue} />
      {TABS.map((t) => <TabPanel key={t.id} idPrefix="demo" id={t.id} active={value === t.id}><p>{t.label} body</p></TabPanel>)}
    </>
  );
}

describe('TabList', () => {
  it('selects a tab on click and shows only its panel', async () => {
    render(<Demo />);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Beta body');
    expect(screen.getByText('Alpha body')).not.toBeVisible();
  });

  it('shows a count when a tab has one', () => {
    render(<Demo />);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveTextContent('3');
  });

  it('moves with arrow keys, Home and End, wrapping, and labels each panel by its tab', async () => {
    render(<Demo />);
    screen.getByRole('tab', { name: /Alpha/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: 'Gamma' }).id);
  });

  it('keeps only the selected tab in the tab order', () => {
    render(<Demo />);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '-1');
  });
});
