import { useMemo } from 'react';
import { Link, useLocation } from 'react-router';
import { buildBreadcrumbs } from './breadcrumbs.ts';

const SEPARATOR = (
  <span aria-hidden="true" className="text-fg-subtle">
    ›
  </span>
);

const LINK = 'truncate rounded-sm text-fg-subtle transition-colors hover:text-fg';

/**
 * Where you are, read from the URL: section › flow or component › step › symbol. Every crumb
 * but the last is a link back up. On narrow screens only the last two crumbs fit, so the ones
 * before them fold into a "…" crumb that leads to the nearest of them.
 */
export function Breadcrumbs() {
  const { pathname, search } = useLocation();
  const crumbs = useMemo(() => buildBreadcrumbs(pathname, search), [pathname, search]);
  const firstShownWhenNarrow = Math.max(crumbs.length - 2, 0);
  const foldedParent = crumbs[firstShownWhenNarrow - 1];

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {foldedParent ? (
          <li className="flex shrink-0 items-center sm:hidden">
            <Link
              to={foldedParent.to}
              aria-label={foldedParent.label}
              title={foldedParent.label}
              className={LINK}
            >
              …
            </Link>
          </li>
        ) : null}
        {crumbs.map((crumb, position) => {
          const isLast = position === crumbs.length - 1;
          const hiddenWhenNarrow = position < firstShownWhenNarrow;
          return (
            <li
              key={`${crumb.to}|${crumb.label}`}
              className={`min-w-0 items-center gap-1.5 ${hiddenWhenNarrow ? 'hidden sm:flex' : 'flex'} ${isLast ? '' : 'max-w-48 shrink-0 sm:shrink'}`}
            >
              {/* The first visible crumb follows the "…" crumb, so it always has a separator. */}
              {position > 0 ? SEPARATOR : null}
              {isLast ? (
                <span aria-current="page" className="truncate font-medium text-fg">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className={LINK}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
