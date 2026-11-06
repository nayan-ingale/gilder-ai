import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Folders whose code the explorer may show, relative to the repo root. `*` matches one folder
 * name. Anything outside these folders is never read, so it can never reach the explorer.
 */
export const SOURCE_ROOTS = [
  'backend/shared/src',
  'backend/gateway/src',
  'backend/services/*/src',
  'frontend/src',
];

export interface RepoFile {
  /** Path from the repo root, always with forward slashes. */
  path: string;
  content: string;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const BLOCKED_FOLDERS = new Set(['node_modules', 'dist', 'build', '.next', 'coverage']);
const BLOCKED_FILE_NAME =
  /^\.env|\.(pem|key|p12|pfx|crt)$|secret|credential|service-?account|adminsdk/i;

const SECRET_PATTERNS = [
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'service account key', pattern: /"private_key"\s*:/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Razorpay live key', pattern: /\brzp_live_[0-9A-Za-z]{10,}/ },
];

/** True for paths that must never be shown: env files, keys, private docs, build output. */
export function isBlockedPath(relativePath: string): boolean {
  const segments = relativePath.split('/');
  if (segments[0] === 'docs') {
    return true;
  }
  if (segments.some((segment) => BLOCKED_FOLDERS.has(segment))) {
    return true;
  }
  return BLOCKED_FILE_NAME.test(segments.at(-1) ?? '');
}

/** Source code worth documenting: .ts and .tsx files, without tests and type-only .d.ts files. */
export function isSourcePath(relativePath: string): boolean {
  return (
    SOURCE_EXTENSIONS.some((extension) => relativePath.endsWith(extension)) &&
    !/\.(test|spec)\.tsx?$/.test(relativePath) &&
    !relativePath.endsWith('.d.ts')
  );
}

/** Names the kind of secret a file seems to contain (never the secret itself), if any. */
export function findSecret(content: string): string | undefined {
  return SECRET_PATTERNS.find(({ pattern }) => pattern.test(content))?.name;
}

/**
 * Reads every source file under the allowed roots, sorted by path. Throws if a file looks like
 * it contains a secret: that's a bug to fix in the code, not something to skip quietly.
 */
export function collectSourceFiles(repoRoot: string, roots = SOURCE_ROOTS): RepoFile[] {
  const files: RepoFile[] = [];
  for (const root of roots.flatMap((pattern) => expandFolders(repoRoot, pattern))) {
    const entries = readdirSync(path.join(repoRoot, root), { recursive: true, encoding: 'utf8' });
    for (const entry of entries) {
      const relativePath = `${root}/${entry.split(path.sep).join('/')}`;
      if (isBlockedPath(relativePath) || !isSourcePath(relativePath)) {
        continue;
      }
      const absolutePath = path.join(repoRoot, relativePath);
      if (!statSync(absolutePath).isFile()) {
        continue;
      }
      const content = readFileSync(absolutePath, 'utf8');
      const secret = findSecret(content);
      if (secret) {
        throw new Error(
          `${relativePath} seems to contain a secret (${secret}). Move it to an env variable, then index again.`,
        );
      }
      files.push({ path: relativePath, content });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The folders a pattern names that exist. A `*` segment matches any one folder name, so
 * `backend/services/*` gives one folder per service. Matches come in name order, so the output
 * is the same on every machine.
 */
export function expandFolders(repoRoot: string, pattern: string): string[] {
  let folders = [''];
  for (const segment of pattern.split('/')) {
    folders = folders.flatMap((folder) =>
      segment === '*' ? subfolders(repoRoot, folder) : [joinSegment(folder, segment)],
    );
  }
  return folders.filter((folder) => existsSync(path.join(repoRoot, folder)));
}

function subfolders(repoRoot: string, folder: string): string[] {
  const absolutePath = path.join(repoRoot, folder);
  if (!existsSync(absolutePath)) {
    return [];
  }
  return readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => joinSegment(folder, name));
}

function joinSegment(folder: string, segment: string): string {
  return folder === '' ? segment : `${folder}/${segment}`;
}
