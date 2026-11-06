import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { IndexedPackage, PackageIndex } from '../../src/data/source-index.ts';
import { ROOT_APP } from '../../src/guides/packages.ts';
import { expandFolders } from './files.ts';

/** The workspace folder of this explorer. It documents the product, so its packages aren't listed. */
const EXPLORER_FOLDER = 'docs-explorer';

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * The folder globs under `packages:` in pnpm-workspace.yaml, in order. Reads only the plain
 * `- path` lines that file uses, so the indexer needs no YAML package. The list ends at the next
 * top-level key.
 */
export function parseWorkspaceGlobs(yaml: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const line of yaml.split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item) {
      const glob = inPackages ? plainValue(item[1] ?? '') : '';
      if (glob !== '') {
        globs.push(glob);
      }
    } else if (/^[^\s#]/.test(line)) {
      // Any other line that starts at the margin is a top-level key.
      inPackages = /^packages\s*:/.test(line);
    }
  }
  return globs;
}

/** A list item's value without its trailing comment and its quotes. */
function plainValue(raw: string): string {
  return raw
    .replace(/(^|\s)#.*$/, '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
}

/**
 * Each app's package.json: the repo root first, then every workspace folder in the order
 * pnpm-workspace.yaml lists them. Apps are named after their folder, as the indexer names that
 * app's files (`backend/services/auth` is `auth`).
 */
export function workspaceManifests(repoRoot: string): { app: string; path: string }[] {
  const globs = parseWorkspaceGlobs(
    readFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8'),
  );
  // Fail loudly rather than quietly leave an app's packages out of the list.
  if (globs.length === 0) {
    throw new Error('pnpm-workspace.yaml lists no packages as `- path` lines');
  }
  const unsupported = globs.find(
    (glob) =>
      glob.startsWith('!') ||
      glob.split('/').some((segment) => segment.includes('*') && segment !== '*'),
  );
  if (unsupported) {
    throw new Error(
      `pnpm-workspace.yaml lists ${unsupported}: only plain folders and whole-folder * are read`,
    );
  }
  const folders = new Set(globs.flatMap((glob) => expandFolders(repoRoot, glob)));
  folders.delete(EXPLORER_FOLDER);
  return [
    { app: ROOT_APP, path: 'package.json' },
    ...[...folders].map((folder) => ({
      app: path.posix.basename(folder),
      path: `${folder}/package.json`,
    })),
  ].filter((manifest) => existsSync(path.join(repoRoot, manifest.path)));
}

/**
 * Every npm package the apps list, with the version each app asks for. Workspace links
 * (`workspace:*`) are the project's own code, which the source index already covers.
 */
export function buildPackageIndex(manifests: { app: string; manifest: Manifest }[]): PackageIndex {
  const byName = new Map<string, IndexedPackage>();
  for (const { app, manifest } of manifests) {
    const lists = [
      [manifest.dependencies, false],
      [manifest.devDependencies, true],
    ] as const;
    for (const [dependencies, dev] of lists) {
      for (const [name, version] of Object.entries(dependencies ?? {})) {
        if (version.startsWith('workspace:')) {
          continue;
        }
        const entry = byName.get(name) ?? { name, usedBy: [] };
        entry.usedBy.push({ app, version, dev });
        byName.set(name, entry);
      }
    }
  }
  return { packages: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

export function collectPackages(repoRoot: string): PackageIndex {
  return buildPackageIndex(
    workspaceManifests(repoRoot).map(({ app, path: manifestPath }) => ({
      app,
      manifest: JSON.parse(readFileSync(path.join(repoRoot, manifestPath), 'utf8')) as Manifest,
    })),
  );
}
