// Checks the hand-written docs in src/data/ against the real code (the generated index).
// Runs before every build, so CI fails when a doc points at code that changed or no longer exists.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { components, flows, links, notes } from '../src/data/index.ts';
import type { SourceIndex } from '../src/data/source-index.ts';
import { checkDocs } from './verifier/check-docs.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const indexPath = path.resolve(import.meta.dirname, '../src/data/generated/source-index.json');

if (!existsSync(indexPath)) {
  console.error('No source index yet. Run `pnpm index:source` first.');
  process.exit(1);
}

const index = JSON.parse(readFileSync(indexPath, 'utf8')) as SourceIndex;
const { problems, warnings } = checkDocs(
  index,
  { components, links, flows, notes },
  {
    readFile: (filePath) => {
      const absolutePath = path.join(repoRoot, filePath);
      return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined;
    },
    exists: (filePath) => existsSync(path.join(repoRoot, filePath)),
  },
);

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
      `${flows.length} flows, ${notes.length} notes\n`,
  );
}
