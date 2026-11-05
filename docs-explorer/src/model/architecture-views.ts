import type { ArchComponent, ArchLink } from '../data/schema.ts';

/**
 * The architecture pages are views of one system map. Each one picks the components it is
 * about, and some also show their direct neighbours so the edges of the picture make sense.
 */

export type ArchViewId = 'system' | 'frontend' | 'backend' | 'integrations' | 'data';

export interface ArchView {
  id: ArchViewId;
  title: string;
  summary: string;
}

interface ViewRule {
  focus: (component: ArchComponent) => boolean;
  /** Also show the components one link away, marked as context. */
  withNeighbours: boolean;
}

export const ARCH_VIEWS: ArchView[] = [
  {
    id: 'system',
    title: 'System Architecture',
    summary: 'Every app, data store and outside service, and how they connect.',
  },
  {
    id: 'frontend',
    title: 'Frontend Architecture',
    summary: 'What runs in and for the browser, and what it talks to.',
  },
  {
    id: 'backend',
    title: 'Backend Architecture',
    summary: 'The gateway, the services, the shared library and the data stores they use.',
  },
  {
    id: 'integrations',
    title: 'Services & Integrations',
    summary:
      'Outside services and the apps that connect to them. Each line says whether the call is built or planned.',
  },
  {
    id: 'data',
    title: 'Database & Data Flow',
    summary:
      'The data stores, the apps that connect to them, and what the code does with each today.',
  },
];

const isBackendCode = (component: ArchComponent): boolean =>
  component.path?.startsWith('backend/') ?? false;

const RULES: Record<ArchViewId, ViewRule> = {
  system: { focus: () => true, withNeighbours: false },
  frontend: {
    focus: (component) => component.kind === 'client' || component.id === 'frontend',
    withNeighbours: true,
  },
  backend: {
    focus: (component) => isBackendCode(component) || component.kind === 'datastore',
    withNeighbours: false,
  },
  integrations: { focus: (component) => component.kind === 'external', withNeighbours: true },
  data: { focus: (component) => component.kind === 'datastore', withNeighbours: true },
};

export interface ArchViewData {
  components: ArchComponent[];
  links: ArchLink[];
  /** Components shown only because they connect to the view's own ones. */
  contextIds: Set<string>;
}

export function getArchView(id: string): ArchView | undefined {
  return ARCH_VIEWS.find((view) => view.id === id);
}

export function architectureView(
  viewId: ArchViewId,
  components: ArchComponent[],
  links: ArchLink[],
): ArchViewData {
  const rule = RULES[viewId];
  const focusIds = new Set(components.filter(rule.focus).map((component) => component.id));
  const contextIds = new Set<string>();
  if (rule.withNeighbours) {
    for (const link of links) {
      if (focusIds.has(link.from) && !focusIds.has(link.to)) contextIds.add(link.to);
      if (focusIds.has(link.to) && !focusIds.has(link.from)) contextIds.add(link.from);
    }
  }
  const shown = (id: string): boolean => focusIds.has(id) || contextIds.has(id);
  return {
    components: components.filter((component) => shown(component.id)),
    links: links.filter((link) => shown(link.from) && shown(link.to)),
    contextIds,
  };
}
