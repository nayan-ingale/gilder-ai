// Builds src/data/generated/ from the real code: one index of every file and symbol, plus each
// file's code in its own JSON file so the explorer loads it only when it's opened.
// Runs before `dev` and `build`; the output is git-ignored, so it always matches the code.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sourceFileName, type SourceFileContent } from '../src/data/source-index.ts';
import { collectSourceFiles } from './indexer/files.ts';
import { buildSourceIndex } from './indexer/symbols.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const outputDir = path.resolve(import.meta.dirname, '../src/data/generated');

try {
  const startedAt = performance.now();
  const files = collectSourceFiles(repoRoot);
  const index = buildSourceIndex(repoRoot, files);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(path.join(outputDir, 'sources'), { recursive: true });
  writeFileSync(path.join(outputDir, 'source-index.json'), `${JSON.stringify(index, null, 2)}\n`);
  for (const file of files) {
    const content: SourceFileContent = { path: file.path, code: file.content };
    writeFileSync(
      path.join(outputDir, 'sources', sourceFileName(file.path)),
      JSON.stringify(content),
    );
  }

  const symbolCount = index.files.reduce((total, file) => total + file.symbols.length, 0);
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`Indexed ${files.length} files and ${symbolCount} symbols in ${seconds}s\n`);
} catch (error) {
  console.error(
    `Source indexing failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
