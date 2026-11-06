// The tech stack's package table, worked out from the generated package list and the notes on
// why each package is used: grouped by where it sits in the stack, packages with no note under
// "Other", and the `@types/*` packages (type definitions only) set apart so they can be folded.
import type { PackageNote, StackLayer } from '../data/schema.ts';
import type { IndexedPackage, PackageUse } from '../data/source-index.ts';
import { STACK_LAYER_LABEL } from '../model/labels.ts';

/** The order the groups are listed in, from what users see down to the tooling. */
export const LAYER_ORDER: readonly StackLayer[] = [
  'frontend',
  'backend',
  'data',
  'ai',
  'payments',
  'quality',
  'tooling',
];

/** The app name the package list gives the repo's own tooling (its root package.json). */
export const ROOT_APP = 'root';

/** An app as the table names it: the root package.json is the repo's own tooling. */
export function appLabel(app: string): string {
  return app === ROOT_APP ? 'repo tooling' : app;
}

/** Apps that list a package at the same version, the same way (for running or dev only). */
export interface UsageGroup {
  version: string;
  dev: boolean;
  apps: string[];
}

/** Uses at the same version and kind become one group, in the order they first come. */
export function groupUses(uses: readonly PackageUse[]): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const use of uses) {
    const key = `${use.version}|${String(use.dev)}`;
    const group = groups.get(key);
    if (group) group.apps.push(use.app);
    else groups.set(key, { version: use.version, dev: use.dev, apps: [use.app] });
  }
  return [...groups.values()];
}

export interface PackageRow {
  name: string;
  /** Why the project uses it, when a note says. */
  why?: string;
  uses: UsageGroup[];
}

export type PackageGroupId = StackLayer | 'other';

export interface PackageGroup {
  id: PackageGroupId;
  label: string;
  packages: PackageRow[];
}

export interface PackageTable {
  /** Groups with at least one package, in LAYER_ORDER, then "Other". */
  groups: PackageGroup[];
  /** The `@types/*` packages, shown folded after the groups. */
  typeDefinitions: PackageRow[];
  /** Every package, type definitions included. */
  total: number;
}

export const OTHER_LABEL = 'Other';

/** A package name cut after each `/`: `@tailwindcss/turbopack` is `@tailwindcss/`, `turbopack`. */
export function nameParts(name: string): string[] {
  return name.split(/(?<=\/)/);
}

export function isTypeDefinitions(name: string): boolean {
  return name.startsWith('@types/');
}

export function buildPackageTable(
  packages: readonly IndexedPackage[],
  getNote: (name: string) => PackageNote | undefined,
): PackageTable {
  const byGroup = new Map<PackageGroupId, PackageRow[]>();
  const typeDefinitions: PackageRow[] = [];

  for (const entry of packages) {
    const note = getNote(entry.name);
    const row: PackageRow = { name: entry.name, why: note?.why, uses: groupUses(entry.usedBy) };
    if (isTypeDefinitions(entry.name)) {
      typeDefinitions.push(row);
      continue;
    }
    const id = note?.layer ?? 'other';
    byGroup.set(id, [...(byGroup.get(id) ?? []), row]);
  }

  const order: PackageGroupId[] = [...LAYER_ORDER, 'other'];
  const groups = order.flatMap((id): PackageGroup[] => {
    const rows = byGroup.get(id);
    if (!rows) return [];
    return [{ id, label: id === 'other' ? OTHER_LABEL : STACK_LAYER_LABEL[id], packages: rows }];
  });

  return { groups, typeDefinitions, total: packages.length };
}
