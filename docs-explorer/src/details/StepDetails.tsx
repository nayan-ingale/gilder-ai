// The detail view for one step of a flow: what happens and why, what comes before and after,
// the code that runs (its facts and its real source), where else that code runs, and buttons
// that walk the flow along its lines.
import { Link } from 'react-router';
import { SourceCode } from '../code/SourceCode.tsx';
import type { StepNeighbour } from '../model/docs-model.ts';
import { useSelection } from '../hooks/use-selection.ts';
import { docs } from '../model/index.ts';
import { COMPONENT_KIND_LABEL, STEP_KIND_LABEL } from '../model/labels.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { plural } from '../ui/plural.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { CODE, LINK, LOCATION, TEXT } from './classes.ts';
import { DetailHeader, MetaDot } from './DetailHeader.tsx';
import { DetailSection } from './DetailSection.tsx';
import { Fact, FactList } from './FactList.tsx';
import { FlowUsageList } from './FlowUsageList.tsx';
import { RichText } from './RichText.tsx';
import {
  describeLine,
  groupUsagesByFlow,
  hasSymbolFacts,
  keyedStrings,
  lineKey,
  stepLocation,
  stepNavTarget,
  stepPosition,
  symbolFactsTitle,
  type StepNavTarget,
} from './format.ts';
import { NodeLink } from './NodeLink.tsx';
import { SymbolFacts } from './SymbolFacts.tsx';
import { SymbolLink } from './SymbolLink.tsx';

interface StepDetailsProps {
  flowId: string;
  stepId: string;
}

export function StepDetails({ flowId, stepId }: StepDetailsProps) {
  const flow = docs.getFlow(flowId);
  const step = docs.getStep(flowId, stepId);
  const position = flow ? stepPosition(flow, stepId) : undefined;
  if (!flow || !step || !position) {
    return (
      <EmptyState title="This step isn't in the docs">
        The flow <code className={CODE}>{flowId}</code> has no step{' '}
        <code className={CODE}>{stepId}</code>.
      </EmptyState>
    );
  }

  const before = docs.stepsBefore(flow, step.id);
  const after = docs.stepsAfter(flow, step.id);
  const located = step.symbol ? docs.getSymbol(step.symbol) : undefined;
  const otherUsages = located
    ? groupUsagesByFlow(docs.usagesOf(located.symbol.id), { flowId: flow.id, stepId: step.id })
    : [];
  const owner = located ? docs.componentOfFile(located.file.path) : undefined;
  const sideEffects = step.sideEffects ?? [];

  return (
    <article>
      <DetailHeader
        title={step.title}
        meta={
          <>
            <span>{STEP_KIND_LABEL[step.kind]}</span>
            <MetaDot />
            <StatusBadge status={step.status} />
            <MetaDot />
            <span>
              Step {position.number} of {position.total}
            </span>
          </>
        }
      >
        {located ? (
          <p className={LOCATION}>
            {stepLocation(located.symbol, located.file.path, step.highlight !== undefined)}
          </p>
        ) : null}
      </DetailHeader>

      <DetailSection title="Overview">
        <FactList>
          <Fact label="What happens">
            <p className={TEXT}>
              <RichText text={step.what} />
            </p>
          </Fact>
          <Fact label="Why it exists">
            <p className={TEXT}>
              <RichText text={step.why} />
            </p>
          </Fact>
        </FactList>
      </DetailSection>

      {before.length + after.length > 0 || step.input || step.output || sideEffects.length > 0 ? (
        <DetailSection title="Execution">
          <FactList>
            {before.length > 0 ? (
              <Fact label="Comes before">
                <NeighbourList neighbours={before} />
              </Fact>
            ) : null}
            {after.length > 0 ? (
              <Fact label="Comes after">
                <NeighbourList neighbours={after} />
              </Fact>
            ) : null}
            {step.input ? (
              <Fact label="Input">
                <p className={TEXT}>
                  <RichText text={step.input} />
                </p>
              </Fact>
            ) : null}
            {step.output ? (
              <Fact label="Output">
                <p className={TEXT}>
                  <RichText text={step.output} />
                </p>
              </Fact>
            ) : null}
            {sideEffects.length > 0 ? (
              <Fact label="Side effects">
                <ul className={`list-disc space-y-1 pl-4 marker:text-fg-subtle ${TEXT}`}>
                  {keyedStrings(sideEffects).map(({ key, value }) => (
                    <li key={key}>
                      <RichText text={value} />
                    </li>
                  ))}
                </ul>
              </Fact>
            ) : null}
          </FactList>
        </DetailSection>
      ) : null}

      {step.symbol && !located ? (
        <DetailSection title="Code">
          <p className={TEXT}>
            This step points at <SymbolLink id={step.symbol} />, which isn&apos;t in the code index.
          </p>
        </DetailSection>
      ) : null}

      {located ? (
        <DetailSection title={symbolFactsTitle(located.symbol.kind)}>
          <div className="flex flex-col gap-3">
            {step.highlight ? (
              <div>
                <p className={TEXT}>
                  This step is one line inside <SymbolLink id={located.symbol.id} location="none" />
                  :
                </p>
                <pre
                  className={`mt-1.5 rounded border border-line bg-raised px-2 py-1.5 whitespace-pre-wrap ${CODE}`}
                >
                  {step.highlight}
                </pre>
              </div>
            ) : (
              <p className={TEXT}>
                Runs <SymbolLink id={located.symbol.id} location="none" />.
              </p>
            )}
            {hasSymbolFacts(located.symbol) ? <SymbolFacts symbol={located.symbol} /> : null}
          </div>
        </DetailSection>
      ) : null}

      {located ? (
        <DetailSection title="Source">
          <SourceCode
            filePath={located.file.path}
            startLine={located.symbol.startLine}
            endLine={located.symbol.endLine}
            highlight={step.highlight}
          />
        </DetailSection>
      ) : null}

      {owner || otherUsages.length > 0 ? (
        <DetailSection title="Related">
          <FactList>
            {owner ? (
              <Fact label="Part of">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <NodeLink component={owner} />
                  <span className="text-xs text-fg-subtle">{COMPONENT_KIND_LABEL[owner.kind]}</span>
                </span>
              </Fact>
            ) : null}
            {otherUsages.length > 0 ? (
              <Fact label="Other steps that run this code">
                <FlowUsageList groups={otherUsages} />
              </Fact>
            ) : null}
          </FactList>
        </DetailSection>
      ) : null}

      <StepNav previous={stepNavTarget(before)} next={stepNavTarget(after)} />
    </article>
  );
}

function NeighbourList({ neighbours }: { neighbours: StepNeighbour[] }) {
  const { searchWith } = useSelection();
  return (
    <ul className="flex flex-col gap-1.5">
      {neighbours.map(({ step, line }) => {
        const { kindLabel, condition } = describeLine(line);
        return (
          <li key={lineKey(line)} className="flex flex-col gap-0.5">
            <Link to={{ search: searchWith({ step: step.id }) }} className={`text-sm ${LINK}`}>
              {step.title}
            </Link>
            {kindLabel || condition ? (
              <span className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-fg-subtle">
                {kindLabel ? (
                  <span className="rounded border border-line px-1 text-fg-muted">{kindLabel}</span>
                ) : null}
                {condition ? <span>{condition}</span> : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface StepNavProps {
  previous: StepNavTarget;
  next: StepNavTarget;
}

/**
 * Previous and next step along the lines of the flow, not its list order. A side with one step
 * is a button; a side with several steps, or none, says so in a box of the same size, so the
 * other side never moves.
 */
function StepNav({ previous, next }: StepNavProps) {
  return (
    <nav aria-label="Walk through the flow" className="flex gap-2 border-t border-line px-4 py-3">
      <StepNavSide side="previous" target={previous} />
      <StepNavSide side="next" target={next} />
    </nav>
  );
}

const SIDE = 'flex min-w-0 flex-1 flex-col gap-0.5 rounded border px-3 py-2';

interface StepNavSideProps {
  side: 'previous' | 'next';
  target: StepNavTarget;
}

function StepNavSide({ side, target }: StepNavSideProps) {
  const { select } = useSelection();
  const align = side === 'previous' ? 'items-start text-left' : 'items-end text-right';
  const label = (
    <span className="text-xs text-fg-subtle">
      {side === 'previous' ? (
        <>
          <span aria-hidden="true">← </span>Previous step
        </>
      ) : (
        <>
          Next step<span aria-hidden="true"> →</span>
        </>
      )}
    </span>
  );

  // The spaces between the two lines are hidden by the flex layout, but keep the words apart
  // for screen readers.
  if (target.kind === 'one') {
    return (
      <button
        type="button"
        onClick={() => select({ step: target.step.id })}
        className={`${SIDE} border-line hover:bg-hover ${align}`}
      >
        {label} <span className="w-full truncate text-sm text-fg-muted">{target.step.title}</span>
      </button>
    );
  }

  return (
    <div className={`${SIDE} border-dashed border-line ${align}`}>
      {label} <span className="text-xs text-fg-subtle">{sideNote(side, target)}</span>
    </div>
  );
}

/** What a side with no single step to open says instead. */
function sideNote(
  side: 'previous' | 'next',
  target: Exclude<StepNavTarget, { kind: 'one' }>,
): string {
  if (target.kind === 'several') {
    return side === 'previous'
      ? `${plural(target.count, 'step')} lead here: see Comes before`
      : `Splits into ${plural(target.count, 'step')}: see Comes after`;
  }
  return side === 'previous' ? 'Start of the flow' : 'End of this path';
}
