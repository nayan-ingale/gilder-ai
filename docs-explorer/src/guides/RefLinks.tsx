// The "In the map" box under a docs section: what the section is about, by kind, each a link to
// where the explorer shows it. Parts open on System Architecture, the view that shows every
// part. A file the code index doesn't have (a config file, say) is shown as its path, and an id
// the docs don't know as it is, never as a dead link.
import { useId } from 'react';
import { Link } from 'react-router';
import type { DocRef } from '../data/schema.ts';
import { LINK } from '../details/classes.ts';
import { nodeTarget } from '../details/node-target.ts';
import { refKey } from '../model/guides.ts';
import { paths } from '../routes.ts';
import {
  REF_KIND_LABEL,
  groupRefs,
  resolveRef,
  symbolFileHint,
  type ResolvedRef,
} from './guide-links.ts';

// Each item is at least 24px tall, so the links in a wrapped row are easy to tap: names in the
// body size, and paths and ids in the smaller code size.
const ITEM = 'inline-block py-0.5';
const MONO = 'inline-block py-1 font-mono text-xs wrap-anywhere';

function RefItem({ resolved }: { resolved: ResolvedRef }) {
  switch (resolved.kind) {
    case 'component': {
      // No architecture view is open here, so this is System Architecture.
      const { viewId } = nodeTarget(resolved.component.id, undefined);
      return (
        <Link
          to={paths.architecture(viewId, resolved.component.id)}
          className={`${ITEM} text-sm ${LINK}`}
        >
          {resolved.component.name}
        </Link>
      );
    }
    case 'flow':
      return (
        <Link to={resolved.to} className={`${ITEM} text-sm ${LINK}`}>
          {resolved.flow.title}
        </Link>
      );
    case 'symbol': {
      const hint = symbolFileHint(resolved.name, resolved.filePath);
      return (
        <Link to={resolved.to} title={resolved.filePath} className={`group ${ITEM} rounded-sm`}>
          <span className="font-mono text-xs text-accent wrap-anywhere group-hover:underline">
            {resolved.name}
          </span>
          {hint ? <span className="ml-1.5 text-xs text-fg-subtle">in {hint}</span> : null}
        </Link>
      );
    }
    case 'file':
      return resolved.to ? (
        <Link to={resolved.to} className={`${MONO} ${LINK}`}>
          {resolved.path}
        </Link>
      ) : (
        <code className={`${MONO} text-fg-muted`}>{resolved.path}</code>
      );
    case 'unknown':
      return <code className={`${MONO} text-fg-muted`}>{resolved.text}</code>;
  }
}

export function RefLinks({ refs }: { refs: DocRef[] }) {
  const headingId = useId();
  const groups = groupRefs(refs);

  return (
    <section aria-labelledby={headingId} className="rounded-md border border-line bg-surface">
      <h3 id={headingId} className="px-3 pt-2 text-xs font-medium text-fg-subtle">
        In the map
      </h3>
      <dl className="flex flex-col gap-1 px-3 pt-1 pb-2">
        {groups.map((group) => (
          <div key={group.kind} className="grid sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-3">
            <dt className="text-xs leading-6 text-fg-subtle">{REF_KIND_LABEL[group.kind]}</dt>
            <dd className="min-w-0">
              <ul className="flex flex-wrap items-baseline gap-x-4">
                {group.refs.map((ref) => (
                  <li key={refKey(ref)} className="min-w-0">
                    <RefItem resolved={resolveRef(ref)} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
