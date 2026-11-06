// The detail view for one source file in the code explorer: where it is and which part of the
// system owns it, the symbols in it by kind, the routes it registers, the flow steps that run
// its code, and the whole file's real source.
import { Link } from 'react-router';
import { SourceCode } from '../code/SourceCode.tsx';
import { CODE, LINK, LIST, LOCATION, TEXT } from '../details/classes.ts';
import { DetailHeader, MetaDot } from '../details/DetailHeader.tsx';
import { DetailSection, SubHeading } from '../details/DetailSection.tsx';
import { Fact, FactList } from '../details/FactList.tsx';
import { FlowUsageList } from '../details/FlowUsageList.tsx';
import { fileName, groupUsagesByFlow } from '../details/format.ts';
import { NodeLink } from '../details/NodeLink.tsx';
import { SymbolLink } from '../details/SymbolLink.tsx';
import { sectionOf } from '../layout/sections.ts';
import { docs } from '../model/index.ts';
import { COMPONENT_KIND_LABEL } from '../model/labels.ts';
import { NAV, paths } from '../routes.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { plural } from '../ui/plural.ts';
import {
  fileRoutes,
  fileUsages,
  groupSymbolsByKind,
  languageLabel,
  routeKey,
  type FileRoute,
} from './file-facts.ts';

interface FileDetailsProps {
  /** The file's path in the repo, as the code index has it. */
  path: string;
}

export function FileDetails({ path }: FileDetailsProps) {
  const file = docs.getFile(path);
  if (!file) {
    return (
      <article>
        <EmptyState title="This file isn't in the code index">
          No file in the code index has the path <code className={CODE}>{path}</code>.
        </EmptyState>
      </article>
    );
  }

  const owner = docs.componentOfFile(file.path);
  const groups = groupSymbolsByKind(file.symbols);
  const routes = fileRoutes(file);
  const usages = groupUsagesByFlow(fileUsages(file.path, docs.flows));

  return (
    <article>
      <DetailHeader
        title={fileName(file.path)}
        mono
        meta={
          <>
            <span>{languageLabel(file.language)}</span>
            <MetaDot />
            <span>{plural(file.lineCount, 'line')}</span>
            <MetaDot />
            <span>{plural(file.symbols.length, 'symbol')}</span>
          </>
        }
      >
        <FactList layout="inline">
          <Fact label="Path">
            <code className={CODE}>{file.path}</code>
          </Fact>
          <Fact label="App">
            <span className="text-sm">{file.app}</span>
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

      <DetailSection title="Symbols" count={file.symbols.length}>
        {groups.length > 0 ? (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.kind}>
                <SubHeading>{group.title}</SubHeading>
                <ul className={LIST}>
                  {group.symbols.map((symbol) => (
                    <li key={symbol.id}>
                      <SymbolLink id={symbol.id} location="line" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className={TEXT}>The code index found no functions, types or constants here.</p>
        )}
      </DetailSection>

      {routes.length > 0 ? (
        <DetailSection title="Routes" count={routes.length}>
          <ul className={LIST}>
            {routes.map((route) => (
              <RouteItem key={routeKey(route)} route={route} />
            ))}
          </ul>
        </DetailSection>
      ) : null}

      {usages.length > 0 ? (
        <DetailSection title="Used in flows">
          <FlowUsageList groups={usages} />
        </DetailSection>
      ) : null}

      <DetailSection title="Source">
        <SourceCode filePath={file.path} startLine={1} endLine={Math.max(file.lineCount, 1)} />
      </DetailSection>
    </article>
  );
}

/** One route: method and path (a link to its flow when one is documented), line, and owner. */
function RouteItem({ route }: { route: FileRoute }) {
  const label = `${route.method} ${route.path}`;
  const { flow } = route;
  const section = flow
    ? NAV.find((item) => item.id === sectionOf(paths.flow(flow.id)))?.label
    : undefined;

  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      {flow ? (
        <Link to={paths.flow(flow.id)} className={`text-sm ${LINK}`}>
          <code className="font-mono text-xs wrap-anywhere">{label}</code>
          {section ? (
            <>
              {' '}
              {/* inline-block keeps the hover underline off the hint. */}
              <span className="inline-block text-xs text-fg-subtle">(in {section})</span>
            </>
          ) : null}
        </Link>
      ) : (
        <code className={CODE}>{label}</code>
      )}
      <span className={LOCATION}>line {route.line}</span>
      <span className="inline-flex items-baseline gap-x-1.5 text-xs text-fg-subtle">
        in <SymbolLink id={route.symbolId} location="none" />
      </span>
    </li>
  );
}
