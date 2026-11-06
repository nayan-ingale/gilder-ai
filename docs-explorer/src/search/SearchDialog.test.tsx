// Checks the search dialog's structure for assistive technology: the box is a combobox that
// controls a listbox of labelled groups, and the first result starts active. Rendered to static
// HTML, so effects (opening the dialog) don't run; the markup is what matters here.
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NAV } from '../routes.ts';
import { SearchDialog } from './SearchDialog.tsx';

const html = renderToStaticMarkup(
  <MemoryRouter>
    <SearchDialog open={false} onClose={() => undefined} />
  </MemoryRouter>,
);

const attribute = (tag: string, name: string): string | undefined =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

const tagsWithRole = (role: string): string[] =>
  [...html.matchAll(new RegExp(`<[^>]*role="${role}"[^>]*>`, 'g'))].map((match) => match[0]);

describe('SearchDialog', () => {
  it('is a combobox that controls the result list', () => {
    const [combobox] = tagsWithRole('combobox');
    const [listbox] = tagsWithRole('listbox');
    expect(combobox).toBeDefined();
    expect(listbox).toBeDefined();
    expect(attribute(combobox ?? '', 'aria-controls')).toBe(attribute(listbox ?? '', 'id'));
    expect(attribute(combobox ?? '', 'aria-autocomplete')).toBe('list');
    expect(attribute(combobox ?? '', 'aria-expanded')).toBe('true');
  });

  it('starts with the pages to jump to, the first one active', () => {
    const options = tagsWithRole('option');
    expect(options).toHaveLength(NAV.length);
    const [combobox] = tagsWithRole('combobox');
    const active = attribute(combobox ?? '', 'aria-activedescendant');
    expect(active).toBe(attribute(options[0] ?? '', 'id'));
    expect(options.map((option) => attribute(option, 'aria-selected'))).toEqual(
      NAV.map((_, index) => String(index === 0)),
    );
  });

  it('labels each group with visible text', () => {
    const [group] = tagsWithRole('group');
    const labelId = attribute(group ?? '', 'aria-labelledby');
    expect(labelId).toBeDefined();
    const at = html.indexOf(`id="${labelId}"`);
    expect(at).toBeGreaterThan(-1);
    expect(html.slice(html.indexOf('>', at) + 1)).toMatch(/^Jump to</);
  });
});
