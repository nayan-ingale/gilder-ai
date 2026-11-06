import { describe, expect, it } from 'vitest';
import type { PackageNote } from '../data/schema.ts';
import type { IndexedPackage } from '../data/source-index.ts';
import { guides } from '../model/index.ts';
import { STACK_LAYER_LABEL } from '../model/labels.ts';
import {
  LAYER_ORDER,
  OTHER_LABEL,
  appLabel,
  buildPackageTable,
  groupUses,
  isTypeDefinitions,
  nameParts,
} from './packages.ts';

const uses = (app: string, version: string, dev = false) => ({ app, version, dev });

const packages: IndexedPackage[] = [
  { name: '@types/express', usedBy: [uses('gateway', '^5.0.6', true)] },
  { name: 'eslint', usedBy: [uses('root', '^10.14.0', true), uses('frontend', '^9.39.5', true)] },
  { name: 'express', usedBy: [uses('gateway', '^5.3.0'), uses('shared', '^5.3.0')] },
  { name: 'left-pad', usedBy: [uses('shared', '1.0.0')] },
  { name: 'next', usedBy: [uses('frontend', '16.4.4')] },
];

const notes: PackageNote[] = [
  { name: 'eslint', layer: 'quality', why: 'Lints the code.' },
  { name: 'express', layer: 'backend', why: 'Serves HTTP.' },
  { name: 'next', layer: 'frontend', why: 'Renders the app.' },
];
const getNote = (name: string) => notes.find((note) => note.name === name);

describe('groupUses', () => {
  it('puts apps that list the same version the same way together', () => {
    expect(
      groupUses([
        uses('gateway', '^5.3.0'),
        uses('root', '^10.14.0', true),
        uses('shared', '^5.3.0'),
        uses('auth', '^5.3.0', true),
      ]),
    ).toEqual([
      { version: '^5.3.0', dev: false, apps: ['gateway', 'shared'] },
      { version: '^10.14.0', dev: true, apps: ['root'] },
      { version: '^5.3.0', dev: true, apps: ['auth'] },
    ]);
  });
});

describe('appLabel', () => {
  it("names the root package.json as the repo's tooling", () => {
    expect(appLabel('root')).toBe('repo tooling');
    expect(appLabel('gateway')).toBe('gateway');
  });
});

describe('buildPackageTable', () => {
  const table = buildPackageTable(packages, getNote);

  it('groups packages by layer, in stack order, with unnoted ones under Other', () => {
    expect(
      table.groups.map((group) => [group.label, group.packages.map((row) => row.name)]),
    ).toEqual([
      [STACK_LAYER_LABEL.frontend, ['next']],
      [STACK_LAYER_LABEL.backend, ['express']],
      [STACK_LAYER_LABEL.quality, ['eslint']],
      [OTHER_LABEL, ['left-pad']],
    ]);
    expect(table.groups.find((group) => group.id === 'other')?.packages[0]?.why).toBeUndefined();
  });

  it('sets the type definitions apart', () => {
    expect(table.typeDefinitions.map((row) => row.name)).toEqual(['@types/express']);
    expect(table.total).toBe(packages.length);
  });

  it('keeps each version an app lists', () => {
    const eslint = table.groups
      .flatMap((group) => group.packages)
      .find((row) => row.name === 'eslint');
    expect(eslint?.uses).toEqual([
      { version: '^10.14.0', dev: true, apps: ['root'] },
      { version: '^9.39.5', dev: true, apps: ['frontend'] },
    ]);
  });

  it('lists every installed package exactly once', () => {
    const real = buildPackageTable(guides.packages, guides.getPackageNote);
    const listed = [...real.groups.flatMap((group) => group.packages), ...real.typeDefinitions].map(
      (row) => row.name,
    );
    expect(listed.toSorted()).toEqual(guides.packages.map((entry) => entry.name).toSorted());
    expect(
      real.groups.flatMap((group) => group.packages).some((row) => isTypeDefinitions(row.name)),
    ).toBe(false);
    const order = [...LAYER_ORDER, 'other'];
    const ids = real.groups.map((group) => order.indexOf(group.id));
    expect(ids).toEqual(ids.toSorted((a, b) => a - b));
  });
});

describe('nameParts', () => {
  it('cuts a name after each slash only', () => {
    expect(nameParts('@tailwindcss/turbopack')).toEqual(['@tailwindcss/', 'turbopack']);
    expect(nameParts('eslint-config-prettier')).toEqual(['eslint-config-prettier']);
  });
});
