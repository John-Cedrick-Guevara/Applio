// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./base.css', import.meta.url), 'utf8');

/** Body of the first rule whose selector list is exactly `selector`. */
const rule = (selector: string) => css.match(new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('app frame layout', () => {
  it('contains absolutely positioned helpers inside the scrolling content area', () => {
    // Screen-reader-only labels are position:absolute. Without a positioned
    // ancestor they anchor to the page and stretch it, giving the window a second
    // scrollbar and cutting the sidebar background short.
    expect(rule('.visually-hidden')).toMatch(/position:\s*absolute/);
    expect(rule('.app-main')).toMatch(/position:\s*relative/);
  });
});
