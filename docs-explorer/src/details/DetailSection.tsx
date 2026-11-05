// One titled section of the detail panel: a small heading and its content, with a 1px line
// above it. Long sections can be collapsible, using the browser's own <details> toggle.
import { useId, type ReactNode } from 'react';

const HEADING = 'text-xs font-semibold tracking-wide text-fg-subtle uppercase';

interface DetailSectionProps {
  title: string;
  /** Shown after the title, e.g. how many items the section lists. */
  count?: number;
  /** Lets the reader fold the section away. */
  collapsible?: boolean;
  /** For collapsible sections: whether it starts open. Defaults to open. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function DetailSection({
  title,
  count,
  collapsible = false,
  defaultOpen = true,
  children,
}: DetailSectionProps) {
  const headingId = useId();
  const heading = (
    <h3 id={headingId} className={`${HEADING} inline`}>
      {title}
      {count === undefined ? null : (
        <span className="ml-1.5 font-normal tracking-normal text-fg-subtle normal-case">
          {count}
        </span>
      )}
    </h3>
  );

  return (
    <section aria-labelledby={headingId} className="border-t border-line px-4 py-3">
      {collapsible ? (
        <details open={defaultOpen}>
          <summary className="cursor-pointer select-none marker:text-fg-subtle">{heading}</summary>
          <div className="mt-2.5">{children}</div>
        </details>
      ) : (
        <>
          {heading}
          <div className="mt-2.5">{children}</div>
        </>
      )}
    </section>
  );
}

interface SubHeadingProps {
  children: ReactNode;
}

/** A label for a group inside a section, such as "Incoming" under "Connections". */
export function SubHeading({ children }: SubHeadingProps) {
  return <h4 className="mb-1.5 text-xs font-medium text-fg-muted">{children}</h4>;
}
