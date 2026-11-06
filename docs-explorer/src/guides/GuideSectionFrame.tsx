// The frame of one docs section: its title row and whatever follows. `?section=` finds it by
// id, focus moves to it the way it would for an anchor, and the title row is marked for a moment
// when a link opens it. Docs pages use it for their sections, and Error Handling for its flows.
import { useId, type ReactNode } from 'react';
import { SECTION, SECTION_TITLE, headingRow } from './classes.ts';
import { sectionElementId } from './guide-links.ts';

interface GuideSectionFrameProps {
  /** The section's id, as `?section=` names it. */
  id: string;
  title: string;
  /** Opened from a link just now: the title is marked for a moment. */
  marked: boolean;
  /** Shown beside the title, such as the section's status. */
  badge?: ReactNode;
  /** Where the frame sits on the page, such as a top margin. */
  className?: string;
  children?: ReactNode;
}

export function GuideSectionFrame({
  id,
  title,
  marked,
  badge,
  className,
  children,
}: GuideSectionFrameProps) {
  const headingId = useId();
  return (
    <section
      id={sectionElementId(id)}
      aria-labelledby={headingId}
      // Focus moves here when a link opens the section, as it would for an anchor.
      tabIndex={-1}
      className={className ? `${className} ${SECTION}` : SECTION}
    >
      <div className={headingRow(marked)}>
        <h2 id={headingId} className={SECTION_TITLE}>
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}
