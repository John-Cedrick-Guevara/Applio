// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
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

describe('v3 type and control floor', () => {
  const root = new URL('..', import.meta.url);
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.css'));
  const all = files.map((f) => readFileSync(new URL(f, root), 'utf8')).join('\n');
  const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const token = (name: string) => Number(tokens.match(new RegExp(`--${name}:\\s*([\\d.]+)px`))?.[1]);

  it('never sets text below 12px, in tokens or hard-coded', () => {
    const sizes = [...all.matchAll(/(?:font-size:|--text-[\w-]+:)\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter((s) => s < 12)).toEqual([]);
  });

  it('keeps text on the 12 / 14 / 16 / 20 / 24 scale, plus big score numbers', () => {
    const sizes = new Set([...all.matchAll(/(?:font-size:|--text-[\w-]+:)\s*([\d.]+)px/g)].map((m) => Number(m[1])));
    expect([...sizes].filter((s) => ![12, 14, 16, 20, 24, 32].includes(s))).toEqual([]);
  });

  it('makes buttons at least 44px tall', () => {
    expect(token('control-h')).toBeGreaterThanOrEqual(44);
    expect(token('control-h-sm')).toBeGreaterThanOrEqual(44);
  });

  it('keeps light shadows under 8% opacity', () => {
    // Shadows only: a dialog's dimmed backdrop is a scrim, not a shadow.
    const shadows = [...all.matchAll(/(?:box-shadow|--shadow-[\w-]+):([^;]*);/g)].map((m) => m[1]).join(' ');
    const alphas = [...shadows.matchAll(/rgb\(\s*\d+ \d+ \d+ \/ (0?\.\d+)\)/g)].map((m) => Number(m[1]));
    expect(alphas.filter((a) => a >= 0.08)).toEqual([]);
  });

  it('gives strong buttons the same blue as primary ones, so each view has one accent', () => {
    expect(all).toMatch(/\.btn-strong\s*\{[^}]*background:\s*var\(--accent\)/);
  });
});

describe('chopped UI fixes', () => {
  const base = readFileSync(new URL('./base.css', import.meta.url), 'utf8');
  const components = readFileSync(new URL('./components.css', import.meta.url), 'utf8');

  it('keeps the step-list dot rule off the row\'s state class', () => {
    // The row is named step-list-<state>; a 12px dot rule on .step-list-pending shrank every pending row to a circle.
    expect(components).not.toMatch(/\.step-list-pending\s*\{[^}]*width:\s*12px/);
    expect(components).toMatch(/\.step-list-dot\s*\{[^}]*width:\s*12px/);
  });

  it('keeps primary buttons white inside warning, danger and success banners', () => {
    // `.banner-warning a { color: inherit }` is more specific than `.btn-primary`, leaving amber text on blue.
    expect(components).toMatch(/\.banner-warning \.btn-primary[^{]*\{[^}]*color:\s*var\(--on-accent\)/);
    expect(components).toMatch(/\.banner-danger \.btn-primary[^{]*\{[^}]*color:\s*var\(--on-accent\)/);
    // `.banner-success a` is just as specific: "Open it" in the green restored banner came out green on blue.
    expect(components).toMatch(/\.banner-success \.btn-primary[^{]*\{[^}]*color:\s*var\(--on-accent\)/);
  });

  it('spaces the buttons in a Matches row apart', () => {
    const matches = readFileSync(new URL('../pages/matches/matches.css', import.meta.url), 'utf8');
    expect(matches).toMatch(/\.matches-actions\s*>\s*\*\s*\+\s*\*\s*\{[^}]*margin-left:/);
  });

  it('pins the activity bar flush to the top, by cancelling the page padding in its sticky offset', () => {
    // Chrome measures a sticky `top` from the scroll container's content edge, so `top: 0` left the bar 28px down, over the page's first lines.
    expect(base).toMatch(/\.activity-bar\s*\{[^}]*top:\s*-28px/);
    expect(base).toMatch(/\.activity-bar\s*\{[^}]*top:\s*calc\(-1 \* var\(--space-4\)\)/);
  });
});
