import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Reads the real tokens.css, so the test checks exactly what the browser gets.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** The `--name: value` pairs inside the block that starts with `selector {`. */
function tokensIn(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`no block for ${selector}`);
  }
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const light = tokensIn(':root');
const dark = tokensIn(":root[data-theme='dark']");

// Every pairing the components use for text. AA needs 4.5:1 for normal text.
const TEXT_PAIRINGS: [text: string, background: string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'raised'],
  ['text', 'sunken'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-subtle', 'bg'],
  ['text-subtle', 'surface'],
  ['accent-text', 'bg'],
  ['accent-text', 'surface'],
  ['accent-ink', 'accent'],
  ['danger', 'bg'],
  ['success', 'bg'],
  ['warning', 'bg'],
  ['text', 'user-bg'],
  ['code-text', 'code-bg'],
];

describe('design tokens', () => {
  it('define the same names in light and dark', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('use one set of dark values for "follow the system" and for an explicit choice', () => {
    expect(tokensIn("  :root:not([data-theme='light'])")).toEqual(dark);
  });

  for (const [themeName, theme] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`pass WCAG AA for every text pairing in the ${themeName} theme`, () => {
      const failures = TEXT_PAIRINGS.flatMap(([text, background]) => {
        const ratio = contrast(theme[text]!, theme[background]!);
        return ratio >= 4.5 ? [] : [`${text} on ${background}: ${ratio.toFixed(2)}`];
      });

      expect(failures).toEqual([]);
    });
  }
});
