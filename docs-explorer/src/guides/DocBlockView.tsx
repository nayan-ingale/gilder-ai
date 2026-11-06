// One block of a docs section: a paragraph, a list, labelled lines, a table, a quote from the
// repo or the package table. Prose keeps a readable line length; tables and code use the width.
import type { DocBlock } from '../data/schema.ts';
import { TEXT } from '../details/classes.ts';
import { keyedStrings } from '../details/format.ts';
import { RichText } from '../details/RichText.tsx';
import { DocTable } from './DocTable.tsx';
import { PackageTable } from './PackageTable.tsx';
import { QuoteBlock } from './QuoteBlock.tsx';

interface DocBlockViewProps {
  block: DocBlock;
  /** The name of a table's or quote's scrolling frame, unique on the page (frameLabels). */
  label: string;
}

export function DocBlockView({ block, label }: DocBlockViewProps) {
  switch (block.kind) {
    case 'text':
      return (
        <p className={`max-w-3xl ${TEXT}`}>
          <RichText text={block.text} />
        </p>
      );
    case 'list':
      return (
        <ul className={`max-w-3xl list-disc space-y-1.5 pl-5 marker:text-fg-subtle ${TEXT}`}>
          {keyedStrings(block.items).map(({ key, value }) => (
            <li key={key}>
              <RichText text={value} />
            </li>
          ))}
        </ul>
      );
    case 'fields':
      return (
        <dl className="max-w-3xl divide-y divide-line rounded-md border border-line">
          {keyedStrings(block.fields.map((field) => field.label)).map(({ key }, position) => {
            const field = block.fields[position];
            return field ? (
              <div
                key={key}
                className="grid gap-1 px-4 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"
              >
                <dt className="text-xs leading-6 font-medium text-fg-subtle">{field.label}</dt>
                <dd className={TEXT}>
                  <RichText text={field.text} />
                </dd>
              </div>
            ) : null;
          })}
        </dl>
      );
    case 'table':
      return <DocTable table={block} label={label} />;
    case 'quote':
      return <QuoteBlock quote={block} label={label} />;
    case 'packages':
      return <PackageTable />;
  }
}
