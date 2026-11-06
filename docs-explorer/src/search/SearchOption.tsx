import type { SearchHit } from './search-engine.ts';
import { SearchTypeIcon } from './SearchTypeIcon.tsx';

interface SearchOptionProps {
  hit: SearchHit;
  id: string;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}

/**
 * One result in the search list: its kind as an icon, the title with the matched part in bold,
 * where it lives, and what kind of thing it is. It never takes focus (the search box keeps it);
 * the box points at the active one with aria-activedescendant.
 */
export function SearchOption({ hit, id, active, onHover, onChoose }: SearchOptionProps) {
  const { doc, parts } = hit;
  const code = doc.type === 'symbol' || doc.type === 'file' || doc.type === 'route';

  return (
    <div
      role="option"
      id={id}
      aria-selected={active}
      // Mouse movement, not entry: a list scrolled by the keyboard under a still pointer must
      // not move the active result.
      onMouseMove={active ? undefined : onHover}
      onClick={onChoose}
      className={`relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 ${
        active ? 'bg-hover text-fg' : 'text-fg-muted'
      }`}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
        />
      ) : null}
      <span className="text-fg-subtle">
        <SearchTypeIcon type={doc.type} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <span className={`truncate text-fg ${code ? 'font-mono text-[0.8125rem]' : 'text-sm'}`}>
          {parts.map((part) =>
            part.match ? (
              <mark key={part.offset} className="bg-transparent font-semibold text-inherit">
                {part.text}
              </mark>
            ) : (
              <span key={part.offset}>{part.text}</span>
            ),
          )}
        </span>
        {doc.subtitle ? (
          <span className="truncate text-xs text-fg-subtle">{doc.subtitle}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-xs text-fg-subtle">{doc.label}</span>
      <span
        aria-hidden="true"
        className={`hidden w-3 shrink-0 text-center text-xs text-fg-subtle sm:inline ${
          active ? '' : 'invisible'
        }`}
      >
        ↵
      </span>
    </div>
  );
}
