// A definition list of facts (label → value). `inline` puts short values beside their label;
// `stacked` puts each value under its label, for paragraphs, tables and lists.
import { createContext, use, type ReactNode } from 'react';

type Layout = 'inline' | 'stacked';

const LayoutContext = createContext<Layout>('stacked');

interface FactListProps {
  layout?: Layout;
  children: ReactNode;
}

export function FactList({ layout = 'stacked', children }: FactListProps) {
  return (
    <LayoutContext value={layout}>
      <dl
        className={
          layout === 'inline'
            ? 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm'
            : 'flex flex-col gap-3 text-sm'
        }
      >
        {children}
      </dl>
    </LayoutContext>
  );
}

interface FactProps {
  label: string;
  /** An id for the label, so a table or list in the value can be named by it. */
  labelId?: string;
  children: ReactNode;
}

/** One label and its value. The wrapping <div> is allowed inside <dl> and keeps them together. */
export function Fact({ label, labelId, children }: FactProps) {
  const inline = use(LayoutContext) === 'inline';
  return (
    <div className={inline ? 'contents' : undefined}>
      <dt id={labelId} className="text-xs leading-5 text-fg-subtle">
        {label}
      </dt>
      <dd className={`min-w-0 text-fg-muted ${inline ? 'leading-5' : 'mt-1'}`}>{children}</dd>
    </div>
  );
}
