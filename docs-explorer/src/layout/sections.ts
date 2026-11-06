// Which sidebar section a page belongs to. Kept apart from the sidebar so the rule can be
// tested: a flow page sits under "Error Handling" when the flow is about errors, and under
// "API Explorer" otherwise, so its address alone doesn't say which. A docs page sits in the
// Docs group, under its own entry (docsPageOf).
import { getArchView } from '../model/architecture-views.ts';
import type { DocsModel } from '../model/docs-model.ts';
import { docs } from '../model/index.ts';
import type { SectionId } from '../routes.ts';

/** The URL path split into its parts, decoded. A part that can't be decoded is kept as is. */
export function pathParts(pathname: string): string[] {
  return pathname
    .split('/')
    .filter((part) => part !== '')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

/** The section for a path such as `/flows/error-handling`; undefined for an unknown page. */
export function sectionOf(
  pathname: string,
  model: Pick<DocsModel, 'getFlow'> = docs,
): SectionId | undefined {
  const [first, second, ...rest] = pathParts(pathname);
  if (rest.length > 0) return undefined;

  switch (first) {
    case undefined:
      return 'overview';
    case 'architecture':
      return second === undefined ? undefined : getArchView(second)?.id;
    case 'flows':
      if (second === undefined) return 'api';
      return model.getFlow(second)?.category === 'errors' ? 'errors' : 'api';
    case 'docs':
      // Like a flow, an unknown page still belongs to its section; the page says it's not found.
      return second === undefined ? undefined : 'docs';
    case 'code':
    case 'errors':
    case 'agents':
    case 'jobs':
      return second === undefined ? first : undefined;
    default:
      return undefined;
  }
}

/** The page id in a docs page's path (`/docs/logging` → `logging`); undefined anywhere else. */
export function docsPageOf(pathname: string): string | undefined {
  const [first, second, ...rest] = pathParts(pathname);
  return first === 'docs' && rest.length === 0 ? second : undefined;
}
