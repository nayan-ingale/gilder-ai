// "On this page": a short list of a docs page's sections, each a link that scrolls to it.
// Hash URLs can't use `#` anchors, so each link sets `?section=` instead.
import { useId } from 'react';
import { Link } from 'react-router';
import type { DocPage } from '../data/schema.ts';
import { pagePath } from './guide-links.ts';

interface GuideContentsProps {
  page: DocPage;
  /** More places on the same page to list after the sections, such as a list of flows. */
  extra?: { id: string; title: string; to: string }[];
}

export function GuideContents({ page, extra = [] }: GuideContentsProps) {
  const headingId = useId();
  const entries = [
    ...page.sections.map((section) => ({
      id: section.id,
      title: section.title,
      to: pagePath(page, section.id),
    })),
    ...extra,
  ];
  return (
    <nav aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
        On this page
      </h2>
      <ol className="mt-2 flex flex-col border-l border-line">
        {entries.map((entry) => (
          <li key={entry.id} className="flex">
            <Link
              to={entry.to}
              className="-ml-px rounded-sm border-l border-transparent py-0.5 pl-3 text-sm text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {entry.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
