// A link that opens a function, type or constant in the detail panel, on top of whatever page
// is open. IDs the code index doesn't know are shown as plain text, never as a dead link.
import { Link } from 'react-router';
import { useSelection } from '../hooks/use-selection.ts';
import { docs } from '../model/index.ts';
import { LIST, LOCATION } from './classes.ts';
import { fileLocation, symbolDisplayName } from './format.ts';

interface SymbolLinkProps {
  id: string;
  /** `file` shows `path:line`, `line` only `line N` (when the file is already clear), `none` nothing. */
  location?: 'file' | 'line' | 'none';
}

export function SymbolLink({ id, location = 'file' }: SymbolLinkProps) {
  const { searchWith } = useSelection();
  const located = docs.getSymbol(id);

  if (!located) {
    return <span className="font-mono text-xs text-fg-muted wrap-anywhere">{id}</span>;
  }

  const { symbol, file } = located;
  const where =
    location === 'file'
      ? fileLocation(file.path, symbol.startLine)
      : location === 'line'
        ? `line ${symbol.startLine}`
        : undefined;

  return (
    <Link
      to={{ search: searchWith({ symbol: id }) }}
      className="group inline-flex max-w-full flex-wrap items-baseline gap-x-2 rounded-sm"
    >
      <span className="font-mono text-xs text-accent wrap-anywhere group-hover:underline">
        {symbolDisplayName(symbol, file.path)}
      </span>
      {where ? <span className={LOCATION}>{where}</span> : null}
    </Link>
  );
}

/** A list of symbol links, each with its file and line. Repeated IDs are shown once. */
export function SymbolLinkList({ ids }: { ids: string[] }) {
  return (
    <ul className={LIST}>
      {[...new Set(ids)].map((id) => (
        <li key={id}>
          <SymbolLink id={id} />
        </li>
      ))}
    </ul>
  );
}
