// The one model the whole UI reads: the hand-written docs joined with the generated index.
// The index is written by scripts/index-source.ts before dev, typecheck and build.
import { components, flows, links, notes } from '../data/index.ts';
import sourceIndex from '../data/generated/source-index.json';
import type { SourceIndex } from '../data/source-index.ts';
import { createDocsModel } from './docs-model.ts';

export const docs = createDocsModel(sourceIndex as SourceIndex, {
  components,
  links,
  flows,
  notes,
});
