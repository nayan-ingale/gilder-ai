import type { DocPage, DocRef, DocSection, GuidesData, PackageNote } from '../data/schema.ts';
import type { IndexedPackage, PackageIndex } from '../data/source-index.ts';

/**
 * The docs pages joined with the generated package list, so views can ask "which docs sections
 * are about this function?" or "why does the project use this package?". Built once from its
 * inputs, like the docs model, so tests pass small made-up data.
 */

/** A docs section together with the page it is on. */
export interface DocSectionUsage {
  page: DocPage;
  section: DocSection;
}

/** One key per thing a ref points at: `component:gateway`, `symbol:<id>`, `file:<path>`... */
export function refKey(ref: DocRef): string {
  if ('component' in ref) return `component:${ref.component}`;
  if ('flow' in ref) return `flow:${ref.flow}`;
  if ('symbol' in ref) return `symbol:${ref.symbol}`;
  return `file:${ref.file}`;
}

export interface GuidesModel extends GuidesData {
  packages: IndexedPackage[];
  getPage(id: string): DocPage | undefined;
  /** The pages listed under Docs in the sidebar: every page not shown inside another section. */
  docsPages: DocPage[];
  /** The page shown at the top of a sidebar section, such as Error Handling. */
  pageForSection(section: NonNullable<DocPage['section']>): DocPage | undefined;
  getPackageNote(name: string): PackageNote | undefined;
  /** The docs sections that list this ref under "In the map". */
  sectionsAbout(ref: DocRef): DocSectionUsage[];
}

export function createGuidesModel(data: GuidesData, packageIndex: PackageIndex): GuidesModel {
  const pagesById = new Map(data.pages.map((page) => [page.id, page]));
  const notesByName = new Map(data.packageNotes.map((note) => [note.name, note]));
  const usagesByRef = new Map<string, DocSectionUsage[]>();
  for (const page of data.pages) {
    for (const section of page.sections) {
      // A section that lists the same ref twice is still one usage.
      for (const key of new Set((section.refs ?? []).map(refKey))) {
        usagesByRef.set(key, [...(usagesByRef.get(key) ?? []), { page, section }]);
      }
    }
  }

  return {
    ...data,
    packages: packageIndex.packages,
    getPage: (id) => pagesById.get(id),
    docsPages: data.pages.filter((page) => page.section === undefined),
    pageForSection: (section) => data.pages.find((page) => page.section === section),
    getPackageNote: (name) => notesByName.get(name),
    sectionsAbout: (ref) => usagesByRef.get(refKey(ref)) ?? [],
  };
}
