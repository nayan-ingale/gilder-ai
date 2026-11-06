// The models the whole UI reads: the hand-written docs joined with the generated index, and the
// docs pages joined with the generated package list. Both generated files are written by
// scripts/index-source.ts before dev, typecheck and build.
import {
  components,
  flows,
  links,
  notes,
  packageNotes,
  pages,
  plannedTools,
} from '../data/index.ts';
import packageIndex from '../data/generated/packages.json';
import sourceIndex from '../data/generated/source-index.json';
import type { PackageIndex, SourceIndex } from '../data/source-index.ts';
import { createDocsModel } from './docs-model.ts';
import { createGuidesModel } from './guides.ts';

export const docs = createDocsModel(sourceIndex as SourceIndex, {
  components,
  links,
  flows,
  notes,
});

export const guides = createGuidesModel(
  { pages, packageNotes, plannedTools },
  packageIndex as PackageIndex,
);
