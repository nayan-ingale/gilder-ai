// The tech stack's packages: every npm package the apps list, grouped by where it sits in the
// stack, with why the project uses it and which apps list it at which version. Then the tools
// the roadmap adds that no package.json lists yet. Rows are a grid with column headings on wide
// screens and stack on phones, so nothing scrolls sideways.
import { Fragment, useId, type ReactNode } from 'react';
import type { PlannedTool } from '../data/schema.ts';
import { keyedStrings } from '../details/format.ts';
import { RichText } from '../details/RichText.tsx';
import { guides } from '../model/index.ts';
import { STACK_LAYER_LABEL } from '../model/labels.ts';
import { plural } from '../ui/plural.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import {
  appLabel,
  buildPackageTable,
  nameParts,
  type PackageRow,
  type UsageGroup,
} from './packages.ts';

// The package list never changes while the page is open, so the table is worked out once.
const TABLE = buildPackageTable(guides.packages, guides.getPackageNote);

// One row: stacked on phones, three columns from `sm` up.
const COLUMNS = 'sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,15rem)] sm:gap-4';
const ROW = `grid gap-1 px-4 py-2.5 ${COLUMNS}`;
const GROUP_HEADING =
  'flex items-baseline gap-2 text-xs font-medium tracking-wide text-fg-subtle uppercase';

const PACKAGE_COLUMNS = ['Package', 'What it does here', 'Used by'] as const;
const PLANNED_COLUMNS = ['Tool', 'What it will do', 'Added in'] as const;

/**
 * A package name that wraps after a `/`, so `@tailwindcss/` and `turbopack` each stay whole in
 * a narrow column. The `wrap-anywhere` around it cuts a part only when it can't fit on a line.
 */
function PackageName({ name }: { name: string }) {
  return keyedStrings(nameParts(name)).map(({ key, value }) => (
    <Fragment key={key}>
      {value}
      {value.endsWith('/') ? <wbr /> : null}
    </Fragment>
  ));
}

function ColumnHeadings({ names }: { names: readonly [string, string, string] }) {
  // The rows say what each part is to screen readers themselves, so these are for the eye only.
  return (
    <div
      aria-hidden="true"
      className={`hidden border-b border-line bg-surface px-4 py-1.5 text-xs text-fg-subtle sm:grid ${COLUMNS}`}
    >
      {names.map((name) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  );
}

function UsedBy({ uses }: { uses: UsageGroup[] }) {
  return (
    <div className="text-xs">
      {/* A label on phones, where the column headings are hidden. */}
      <span className="text-fg-subtle sm:sr-only">Used by</span>
      <ul className="flex flex-col gap-0.5">
        {uses.map((use) => (
          <li
            key={`${use.version}|${String(use.dev)}`}
            className="flex flex-wrap items-baseline gap-x-1.5"
          >
            <span className="text-fg-muted">{use.apps.map(appLabel).join(', ')}</span>
            <code className="font-mono text-fg-subtle wrap-anywhere">{use.version}</code>
            {use.dev ? (
              <span
                title="Used to build or test, not at run time"
                className="rounded border border-line px-1 text-fg-subtle"
              >
                dev<span className="sr-only"> only</span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PackageItem({ row }: { row: PackageRow }) {
  return (
    <li className={ROW}>
      <span className="font-mono text-sm text-fg wrap-anywhere">
        <PackageName name={row.name} />
      </span>
      {row.why ? (
        <p className="text-sm text-fg-muted">
          <RichText text={row.why} />
        </p>
      ) : (
        // Keeps the columns in place on wide screens.
        <span className="hidden sm:block" />
      )}
      <UsedBy uses={row.uses} />
    </li>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className={GROUP_HEADING}>
        {title}
        <span className="font-normal tabular-nums normal-case">{count}</span>
      </h3>
      <div className="relative mt-2 overflow-hidden rounded-md border border-line">{children}</div>
    </section>
  );
}

function PlannedItem({ tool }: { tool: PlannedTool }) {
  return (
    <li className={ROW}>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-fg">{tool.name}</span>
        {tool.package && tool.package !== tool.name ? (
          <code className="font-mono text-xs text-fg-subtle wrap-anywhere">
            <PackageName name={tool.package} />
          </code>
        ) : null}
      </span>
      <p className="text-sm text-fg-muted">
        <RichText text={tool.why} />
      </p>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        <StatusBadge status="planned" plannedIn={tool.plannedIn} />
        {STACK_LAYER_LABEL[tool.layer]}
      </span>
    </li>
  );
}

export function PackageTable() {
  const { groups, typeDefinitions, total } = TABLE;
  const planned = guides.plannedTools;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm leading-relaxed text-fg-muted">
        {plural(total, 'npm package')} across the apps&apos; package.json files, with versions as
        written there. <span className="text-fg">dev</span> marks a package used only to build or
        test.
      </p>

      {groups.map((group) => (
        <Group key={group.id} title={group.label} count={group.packages.length}>
          <ColumnHeadings names={PACKAGE_COLUMNS} />
          <ul className="divide-y divide-line">
            {group.packages.map((row) => (
              <PackageItem key={row.name} row={row} />
            ))}
          </ul>
        </Group>
      ))}

      {typeDefinitions.length > 0 ? (
        <details className="rounded-md border border-line">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-fg-muted marker:text-fg-subtle">
            Type definitions <code className="font-mono text-xs">@types/*</code>
            <span className="ml-2 text-xs text-fg-subtle tabular-nums">
              {typeDefinitions.length}
            </span>
          </summary>
          <div className="border-t border-line">
            <ColumnHeadings names={PACKAGE_COLUMNS} />
            <ul className="divide-y divide-line">
              {typeDefinitions.map((row) => (
                <PackageItem key={row.name} row={row} />
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {planned.length > 0 ? (
        <Group title="Planned" count={planned.length}>
          <ColumnHeadings names={PLANNED_COLUMNS} />
          <ul className="divide-y divide-line">
            {planned.map((tool) => (
              <PlannedItem key={tool.name} tool={tool} />
            ))}
          </ul>
        </Group>
      ) : null}
    </div>
  );
}
