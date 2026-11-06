// A table written in the docs. Each column keeps a readable width, so a wide table scrolls
// sideways inside its frame on a phone instead of squeezing its words or widening the page.
import type { DocBlock } from '../data/schema.ts';
import { keyedStrings } from '../details/format.ts';
import { RichText } from '../details/RichText.tsx';

type Table = Extract<DocBlock, { kind: 'table' }>;

interface DocTableProps {
  table: Table;
  /** Names the scrolling frame: the section the table is in (frameLabels). */
  label: string;
}

export function DocTable({ table, label }: DocTableProps) {
  const columns = keyedStrings(table.columns);
  // Rows are keyed by their text; a repeated row gets a count added.
  const rows = keyedStrings(table.rows.map((row) => row.join('\t'))).map(({ key }, position) => ({
    key,
    cells: table.rows[position] ?? [],
  }));

  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={label}
      className="relative overflow-x-auto rounded-md border border-line focus-visible:-outline-offset-2"
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-fg-subtle">
          <tr>
            {columns.map(({ key, value }) => (
              <th key={key} scope="col" className="min-w-32 px-3 py-2 align-bottom font-medium">
                {value}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map(({ key }, column) => (
                <td key={key} className="px-3 py-2 align-top leading-relaxed text-fg-muted">
                  <RichText text={row.cells[column] ?? ''} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
