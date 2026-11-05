import { Link } from 'react-router';
import { STATUS_INFO, type Status } from '../data/schema.ts';
import { architectureView, getArchView, type ArchViewId } from '../model/architecture-views.ts';
import { docs } from '../model/index.ts';
import { NAV, type NavItem, type SectionId } from '../routes.ts';
import { plural } from '../ui/plural.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';

// The landing page: what GilderAi is (as the README says it), what this explorer covers, how
// much it documents, and what each status means. Only round-ups of the docs, no new claims:
// most of the product is still planned, so nothing here describes planned parts as built.

const COUNTS: { label: string; value: number }[] = [
  { label: 'Components', value: docs.components.length },
  { label: 'Connections', value: docs.links.length },
  { label: 'Flows', value: docs.flows.length },
  { label: 'Function notes', value: docs.notes.length },
  { label: 'Source files indexed', value: docs.files.length },
  {
    label: 'Symbols indexed',
    value: docs.files.reduce((total, file) => total + file.symbols.length, 0),
  },
];

const STATUSES = Object.keys(STATUS_INFO) as Status[];

// Worded for any mix of built and planned parts; the status count under each says which.
const VIEW_SUMMARY: Record<ArchViewId, string> = {
  system: 'Every app, data store and outside service, built or planned, and how they connect.',
  frontend: 'The browser and the Next.js app, and what they connect to, today or as planned.',
  backend: 'The gateway, the services, the shared library and the data stores they connect to.',
  integrations: 'The outside services, and which app calls or will call each one.',
  data: 'The data stores, and the apps that connect or will connect to them.',
};

const SECTION_SUMMARY: Partial<Record<SectionId, string>> = {
  api: 'Requests and app lifecycle events, followed step by step through the code.',
  agents: 'No agents in the code yet.',
  jobs: 'No background jobs in the code yet.',
  errors: 'How the backend apps turn errors into responses, step by step.',
};

/** E.g. "17 parts: 10 verified, 1 not wired yet, 6 planned", for the view's own components. */
function viewStatusCount(viewId: ArchViewId): string {
  const view = architectureView(viewId, docs.components, docs.links);
  const own = view.components.filter((component) => !view.contextIds.has(component.id));
  const byStatus = STATUSES.map((status) => ({
    status,
    count: own.filter((component) => component.status === status).length,
  })).filter((entry) => entry.count > 0);
  const parts = byStatus.map(
    (entry) => `${entry.count} ${STATUS_INFO[entry.status].label.toLowerCase()}`,
  );
  return `${plural(own.length, 'part')}: ${parts.join(', ')}`;
}

const SECTIONS = NAV.filter((item) => item.id !== 'overview').map((item: NavItem) => {
  const view = getArchView(item.id);
  return {
    item,
    summary: view ? VIEW_SUMMARY[view.id] : SECTION_SUMMARY[item.id],
    statusCount: view ? viewStatusCount(view.id) : undefined,
  };
});

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
      {children}
    </h2>
  );
}

export function OverviewPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <title>Project Overview · GilderAi Docs</title>
      <h1 className="text-lg font-semibold text-fg">Project Overview</h1>

      <div className="mt-3 max-w-3xl space-y-3 text-sm/relaxed">
        <p>
          <span className="text-fg">GilderAi</span> is being built as a multi-agent AI workspace:
          one chat interface that will send each request to the right specialist agent. It is in
          development: the backend foundation is in place, and chat and the agents are not built
          yet.
        </p>
        <p>
          This explorer is a map of its code: how the system fits together, how requests move
          through the code step by step, and the real source of each function. Facts such as
          signatures, line numbers and callers come from an index generated from the source. The
          written notes point into that index, and the build fails if one points at code that no
          longer exists. Planned parts are shown too, marked Planned, so the map also shows what is
          still to come.
        </p>
      </div>

      <section aria-labelledby="overview-counts" className="mt-8">
        <SectionHeading id="overview-counts">What is documented</SectionHeading>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
          {COUNTS.map((count) => (
            <div key={count.label} className="flex flex-col-reverse gap-0.5 bg-canvas px-4 py-3">
              <dt className="text-xs text-fg-subtle">{count.label}</dt>
              <dd className="text-lg font-semibold text-fg tabular-nums">{count.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="overview-statuses" className="mt-8">
        <SectionHeading id="overview-statuses">Status labels</SectionHeading>
        <p className="mt-2 text-sm text-fg-subtle">
          Every component, connection, flow and step carries one. It says how sure the docs are that
          they match the code.
        </p>
        <dl className="mt-3 divide-y divide-line rounded-md border border-line">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="grid gap-1.5 px-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4"
            >
              <dt>
                <StatusBadge status={status} />
              </dt>
              <dd className="text-sm text-fg-muted">{STATUS_INFO[status].description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="overview-sections" className="mt-8">
        <SectionHeading id="overview-sections">Sections</SectionHeading>
        <ul className="mt-3 divide-y divide-line rounded-md border border-line">
          {SECTIONS.map(({ item, summary, statusCount }) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className="flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-surface sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="shrink-0 text-sm font-medium text-fg sm:w-52">{item.label}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-fg-subtle">{summary}</span>
                  {statusCount ? (
                    <span className="text-xs text-fg-subtle">{statusCount}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
