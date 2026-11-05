// What the code index knows about one symbol: signature, parameters, return and value types,
// routes it registers, outside packages it calls, and who it calls and is called by. Shared by
// the step view and the symbol view. Rows with no data are left out; callers check
// hasSymbolFacts() first so they can drop the whole section when there is nothing to show.
import { useId } from 'react';
import type { IndexedSymbol, SymbolParam } from '../data/source-index.ts';
import { CODE, LIST, LOCATION } from './classes.ts';
import { Fact, FactList } from './FactList.tsx';
import { groupExternalCalls } from './format.ts';
import { SymbolLinkList } from './SymbolLink.tsx';

interface SymbolFactsProps {
  symbol: IndexedSymbol;
}

export function SymbolFacts({ symbol }: SymbolFactsProps) {
  const params = symbol.params ?? [];
  const externals = groupExternalCalls(symbol.externalCalls);
  const paramsLabelId = useId();

  return (
    <FactList>
      {symbol.signature ? (
        <Fact label="Signature">
          <pre className={`${CODE} whitespace-pre-wrap`}>{symbol.signature}</pre>
        </Fact>
      ) : null}

      {params.length > 0 ? (
        <Fact label="Parameters" labelId={paramsLabelId}>
          <ParamTable params={params} labelledBy={paramsLabelId} />
        </Fact>
      ) : null}

      {symbol.returnType ? (
        <Fact label="Return type">
          <code className={CODE}>{symbol.returnType}</code>
        </Fact>
      ) : null}

      {symbol.valueType ? (
        <Fact label="Value type">
          <pre className={`${CODE} whitespace-pre-wrap`}>{symbol.valueType}</pre>
        </Fact>
      ) : null}

      {symbol.routes.length > 0 ? (
        <Fact label="Routes it registers">
          <ul className={LIST}>
            {symbol.routes.map((route) => (
              <li
                key={`${route.method} ${route.path}:${route.line}`}
                className="flex flex-wrap items-baseline gap-x-2"
              >
                <code className={CODE}>
                  {route.method} {route.path}
                </code>
                <span className={LOCATION}>line {route.line}</span>
              </li>
            ))}
          </ul>
        </Fact>
      ) : null}

      {externals.length > 0 ? (
        <Fact label="Outside packages it calls">
          <ul className={LIST}>
            {externals.map((group) => (
              <li key={group.package} className="flex flex-wrap items-baseline gap-x-2">
                <span className={LOCATION}>{group.package}</span>
                <code className={CODE}>{group.names.join(', ')}</code>
              </li>
            ))}
          </ul>
        </Fact>
      ) : null}

      {symbol.calls.length > 0 ? (
        <Fact label="Calls">
          <SymbolLinkList ids={symbol.calls} />
        </Fact>
      ) : null}

      {symbol.calledBy.length > 0 ? (
        <Fact label="Called by">
          <SymbolLinkList ids={symbol.calledBy} />
        </Fact>
      ) : null}
    </FactList>
  );
}

const HEADER_CELL = 'py-1 pr-3 text-left text-xs font-medium text-fg-subtle';
const CELL = 'py-1 pr-3 align-top';

interface ParamTableProps {
  params: SymbolParam[];
  /** The id of the "Parameters" label above the table, which names it for screen readers. */
  labelledBy: string;
}

function ParamTable({ params, labelledBy }: ParamTableProps) {
  // The Default column only appears when some parameter has one.
  const showDefault = params.some((param) => param.defaultValue !== undefined);

  return (
    <table aria-labelledby={labelledBy} className="w-full border-collapse">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={HEADER_CELL}>
            Name
          </th>
          <th scope="col" className={HEADER_CELL}>
            Type
          </th>
          <th scope="col" className={HEADER_CELL}>
            Optional
          </th>
          {showDefault ? (
            <th scope="col" className={HEADER_CELL}>
              Default
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {params.map((param) => (
          <tr key={param.name} className="border-b border-line last:border-b-0">
            <th scope="row" className={`${CELL} text-left font-normal`}>
              <code className={CODE}>{param.name}</code>
            </th>
            <td className={CELL}>
              <code className={CODE}>{param.type}</code>
            </td>
            <td className={`${CELL} text-xs text-fg-muted`}>{param.optional ? 'Yes' : 'No'}</td>
            {showDefault ? (
              <td className={CELL}>
                {param.defaultValue === undefined ? null : (
                  <code className={CODE}>{param.defaultValue}</code>
                )}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
