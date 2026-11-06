import type { ArchViewId } from './model/architecture-views.ts';

/**
 * Every page's address, in one place. The site uses hash URLs (/#/flows/health-check), so it
 * deploys as plain files with no server rules. What is selected lives in the query string, so
 * a link opens the same node, the Back button undoes a click, and breadcrumbs come from the URL.
 */

/**
 * Query keys for what is selected. Any of them but `section` opens the detail panel; `section`
 * scrolls a docs section into view (hash URLs leave no room for `#section` anchors).
 */
export const SELECT = {
  /** An architecture component, e.g. ?node=gateway */
  node: 'node',
  /** A step of the open flow, e.g. ?step=checks */
  step: 'step',
  /** A function or other symbol, e.g. ?symbol=backend/shared/src/health.ts%23healthRouter */
  symbol: 'symbol',
  /** A source file in the code explorer, e.g. ?file=backend/shared/src/health.ts */
  file: 'file',
  /** The steps visited in a walkthrough, in order; the last one is the current step. */
  walk: 'walk',
  /** A section of a docs page, e.g. ?section=levels. Scrolled into view and marked briefly. */
  section: 'section',
} as const;

export type SelectKey = keyof typeof SELECT;

function withQuery(path: string, query: Partial<Record<SelectKey, string>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const paths = {
  overview: () => '/',
  architecture: (view: ArchViewId, node?: string) => withQuery(`/architecture/${view}`, { node }),
  flows: () => '/flows',
  flow: (flowId: string, step?: string) =>
    withQuery(`/flows/${encodeURIComponent(flowId)}`, { step }),
  /** A flow in walkthrough mode, at the last of the visited steps. */
  walkthrough: (flowId: string, visited: string[]) =>
    withQuery(`/flows/${encodeURIComponent(flowId)}`, {
      step: visited.at(-1),
      walk: visited.length > 0 ? visited.join(',') : undefined,
    }),
  code: (selection: { file?: string; symbol?: string } = {}) => withQuery('/code', selection),
  /** Error Handling. It opens with the error-handling docs page; `section` is one of its sections. */
  errors: (section?: string) => withQuery('/errors', { section }),
  /** A docs page, scrolled to one of its sections when `section` is given. */
  doc: (pageId: string, section?: string) =>
    withQuery(`/docs/${encodeURIComponent(pageId)}`, { section }),
  agents: () => '/agents',
  jobs: () => '/jobs',
};

export type SectionId =
  | 'overview'
  | 'system'
  | 'frontend'
  | 'backend'
  | 'api'
  | 'code'
  | 'agents'
  | 'integrations'
  | 'data'
  | 'jobs'
  | 'errors'
  /** The docs pages, listed in a group of their own under the sections. */
  | 'docs';

export interface NavItem {
  id: SectionId;
  label: string;
  to: string;
}

/** The sidebar, in order. The docs pages follow, in a group of their own (Sidebar.tsx). */
export const NAV: NavItem[] = [
  { id: 'overview', label: 'Project Overview', to: paths.overview() },
  { id: 'system', label: 'System Architecture', to: paths.architecture('system') },
  { id: 'frontend', label: 'Frontend Architecture', to: paths.architecture('frontend') },
  { id: 'backend', label: 'Backend Architecture', to: paths.architecture('backend') },
  { id: 'api', label: 'API Explorer', to: paths.flows() },
  { id: 'code', label: 'Code Explorer', to: paths.code() },
  { id: 'agents', label: 'Agent Explorer', to: paths.agents() },
  { id: 'integrations', label: 'Services & Integrations', to: paths.architecture('integrations') },
  { id: 'data', label: 'Database & Data Flow', to: paths.architecture('data') },
  { id: 'jobs', label: 'Background Jobs', to: paths.jobs() },
  { id: 'errors', label: 'Error Handling', to: paths.errors() },
];
