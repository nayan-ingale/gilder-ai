import type { ArchViewId } from './model/architecture-views.ts';

/**
 * Every page's address, in one place. The site uses hash URLs (/#/flows/health-check), so it
 * deploys as plain files with no server rules. What is selected lives in the query string, so
 * a link opens the same node, the Back button undoes a click, and breadcrumbs come from the URL.
 */

/** Query keys for what is selected. Any of them opens the detail panel. */
export const SELECT = {
  /** An architecture component, e.g. ?node=gateway */
  node: 'node',
  /** A step of the open flow, e.g. ?step=checks */
  step: 'step',
  /** A function or other symbol, e.g. ?symbol=backend/shared/src/health.ts%23healthRouter */
  symbol: 'symbol',
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
  errors: () => '/errors',
  agents: () => '/agents',
  jobs: () => '/jobs',
};

export type SectionId =
  | 'overview'
  | 'system'
  | 'frontend'
  | 'backend'
  | 'api'
  | 'agents'
  | 'integrations'
  | 'data'
  | 'jobs'
  | 'errors';

export interface NavItem {
  id: SectionId;
  label: string;
  to: string;
}

/** The sidebar, in order. */
export const NAV: NavItem[] = [
  { id: 'overview', label: 'Project Overview', to: paths.overview() },
  { id: 'system', label: 'System Architecture', to: paths.architecture('system') },
  { id: 'frontend', label: 'Frontend Architecture', to: paths.architecture('frontend') },
  { id: 'backend', label: 'Backend Architecture', to: paths.architecture('backend') },
  { id: 'api', label: 'API Explorer', to: paths.flows() },
  { id: 'agents', label: 'Agent Explorer', to: paths.agents() },
  { id: 'integrations', label: 'Services & Integrations', to: paths.architecture('integrations') },
  { id: 'data', label: 'Database & Data Flow', to: paths.architecture('data') },
  { id: 'jobs', label: 'Background Jobs', to: paths.jobs() },
  { id: 'errors', label: 'Error Handling', to: paths.errors() },
];
