// Loads one file's code from src/data/generated/sources/. Each file is its own lazy chunk, so
// the explorer downloads a file's code only when someone opens it.
import { sourceFileName, type SourceFileContent } from '../data/source-index.ts';

// Lazy: each entry is a function that imports one JSON file when called.
const sources = import.meta.glob('../data/generated/sources/*.json', { import: 'default' });

/** The file's code was not indexed, so it isn't part of this build. */
export class SourceNotInBuildError extends Error {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`The code for ${filePath} isn't in the build`);
    this.name = 'SourceNotInBuildError';
    this.filePath = filePath;
  }
}

/**
 * The code of one indexed file. Rejects with SourceNotInBuildError when the file was not
 * indexed, and with a plain Error when its chunk fails to download or holds something else.
 */
export async function loadSource(filePath: string): Promise<SourceFileContent> {
  const load = sources[`../data/generated/sources/${sourceFileName(filePath)}`];
  if (!load) {
    throw new SourceNotInBuildError(filePath);
  }
  const value = await load();
  if (!isSourceFileContent(value) || value.path !== filePath) {
    throw new Error(`The code for ${filePath} has an unexpected shape`);
  }
  return value;
}

function isSourceFileContent(value: unknown): value is SourceFileContent {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.path === 'string' && typeof record.code === 'string';
}
