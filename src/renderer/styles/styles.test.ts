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
