// The detail view for any function, type or constant, opened from a symbol link. It sits on top
// of the step or node underneath; the button at the top closes it and names what is underneath.
// Shows the code comment, the hand-written note, what the code index knows, the flows that run
// it, and its real source.
import { useParams } from 'react-router';
import { SourceCode } from '../code/SourceCode.tsx';
import { useSelection } from '../hooks/use-selection.ts';
import { docs } from '../model/index.ts';
import { COMPONENT_KIND_LABEL, SYMBOL_KIND_LABEL } from '../model/labels.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { CODE, LIST, TEXT } from './classes.ts';
import { DetailHeader, MetaDot } from './DetailHeader.tsx';
import { DetailSection } from './DetailSection.tsx';
import { Fact, FactList } from './FactList.tsx';
import { FlowUsageList } from './FlowUsageList.tsx';
import { RichText } from './RichText.tsx';
import {
  fileLocation,
  groupUsagesByFlow,
  hasSymbolFacts,
  keyedStrings,
  symbolDisplayName,
  symbolFactsTitle,
} from './format.ts';
import { NodeLink } from './NodeLink.tsx';
import { SymbolFacts } from './SymbolFacts.tsx';

interface SymbolDetailsProps {
  symbolId: string;
}

/**
 * What closing the symbol view shows again: the step or node selected under it, by name. Only
 * the selection the page actually uses counts (a step on a flow page, a node on an architecture
 * page). An ID the docs don't know is shown as it is.
 */
function underneathName(
  { flowId, viewId }: { flowId?: string; viewId?: string },
  { step, node }: { step?: string; node?: string },
): string | undefined {
  if (flowId !== undefined && step !== undefined) return docs.getStep(flowId, step)?.title ?? step;
  if (viewId !== undefined && node !== undefined) return docs.getComponent(node)?.name ?? node;
  return undefined;
}

export function SymbolDetails({ symbolId }: SymbolDetailsProps) {
  const params = useParams();
  const selection = useSelection();
  const underneath = underneathName(params, selection);
  const backButton = (
    <div className="px-4 pt-3">
      <button
        type="button"
        onClick={() => selection.select({ symbol: undefined })}
        className="rounded-sm text-left text-xs text-fg-subtle hover:text-fg"
      >
        <span aria-hidden="true">← </span>
        {underneath === undefined ? 'Close' : `Back to ${underneath}`}
      </button>
    </div>
  );

  const located = docs.getSymbol(symbolId);
  if (!located) {
    return (
      <article>
        {backButton}
        <EmptyState title="This function isn't in the code index">
          No entry in the code index has the ID <code className={CODE}>{symbolId}</code>.
        </EmptyState>
      </article>
    );
  }

  const { symbol, file } = located;
  const note = docs.getNote(symbol.id);
  const owner = docs.componentOfFile(file.path);
  const usages = groupUsagesByFlow(docs.usagesOf(symbol.id));

  return (
    <article>
      {backButton}

      <DetailHeader
        title={symbolDisplayName(symbol, file.path)}
        mono
        meta={
          <>
            <span>{SYMBOL_KIND_LABEL[symbol.kind]}</span>
            <MetaDot />
            <span>{symbol.exported ? 'Exported' : 'Not exported'}</span>
            {note ? (
              <>
                <MetaDot />
                <StatusBadge status={note.status} />
              </>
            ) : null}
          </>
        }
      >
        <FactList layout="inline">
          <Fact label="File">
            <code className={CODE}>
              {fileLocation(file.path, symbol.startLine, symbol.endLine)}
            </code>
          </Fact>
          {owner ? (
            <Fact label="Part of">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <NodeLink component={owner} />
                <span className="text-xs text-fg-subtle">{COMPONENT_KIND_LABEL[owner.kind]}</span>
              </span>
            </Fact>
          ) : null}
        </FactList>
      </DetailHeader>

      {symbol.doc ? (
        <DetailSection title="Code comment">
          <blockquote className={`border-l-2 border-line-strong pl-3 whitespace-pre-line ${TEXT}`}>
            {symbol.doc}
          </blockquote>
        </DetailSection>
      ) : null}

      {note ? (
        <DetailSection title="Notes">
          <FactList>
            <Fact label="What it does">
              <p className={TEXT}>
                <RichText text={note.summary} />
              </p>
            </Fact>
            {note.how && note.how.length > 0 ? (
              <Fact label="How it works">
                <ol className={`list-decimal space-y-1 pl-5 marker:text-fg-subtle ${TEXT}`}>
                  {keyedStrings(note.how).map(({ key, value }) => (
                    <li key={key}>
                      <RichText text={value} />
                    </li>
                  ))}
                </ol>
              </Fact>
            ) : null}
            <Fact label="Why it exists">
              <p className={TEXT}>
                <RichText text={note.why} />
              </p>
            </Fact>
            {note.returns ? (
              <Fact label="Returns">
                <p className={TEXT}>
                  <RichText text={note.returns} />
                </p>
              </Fact>
            ) : null}
            {note.sideEffects && note.sideEffects.length > 0 ? (
              <Fact label="Side effects">
                <ul className={`list-disc space-y-1 pl-4 marker:text-fg-subtle ${TEXT}`}>
                  {keyedStrings(note.sideEffects).map(({ key, value }) => (
                    <li key={key}>
                      <RichText text={value} />
                    </li>
                  ))}
                </ul>
              </Fact>
            ) : null}
            {note.tests && note.tests.length > 0 ? (
              <Fact label="Tests">
                <ul className={LIST}>
                  {keyedStrings(note.tests).map(({ key, value }) => (
                    <li key={key}>
                      <code className={CODE}>{value}</code>
                    </li>
                  ))}
                </ul>
              </Fact>
            ) : null}
          </FactList>
        </DetailSection>
      ) : null}

      {hasSymbolFacts(symbol) ? (
        <DetailSection title={symbolFactsTitle(symbol.kind)}>
          <SymbolFacts symbol={symbol} />
        </DetailSection>
      ) : null}

      {usages.length > 0 ? (
        <DetailSection title="Used in flows">
          <FlowUsageList groups={usages} />
        </DetailSection>
      ) : null}

      <DetailSection title="Source">
        <SourceCode filePath={file.path} startLine={symbol.startLine} endLine={symbol.endLine} />
      </DetailSection>
    </article>
  );
}
