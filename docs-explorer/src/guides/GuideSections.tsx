// A docs page's sections, one after another: each with its title, its status when it isn't
// verified, its blocks and what it is about in the map. The page brings a section named by
// `?section=` into view (useSectionTarget) and says which one to mark.
import type { DocPage, DocSection } from '../data/schema.ts';
import { keyedStrings } from '../details/format.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { DocBlockView } from './DocBlockView.tsx';
import { frameLabels } from './guide-links.ts';
import { GuideSectionFrame } from './GuideSectionFrame.tsx';
import { RefLinks } from './RefLinks.tsx';

interface GuideSectionProps {
  section: DocSection;
  /** Opened from a link just now: the title is marked for a moment. */
  marked: boolean;
}

function GuideSection({ section, marked }: GuideSectionProps) {
  const refs = section.refs ?? [];
  const labels = frameLabels(section);

  return (
    <GuideSectionFrame
      id={section.id}
      title={section.title}
      marked={marked}
      badge={
        section.status === 'verified' ? null : (
          <StatusBadge status={section.status} plannedIn={section.plannedIn} />
        )
      }
    >
      {section.blocks.length > 0 || refs.length > 0 ? (
        <div className="mt-3 flex flex-col gap-4">
          {/* Blocks have no ids, so each is keyed by its content. */}
          {keyedStrings(section.blocks.map((block) => JSON.stringify(block))).map(
            ({ key }, position) => {
              const block = section.blocks[position];
              return block ? (
                <DocBlockView key={key} block={block} label={labels[position] ?? section.title} />
              ) : null;
            },
          )}
          {refs.length > 0 ? <RefLinks refs={refs} /> : null}
        </div>
      ) : null}
    </GuideSectionFrame>
  );
}

interface GuideSectionsProps {
  page: DocPage;
  /** The id of the section to mark, from useSectionTarget. */
  marked: string | undefined;
}

export function GuideSections({ page, marked }: GuideSectionsProps) {
  return (
    <div className="flex flex-col gap-8">
      {page.sections.map((section) => (
        <GuideSection key={section.id} section={section} marked={marked === section.id} />
      ))}
    </div>
  );
}
