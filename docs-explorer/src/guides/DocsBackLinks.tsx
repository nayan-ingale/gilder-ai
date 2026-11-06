// "In the docs": the docs sections that list this part, flow, function or file under "In the
// map", grouped under their page. Each opens its page at that section. Shown as a section of
// the detail panel, or folded under a page's summary (a flow's page, which has no panel of its
// own). Nothing is shown when no section is about it.
import { Link } from 'react-router';
import type { DocRef } from '../data/schema.ts';
import { LINK } from '../details/classes.ts';
import { DetailSection } from '../details/DetailSection.tsx';
import type { DocSectionUsage, GuidesModel } from '../model/guides.ts';
import { guides } from '../model/index.ts';
import { groupByPage, pagePath } from './guide-links.ts';

const TITLE = 'In the docs';

interface DocsBackLinksProps {
  about: DocRef;
  /** `panel`: a section of the detail panel. `header`: folded under a page's summary. */
  layout?: 'panel' | 'header';
  /** The docs pages to look in; tests pass made-up ones. */
  model?: Pick<GuidesModel, 'sectionsAbout'>;
}

function BackLinkList({ usages }: { usages: DocSectionUsage[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {groupByPage(usages).map(({ page, sections }) => (
        <li key={page.id}>
          <span className="text-xs text-fg-subtle">{page.title}</span>
          <ul className="mt-1 flex flex-col gap-1 border-l border-line pl-3">
            {sections.map((section) => (
              <li key={section.id}>
                <Link to={pagePath(page, section.id)} className={`text-sm ${LINK}`}>
                  {section.title}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function DocsBackLinks({ about, layout = 'panel', model = guides }: DocsBackLinksProps) {
  const usages = model.sectionsAbout(about);
  if (usages.length === 0) return null;

  if (layout === 'header') {
    // Folded, so the graph below keeps its room until the reader asks for the list.
    return (
      <details className="mt-1 text-xs">
        {/* py-1 makes the toggle 24px tall, easy to tap. */}
        <summary className="w-fit cursor-pointer py-1 text-fg-subtle select-none marker:text-fg-subtle hover:text-fg">
          {TITLE} <span className="tabular-nums">{usages.length}</span>
        </summary>
        <div className="mt-1 pb-1">
          <BackLinkList usages={usages} />
        </div>
      </details>
    );
  }

  return (
    <DetailSection title={TITLE} count={usages.length}>
      <BackLinkList usages={usages} />
    </DetailSection>
  );
}
