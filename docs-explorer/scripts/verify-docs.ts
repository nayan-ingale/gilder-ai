// Checks the hand-written docs in src/data/ against the real code (the generated index).
// Runs before every build, so CI fails when a doc points at code that changed or no longer exists.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  components,
  flows,
  links,
  notes,
  packageNotes,
  pages,
  plannedTools,
} from '../src/data/index.ts';
import type { PackageIndex, SourceIndex } from '../src/data/source-index.ts';
import { checkDocs, type RepoAccess } from './verifier/check-docs.ts';
import { checkGuides } from './verifier/check-guides.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');

/** Reads a file the indexer writes, and stops with a hint when the indexer hasn't run yet. */
function readGenerated<T>(fileName: string, what: string): T {
  const filePath = path.resolve(import.meta.dirname, '../src/data/generated', fileName);
  if (!existsSync(filePath)) {
    console.error(`No ${what} yet. Run \`pnpm index:source\` first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

const index = readGenerated<SourceIndex>('source-index.json', 'source index');
const packages = readGenerated<PackageIndex>('packages.json', 'package index');
const docs = { components, links, flows, notes };
const repo: RepoAccess = {
  readFile: (filePath) => {
    const absolutePath = path.join(repoRoot, filePath);
    return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined;
  },
  exists: (filePath) => existsSync(path.join(repoRoot, filePath)),
};

const results = [
  checkDocs(index, docs, repo),
  checkGuides({ pages, packageNotes, plannedTools }, { index, docs, packages, repo }),
];
const problems = results.flatMap((result) => result.problems);
const warnings = results.flatMap((result) => result.warnings);

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}
if (problems.length > 0) {
  console.error(
    `The docs don't match the code (${problems.length}):\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Docs match the code: ${components.length} components, ${links.length} links, ` +
      `${flows.length} flows, ${notes.length} notes, ${pages.length} docs pages, ` +
      `${packageNotes.length} package notes\n`,
  );
}
