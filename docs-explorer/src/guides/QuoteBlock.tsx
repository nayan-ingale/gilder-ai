// Exact text from a file in the repo, shown as code under its path, in the same frame as the
// source viewer. The build checks the text is still in the file. An indexed source file's path
// opens it in the code explorer.
import { Link } from 'react-router';
import type { DocBlock } from '../data/schema.ts';
import { LINK } from '../details/classes.ts';
import { RichText } from '../details/RichText.tsx';
import { docs } from '../model/index.ts';
import { paths } from '../routes.ts';

type Quote = Extract<DocBlock, { kind: 'quote' }>;

interface QuoteBlockProps {
  quote: Quote;
  /** Names the scrolling frame: the section and the file (frameLabels). */
  label: string;
}

export function QuoteBlock({ quote, label }: QuoteBlockProps) {
  const indexed = docs.getFile(quote.file) !== undefined;

  return (
    <figure className="overflow-hidden rounded-md border border-line bg-canvas">
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-1 text-xs">
        {indexed ? (
          <Link
            to={paths.code({ file: quote.file })}
            // py-1 makes the link 24px tall, easy to tap.
            className={`py-1 font-mono wrap-anywhere ${LINK}`}
          >
            {quote.file}
          </Link>
        ) : (
          <span className="py-1 font-mono text-fg wrap-anywhere">{quote.file}</span>
        )}
        {quote.caption ? (
          <span className="text-fg-subtle">
            <RichText text={quote.caption} />
          </span>
        ) : null}
      </figcaption>
      <div
        role="region"
        tabIndex={0}
        aria-label={label}
        className="relative overflow-x-auto focus-visible:-outline-offset-2"
      >
        <pre className="px-3 py-2 font-mono text-[13px] leading-5 text-fg">
          <code>{quote.text}</code>
        </pre>
      </div>
    </figure>
  );
}
