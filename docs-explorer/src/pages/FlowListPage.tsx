import { Link } from 'react-router';
import type { Flow, FlowCategory } from '../data/schema.ts';
import { FLOW_CATEGORY_LABEL } from '../model/labels.ts';
import { docs } from '../model/index.ts';
import { paths } from '../routes.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { plural } from '../ui/plural.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { startTrail } from '../walkthrough/walk.ts';

// The list of flows: every one, grouped by category (API Explorer), or only the error flows
// (Error Handling). A dense list; each row opens the flow's graph, and a link of its own, at the
// end of the row (under it on phones), starts a walkthrough of it.

const CATEGORY_ORDER: FlowCategory[] = ['api', 'errors', 'lifecycle'];

function FlowRow({ flow }: { flow: Flow }) {
  const route = flow.route;
  const routeText = route ? `${route.method} ${route.path}` : undefined;

  return (
    // The walkthrough link sits beside the row's link (links can't nest), never on top of it: a
    // full-height column on wider screens, a strip under the row on phones.
    <li className="flex flex-col sm:flex-row sm:items-stretch">
      <Link
        to={paths.flow(flow.id)}
        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-3 transition-colors hover:bg-surface"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {route ? (
              <span className="font-mono text-sm text-fg">
                <span className="text-accent">{route.method}</span> {route.path}
              </span>
            ) : (
              <span className="text-sm font-medium text-fg">{flow.title}</span>
            )}
            {routeText && flow.title !== routeText ? (
              <span className="text-sm text-fg-muted">{flow.title}</span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-fg-subtle">{flow.summary}</p>
          <p className="mt-1.5 text-xs text-fg-subtle">
            {plural(flow.steps.length, 'step')}
            {flow.apps.length > 0 ? (
              <>
                {' · Runs in '}
                <span className="font-mono text-fg-muted">{flow.apps.join(', ')}</span>
              </>
            ) : null}
          </p>
        </div>
        <StatusBadge status={flow.status} />
      </Link>
      {flow.steps.length > 0 ? (
        <Link
          to={paths.walkthrough(flow.id, startTrail(flow))}
          aria-label={`Walk through ${flow.title}`}
          className="flex min-h-8 shrink-0 items-center gap-1.5 border-t border-line px-4 py-1.5 text-xs whitespace-nowrap text-accent transition-colors hover:bg-surface hover:underline sm:border-t-0 sm:border-l"
        >
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0">
            <path d="M3.5 2.5v7l6-3.5z" fill="currentColor" />
          </svg>
          Walk through
        </Link>
      ) : null}
    </li>
  );
}

function FlowList({ flows }: { flows: Flow[] }) {
  return (
    <ul className="divide-y divide-line rounded-md border border-line">
      {flows.map((flow) => (
        <FlowRow key={flow.id} flow={flow} />
      ))}
    </ul>
  );
}

/** Every flow, or only one category's when `category` is given. */
export function FlowListPage({ category }: { category?: FlowCategory }) {
  const title =
    category === undefined
      ? 'API Explorer'
      : category === 'errors'
        ? 'Error Handling'
        : FLOW_CATEGORY_LABEL[category];
  const intro =
    category === 'errors'
      ? 'How the backend apps turn errors into responses, followed step by step through the code.'
      : 'Requests and app lifecycle events, followed step by step through the code. Open one to see its graph.';
  const groups = (category ? [category] : CATEGORY_ORDER)
    .map((group) => ({
      category: group,
      flows: docs.flows.filter((flow) => flow.category === group),
    }))
    .filter((group) => group.flows.length > 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <title>{`${title} · GilderAi Docs`}</title>
      <h1 className="text-lg font-semibold text-fg">{title}</h1>
      <p className="mt-1 text-sm text-fg-subtle">{intro}</p>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line">
          <EmptyState title="No flows yet">
            <p>None of the flows in the docs belong here yet.</p>
          </EmptyState>
        </div>
      ) : category ? (
        <div className="mt-6">
          <FlowList flows={groups[0]?.flows ?? []} />
        </div>
      ) : (
        groups.map((group) => (
          <section
            key={group.category}
            aria-labelledby={`flows-${group.category}`}
            className="mt-8 first-of-type:mt-6"
          >
            <h2
              id={`flows-${group.category}`}
              className="mb-3 flex items-baseline gap-2 text-xs font-medium tracking-wide text-fg-subtle uppercase"
            >
              {FLOW_CATEGORY_LABEL[group.category]}
              <span className="font-normal tabular-nums normal-case">{group.flows.length}</span>
            </h2>
            <FlowList flows={group.flows} />
          </section>
        ))
      )}
    </div>
  );
}
