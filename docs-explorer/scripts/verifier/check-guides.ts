import {
  ERROR_FLOWS_SECTION_ID,
  type DocBlock,
  type DocPage,
  type DocRef,
  type DocsData,
  type GuidesData,
  type PackageNote,
  type PlannedTool,
} from '../../src/data/schema.ts';
import type { PackageIndex, SourceIndex } from '../../src/data/source-index.ts';
import { isTypeDefinitions } from '../../src/guides/packages.ts';
import { findSecret, isBlockedPath } from '../indexer/files.ts';
import type { CheckResult, RepoAccess } from './check-docs.ts';

/** What the docs pages point at: the code index, the rest of the docs, the packages and the repo. */
export interface GuidesContext {
  index: SourceIndex;
  docs: DocsData;
  packages: PackageIndex;
  repo: RepoAccess;
}

/** The ids a page section may link to, gathered once for every page. */
interface Targets {
  componentIds: Set<string>;
  flowIds: Set<string>;
  symbolIds: Set<string>;
}

/**
 * Compares the docs pages with the repo. Every part, flow, function and file a section names must
 * exist, every quote must still be in its file and hold no secret, and the package notes must
 * match the packages the package.json files list.
 */
export function checkGuides(guides: GuidesData, context: GuidesContext): CheckResult {
  const { index, docs, packages, repo } = context;
  const targets: Targets = {
    componentIds: new Set(docs.components.map((component) => component.id)),
    flowIds: new Set(docs.flows.map((flow) => flow.id)),
    symbolIds: new Set(index.files.flatMap((file) => file.symbols.map((symbol) => symbol.id))),
  };
  const listed = new Set(packages.packages.map((entry) => entry.name));
  const problems: string[] = [];

  checkPages(guides.pages, targets, repo, problems);
  checkPackageNotes(guides.packageNotes, listed, problems);
  checkPlannedTools(guides.plannedTools, listed, problems);

  return { problems, warnings: missingPackageNotes(listed, guides.packageNotes) };
}

function checkPages(
  pages: DocPage[],
  targets: Targets,
  repo: RepoAccess,
  problems: string[],
): void {
  const pageIds = new Set<string>();
  // Which page opens each sidebar section. Two pages can't both open the same one.
  const sectionOwners = new Map<string, string>();

  for (const page of pages) {
    const where = `page ${page.id}`;
    if (pageIds.has(page.id)) {
      problems.push(`${where}: the id is used twice`);
    }
    pageIds.add(page.id);
    if (page.section) {
      const owner = sectionOwners.get(page.section);
      if (owner) {
        problems.push(`${where}: page ${owner} already opens the ${page.section} section`);
      } else {
        sectionOwners.set(page.section, page.id);
      }
    }

    const sectionIds = new Set<string>();
    for (const section of page.sections) {
      const sectionWhere = `${where}, section ${section.id}`;
      if (sectionIds.has(section.id)) {
        problems.push(`${sectionWhere}: the id is used twice`);
      }
      sectionIds.add(section.id);
      // The Error Handling section lists its flows under this id, right after this page's sections.
      if (page.section === 'errors' && section.id === ERROR_FLOWS_SECTION_ID) {
        problems.push(
          `${sectionWhere}: the Error Handling section already uses this id for its list of flows`,
        );
      }
      if (section.status === 'planned' && !section.plannedIn) {
        problems.push(
          `${sectionWhere}: planned, but plannedIn doesn't name the feature that adds it`,
        );
      }
      for (const block of section.blocks) {
        checkBlock(sectionWhere, block, repo, problems);
      }
      for (const ref of section.refs ?? []) {
        checkDocRef(sectionWhere, ref, targets, repo, problems);
      }
    }
  }
}

function checkBlock(where: string, block: DocBlock, repo: RepoAccess, problems: string[]): void {
  if (block.kind === 'quote') {
    // A blocked file is never read, so its text can't reach the explorer through a quote.
    const unusable = fileProblem(block.file, repo);
    if (unusable) {
      problems.push(`${where}: quotes ${block.file}, which ${unusable}`);
    }
    // A quote can come from any file, not just the indexed code the indexer scans, and its text
    // ships in the site. Name only the kind of secret, so the build log doesn't leak it either.
    const secret = findSecret(block.text);
    if (secret) {
      problems.push(`${where}: a quote from ${block.file} seems to contain a secret (${secret})`);
    } else if (block.text.trim() === '') {
      problems.push(`${where}: a quote from ${block.file} has no text`);
    } else if (!unusable && !(repo.readFile(block.file) ?? '').includes(block.text)) {
      problems.push(`${where}: "${block.text}" is no longer in ${block.file}`);
    }
  } else if (block.kind === 'table') {
    for (const [rowIndex, row] of block.rows.entries()) {
      if (row.length !== block.columns.length) {
        problems.push(
          `${where}: table row ${rowIndex + 1} has ${row.length} cells, but there are ${block.columns.length} columns`,
        );
      }
    }
  }
}

function checkDocRef(
  where: string,
  ref: DocRef,
  { componentIds, flowIds, symbolIds }: Targets,
  repo: RepoAccess,
  problems: string[],
): void {
  if ('component' in ref) {
    if (!componentIds.has(ref.component)) {
      problems.push(`${where}: no component ${ref.component}`);
    }
  } else if ('flow' in ref) {
    if (!flowIds.has(ref.flow)) {
      problems.push(`${where}: no flow ${ref.flow}`);
    }
  } else if ('symbol' in ref) {
    if (!symbolIds.has(ref.symbol)) {
      problems.push(`${where}: no symbol ${ref.symbol} in the code`);
    }
  } else {
    const unusable = fileProblem(ref.file, repo);
    if (unusable) {
      problems.push(`${where}: file ${ref.file} ${unusable}`);
    }
  }
}

/** Why a section can't link to or quote a file, if it can't. Private files are never shown. */
function fileProblem(filePath: string, repo: RepoAccess): string | undefined {
  // Checked before the repo is touched, so a doc can't make the checker read outside the repo.
  if (!isPlainRepoPath(filePath)) {
    return 'must be a plain path from the repo root';
  }
  if (isBlockedPath(filePath)) {
    return 'must never be shown';
  }
  return repo.exists(filePath) ? undefined : "doesn't exist";
}

/**
 * True for a path written the way the indexer writes them: relative, with forward slashes and no
 * empty, `.` or `..` segments. Anything else could point outside the repo (`/etc/hosts`,
 * `../x`, a Windows path) or slip past isBlockedPath (`./docs/x` doesn't start with `docs`).
 */
function isPlainRepoPath(filePath: string): boolean {
  return (
    !filePath.includes('\\') &&
    !/^[A-Za-z]:/.test(filePath) &&
    filePath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function checkPackageNotes(notes: PackageNote[], listed: Set<string>, problems: string[]): void {
  const seen = new Set<string>();
  for (const note of notes) {
    const where = `package note ${note.name}`;
    if (seen.has(note.name)) {
      problems.push(`${where}: written twice`);
    }
    seen.add(note.name);
    if (!listed.has(note.name)) {
      problems.push(`${where}: no package.json lists it`);
    }
  }
}

function checkPlannedTools(tools: PlannedTool[], listed: Set<string>, problems: string[]): void {
  for (const tool of tools) {
    const where = `planned tool ${tool.name}`;
    if (tool.plannedIn.trim() === '') {
      problems.push(`${where}: plannedIn doesn't name the feature that adds it`);
    }
    if (tool.package && listed.has(tool.package)) {
      problems.push(`${where}: ${tool.package} is installed now: move it to packageNotes`);
    }
  }
}

/** Packages the apps list that the tech stack page doesn't explain yet. Type packages need no note. */
function missingPackageNotes(listed: Set<string>, notes: PackageNote[]): string[] {
  const noted = new Set(notes.map((note) => note.name));
  return [...listed]
    .filter((name) => !isTypeDefinitions(name) && !noted.has(name))
    .map((name) => `package ${name} has no note yet`);
}
