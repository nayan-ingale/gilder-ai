import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectSourceFiles, findSecret, isBlockedPath, isSourcePath } from './files.ts';

// Fake secrets are built from parts, so secret scanners don't flag this test file.
const FAKE_AWS_KEY = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
const FAKE_PEM_HEADER = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Creates a throwaway repo with the given files (path → content). */
function makeRepo(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'indexer-files-')));
  tempDirs.push(root);
  for (const [filePath, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
    writeFileSync(path.join(root, filePath), content);
  }
  return root;
}

describe('isBlockedPath', () => {
  it.each([
    'backend/gateway/.env',
    'backend/gateway/src/.env.local',
    'backend/services/auth/serviceAccountKey.json',
    'keys/internal.pem',
    'docs/DESIGN.md',
    'frontend/.next/server/page.js',
    'backend/shared/node_modules/zod/index.ts',
    'backend/shared/src/secrets.ts',
  ])('blocks %s', (filePath) => {
    expect(isBlockedPath(filePath)).toBe(true);
  });

  it.each([
    'backend/shared/src/errors.ts',
    'frontend/src/app/page.tsx',
    'backend/services/auth/src/keyboard.ts',
  ])('allows %s', (filePath) => {
    expect(isBlockedPath(filePath)).toBe(false);
  });
});

describe('isSourcePath', () => {
  it('keeps .ts and .tsx code', () => {
    expect(isSourcePath('backend/shared/src/errors.ts')).toBe(true);
    expect(isSourcePath('frontend/src/app/page.tsx')).toBe(true);
  });

  it('skips tests, type declarations and other files', () => {
    expect(isSourcePath('backend/shared/src/errors.test.ts')).toBe(false);
    expect(isSourcePath('frontend/src/app/page.spec.tsx')).toBe(false);
    expect(isSourcePath('frontend/next-env.d.ts')).toBe(false);
    expect(isSourcePath('frontend/src/app/globals.css')).toBe(false);
  });
});

describe('findSecret', () => {
  it('names the kind of secret it finds', () => {
    expect(findSecret(`const key = '${FAKE_PEM_HEADER}\\nMC4CAQ';`)).toBe('private key');
    expect(findSecret('{ "type": "service_account", "private_key": "x" }')).toBe(
      'service account key',
    );
    expect(findSecret(`const id = '${FAKE_AWS_KEY}';`)).toBe('AWS access key');
  });

  it('ignores ordinary code that only mentions secrets', () => {
    expect(findSecret("const REDACTED = ['password', 'apiKey', 'secret'];")).toBeUndefined();
  });
});

describe('collectSourceFiles', () => {
  it('reads only source files under the allowed roots, sorted by path', () => {
    const root = makeRepo({
      'backend/shared/src/z.ts': 'export const z = 1;',
      'backend/shared/src/nested/a.ts': 'export const a = 1;',
      'backend/shared/src/a.test.ts': 'test code',
      'backend/shared/src/types.d.ts': 'declare const x: 1;',
      'backend/shared/src/.env': 'TOKEN=1',
      'backend/shared/package.json': '{}',
      'backend/services/auth/src/app.ts': 'export {};',
      'backend/services/auth/.env': 'TOKEN=1',
      'scripts/tool.ts': 'outside every allowed root',
    });

    expect(collectSourceFiles(root).map((file) => file.path)).toEqual([
      'backend/services/auth/src/app.ts',
      'backend/shared/src/nested/a.ts',
      'backend/shared/src/z.ts',
    ]);
  });

  it('refuses to index a file with a secret, without repeating the secret', () => {
    const root = makeRepo({ 'backend/shared/src/aws.ts': `export const id = '${FAKE_AWS_KEY}';` });

    expect(() => collectSourceFiles(root)).toThrow(
      'backend/shared/src/aws.ts seems to contain a secret (AWS access key)',
    );
    expect(() => collectSourceFiles(root)).not.toThrow(FAKE_AWS_KEY);
  });
});
