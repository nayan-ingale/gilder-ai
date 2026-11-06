import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackageIndex, parseWorkspaceGlobs, workspaceManifests } from './packages.ts';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Creates a throwaway repo with the given files (path → content). */
function makeRepo(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'indexer-packages-')));
  tempDirs.push(root);
  for (const [filePath, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
    writeFileSync(path.join(root, filePath), content);
  }
  return root;
}

describe('parseWorkspaceGlobs', () => {
  it('reads the list under packages: in order, and stops at the next top-level key', () => {
    const yaml = [
      '# The apps in this repo.',
      'packages:',
      '  - frontend # the web app',
      "  - 'backend/gateway'",
      '  - "backend/services/*"',
      '',
      '  # Shared code',
      '  - backend/shared',
      '',
      'allowBuilds:',
      '  - esbuild',
      'catalog:',
      '  zod: ^4.0.0',
    ].join('\n');

    expect(parseWorkspaceGlobs(yaml)).toEqual([
      'frontend',
      'backend/gateway',
      'backend/services/*',
      'backend/shared',
    ]);
  });

  it('reads items written at the margin, and finds nothing without a packages key', () => {
    expect(parseWorkspaceGlobs('packages:\n- frontend\n- backend/*\n')).toEqual([
      'frontend',
      'backend/*',
    ]);
    expect(parseWorkspaceGlobs('onlyBuiltDependencies:\n  - esbuild\n')).toEqual([]);
  });
});

describe('workspaceManifests', () => {
  it('lists the root, then each workspace app by folder name, without the explorer', () => {
    const root = makeRepo({
      'pnpm-workspace.yaml':
        'packages:\n  - frontend\n  - backend/gateway\n  - backend/services/*\n  - backend/shared\n  - docs-explorer\n',
      'package.json': '{}',
      'frontend/package.json': '{}',
      'backend/gateway/package.json': '{}',
      'backend/services/chat/package.json': '{}',
      'backend/services/auth/package.json': '{}',
      // A folder with no package.json isn't an app.
      'backend/services/notes/README.md': '',
      'backend/shared/package.json': '{}',
      'docs-explorer/package.json': '{}',
    });

    expect(workspaceManifests(root)).toEqual([
      { app: 'root', path: 'package.json' },
      { app: 'frontend', path: 'frontend/package.json' },
      { app: 'gateway', path: 'backend/gateway/package.json' },
      { app: 'auth', path: 'backend/services/auth/package.json' },
      { app: 'chat', path: 'backend/services/chat/package.json' },
      { app: 'shared', path: 'backend/shared/package.json' },
    ]);
  });

  it('refuses globs it cannot read, rather than leave apps out', () => {
    const negated = makeRepo({ 'pnpm-workspace.yaml': "packages:\n  - '!**/test/**'\n" });
    const deep = makeRepo({ 'pnpm-workspace.yaml': 'packages:\n  - packages/**\n' });
    const empty = makeRepo({ 'pnpm-workspace.yaml': 'packages: [frontend]\n' });

    expect(() => workspaceManifests(negated)).toThrow('pnpm-workspace.yaml lists !**/test/**');
    expect(() => workspaceManifests(deep)).toThrow('pnpm-workspace.yaml lists packages/**');
    expect(() => workspaceManifests(empty)).toThrow('pnpm-workspace.yaml lists no packages');
  });
});

describe('buildPackageIndex', () => {
  it('lists each package once with every app that uses it, sorted by name', () => {
    const index = buildPackageIndex([
      {
        app: 'gateway',
        manifest: {
          dependencies: { express: '^5.3.0', '@gilder/shared': 'workspace:*' },
          devDependencies: { vitest: '5.1.0' },
        },
      },
      { app: 'shared', manifest: { dependencies: { express: '^5.3.0', pino: '^10.4.0' } } },
      { app: 'root', manifest: {} },
    ]);

    expect(index.packages).toEqual([
      {
        name: 'express',
        usedBy: [
          { app: 'gateway', version: '^5.3.0', dev: false },
          { app: 'shared', version: '^5.3.0', dev: false },
        ],
      },
      { name: 'pino', usedBy: [{ app: 'shared', version: '^10.4.0', dev: false }] },
      { name: 'vitest', usedBy: [{ app: 'gateway', version: '5.1.0', dev: true }] },
    ]);
  });
});
