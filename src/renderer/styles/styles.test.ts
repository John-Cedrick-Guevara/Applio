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

describe('v5 foundation', () => {
  const root = new URL('..', import.meta.url);
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.css'));
  const all = files.map((f) => readFileSync(new URL(f, root), 'utf8')).join('\n');
  const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
  const px = (name: string) => Number(tokens.match(new RegExp(`--${name}:\\s*([\\d.]+)px`))?.[1]);
  const hex = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
  const sizes = () => [...all.matchAll(/(?:font-size:|--text-[\w-]+:)\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  /** WCAG contrast ratio of two #rrggbb colours. */
  const contrast = (a: string, b: string) => {
    const chan = (h: string, i: number) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = (h: string) => 0.2126 * chan(h, 1) + 0.7152 * chan(h, 3) + 0.0722 * chan(h, 5);
    return (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  };

  it('loads Plus Jakarta Sans 400-700 from the package and sets it as the font', () => {
    for (const w of [400, 500, 600, 700]) expect(main).toContain(`@fontsource/plus-jakarta-sans/${w}.css`);
    expect(tokens).toMatch(/--font:\s*'Plus Jakarta Sans'/);
    expect(all).not.toMatch(/fonts\.googleapis|https?:\/\/[^\s)]*font/);
  });

  it('defines the v5 colour tokens', () => {
    const want: Record<string, string> = {
      ink: '#141519', 'text-muted': '#5e626b', border: '#e7e7e3', bg: '#f5f5f2', surface: '#ffffff',
      'lavender-tint': '#eeeffc', 'lavender-block': '#a7adf0', 'lavender-mark': '#7c83e6', 'lavender-ink': '#3d43a8',
      'pink-tint': '#fbeaf0', 'pink-mark': '#e58aa8', 'ice-tint': '#e8f0f3', 'ice-block': '#bccbd3',
      'success-soft': '#e9f5ee', 'success-text': '#145a37', success: '#2f8a57',
      'warning-soft': '#fdf1de', 'warning-text': '#7a4508', warning: '#b4690e',
      'danger-soft': '#fce8e6', 'danger-text': '#8f1d14', danger: '#c0362c',
      'neutral-soft': '#eef2f4', 'focus-ring-color': '#5b62d6',
    };
    const wrong = Object.entries(want).filter(([k, v]) => hex(k) !== v);
    expect(wrong).toEqual([]);
  });

  it('paints the dot grid on the page ground', () => {
    const base = readFileSync(new URL('./base.css', import.meta.url), 'utf8');
    expect(base).toMatch(/body\s*\{[^}]*radial-gradient\(#dadad4 1px, transparent 1px\)[^}]*22px 22px/i);
  });

  it('never sets text below 12px, in tokens or hard-coded', () => {
    expect(sizes().length).toBeGreaterThan(0);
    expect(sizes().filter((s) => s < 12)).toEqual([]);
  });

  it('keeps text on the v5 scale', () => {
    expect(sizes().filter((s) => ![12, 13, 14, 17, 22, 28, 34, 44].includes(s))).toEqual([]);
  });

  it('makes normal buttons 40px and small ones 36px', () => {
    expect(px('control-h')).toBe(40);
    expect(px('control-h-sm')).toBe(36);
  });

  it('makes buttons pills', () => {
    expect(all).toMatch(/\.btn\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
  });

  it('gives strong buttons the ink fill of primary ones', () => {
    expect(all).toMatch(/\.btn-primary\s*\{[^}]*background:\s*var\(--ink\)/);
    expect(all).toMatch(/\.btn-strong\s*\{[^}]*background:\s*var\(--ink\)/);
  });

  it('greys a disabled button with muted text', () => {
    expect(all).toMatch(/\.btn-strong:disabled\s*\{[^}]*background:\s*var\(--border\)[^}]*color:\s*var\(--text-muted\)/);
  });

  it('greys every disabled button variant, not only primary', () => {
    for (const v of ['btn-secondary', 'btn-ghost', 'btn-danger', 'btn-destructive']) {
      expect(all, v).toMatch(new RegExp(`\\.${v}:disabled`));
    }
  });

  it('shows hover on ink buttons by lightening them', () => {
    expect(all).toMatch(/\.btn-primary:hover:not\(:disabled\)[^{]*\{[^}]*background:\s*var\(--ink-hover\)/);
    expect(hex('ink-hover')).toBe('#2e3038');
  });

  it('uses tabular figures for numbers', () => {
    expect(all).toMatch(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it('keeps the job card primary button ink, like every other primary', () => {
    expect(all).toMatch(/\.job-card-actions \.btn-primary\s*\{[^}]*background:\s*var\(--ink\)/);
  });

  it('makes icon buttons 36px circles and small buttons outlined', () => {
    expect(all).toMatch(/\.btn-icon\s*\{[^}]*height:\s*var\(--control-h-sm\)/);
    expect(all).toMatch(/\.btn-sm\s*\{[^}]*border-color:\s*var\(--border-strong\)/);
  });

  it('lets pills grow instead of clipping a long label', () => {
    expect(all).toMatch(/\.pill\s*\{[^}]*min-height:\s*var\(--control-h\)/);
  });

  it('gives cards a 20px radius and 20px padding', () => {
    expect(px('radius-card')).toBe(20);
    const card = all.match(/\.card\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(card).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(card).toMatch(/padding:\s*var\(--space-5\)/);
  });

  it('makes tabs 40px pills', () => {
    expect(all).toMatch(/\.tab\s*\{[^}]*min-height:\s*var\(--control-h\)[^}]*border-radius:\s*var\(--radius-pill\)/);
  });

  it('colours each badge with its v5 ground and ink', () => {
    expect(all).toMatch(/\.badge-success\s*\{[^}]*var\(--success-soft\)[^}]*var\(--success-text\)/);
    expect(all).toMatch(/\.badge-warning\s*\{[^}]*var\(--warning-soft\)[^}]*var\(--warning-text\)/);
    expect(all).toMatch(/\.badge-danger\s*\{[^}]*var\(--danger-soft\)[^}]*var\(--danger-text\)/);
    expect(all).toMatch(/\.badge-accent\s*\{[^}]*var\(--lavender-tint\)[^}]*var\(--lavender-ink\)/);
  });

  it('keeps chip, button and muted text at 4.5:1', () => {
    const pairs: [string, string][] = [
      ['success-text', 'success-soft'], ['warning-text', 'warning-soft'], ['danger-text', 'danger-soft'],
      ['lavender-ink', 'lavender-tint'], ['text-muted', 'bg'], ['text-muted', 'surface'], ['on-ink', 'ink'], ['text-muted', 'border'],
    ];
    const low = pairs.filter(([f, b]) => contrast(hex(f) ?? '#000000', hex(b) ?? '#000000') < 4.5);
    expect(low).toEqual([]);
  });

  it('draws a 2px lavender focus ring', () => {
    expect(tokens).toMatch(/--focus-ring:\s*0 0 0 2px var\(--surface\),\s*0 0 0 4px var\(--focus-ring-color\)/);
  });

  it('stops motion under reduced motion', () => {
    expect(tokens).toMatch(/prefers-reduced-motion[^}]*--duration:\s*0ms/);
  });

  it('sets page titles light with a bold word', () => {
    const components = readFileSync(new URL('./components.css', import.meta.url), 'utf8');
    expect(components).toMatch(/\.page-header h1\s*\{[^}]*font-weight:\s*400/);
    expect(components).toMatch(/\.page-header h1 strong\s*\{[^}]*font-weight:\s*700/);
  });

  it('draws the 7-day chart in lavender mark with today in darker lavender ink', () => {
    const usage = readFileSync(new URL('../pages/usage/usage.css', import.meta.url), 'utf8');
    expect(usage).toMatch(/\.day-bar\s*\{[^}]*background:\s*var\(--lavender-mark\)/);
    expect(usage).toMatch(/\.day-bar-today\s*\{[^}]*background:\s*var\(--lavender-ink\)/);
  });

  it('draws the wait bar moving, and still under reduced motion', () => {
    const components = readFileSync(new URL('./components.css', import.meta.url), 'utf8');
    expect(components).toMatch(/\.indet::after\s*\{[^}]*animation:\s*indet-slide/);
    expect(components).toMatch(/prefers-reduced-motion[^}]*\{[^}]*\.indet::after\s*\{[^}]*animation:\s*none/);
  });

  it('centres the Get jobs and Profile columns at their widths', () => {
    const rule = (css: string, selector: string) => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.>]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    const getJobs = readFileSync(new URL('../pages/get-jobs/get-jobs.css', import.meta.url), 'utf8');
    const profile = readFileSync(new URL('../pages/profile/profile.css', import.meta.url), 'utf8');
    for (const [css, selector, width] of [[getJobs, '.get-jobs', '820px'], [profile, '.profile', '1040px']] as const) {
      const body = rule(css, selector);
      expect(body, selector).toMatch(new RegExp(`max-width:\\s*${width}`));
      expect(body, selector).toMatch(/margin:\s*0 auto/);
      expect(body, selector).toMatch(/width:\s*100%/);
    }
  });

  it('keeps the Get jobs tab group as wide as its tabs', () => {
    const getJobs = readFileSync(new URL('../pages/get-jobs/get-jobs.css', import.meta.url), 'utf8');
    expect(getJobs).toMatch(/\.get-jobs > \.tabs\s*\{[^}]*align-self:\s*flex-start/);
  });

  it('makes the side panel 640px wide, still capped to the window', () => {
    const components = readFileSync(new URL('./components.css', import.meta.url), 'utf8');
    expect(components).toMatch(/\.side-panel\s*\{[^}]*width:\s*min\(640px, 100%\)/);
  });

  it('keeps light shadows under 8% opacity', () => {
    // Shadows only: a dialog's dimmed backdrop is a scrim, not a shadow.
    const shadows = [...all.matchAll(/(?:box-shadow|--shadow-[\w-]+):([^;]*);/g)].map((m) => m[1]).join(' ');
    const alphas = [...shadows.matchAll(/rgb\(\s*\d+ \d+ \d+ \/ (0?\.\d+)\)/g)].map((m) => Number(m[1]));
    expect(alphas.filter((a) => a >= 0.08)).toEqual([]);
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
