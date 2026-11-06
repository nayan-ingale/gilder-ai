// The detail view for one part of the system (an architecture node): what it is, where its
// code starts, what it connects to, the files in its folder, the flows it takes part in and the
// docs sections about it.
// A connection to a part the open view doesn't show links to System Architecture instead.
import { Link } from 'react-router';
import { DocsBackLinks } from '../guides/DocsBackLinks.tsx';
import type { ComponentConnection } from '../model/docs-model.ts';
import { docs } from '../model/index.ts';
import { COMPONENT_KIND_LABEL, FLOW_CATEGORY_LABEL, LINK_KIND_LABEL } from '../model/labels.ts';
import { paths } from '../routes.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { CODE, LINK, LIST, TEXT } from './classes.ts';
import { DetailHeader, MetaDot } from './DetailHeader.tsx';
import { DetailSection, SubHeading } from './DetailSection.tsx';
import { Fact, FactList } from './FactList.tsx';
import { connectionKey, keyedStrings, pathInside, splitConnections } from './format.ts';
import { NodeLink } from './NodeLink.tsx';
import { RichText } from './RichText.tsx';
import { SymbolLink, SymbolLinkList } from './SymbolLink.tsx';

interface ComponentDetailsProps {
  componentId: string;
}

export function ComponentDetails({ componentId }: ComponentDetailsProps) {
  const component = docs.getComponent(componentId);
  if (!component) {
    return (
      <EmptyState title="This part of the system isn't in the docs">
        Nothing in the architecture has the ID <code className={CODE}>{componentId}</code>.
      </EmptyState>
    );
  }

  const { incoming, outgoing } = splitConnections(docs.connectionsOf(component.id));
  const files = docs.filesOf(component.id);
  const flows = docs.flowsOf(component.id);
  const entryPoints = component.entryPoints ?? [];

  return (
    <article>
      <DetailHeader
        title={component.name}
        meta={
          <>
            <span>{COMPONENT_KIND_LABEL[component.kind]}</span>
            <MetaDot />
            <StatusBadge status={component.status} plannedIn={component.plannedIn} />
          </>
        }
      >
        {component.path !== undefined || component.port !== undefined ? (
          <FactList layout="inline">
            {component.path !== undefined ? (
              <Fact label="Folder">
                <code className={CODE}>{component.path}</code>
              </Fact>
            ) : null}
            {component.port !== undefined ? (
              <Fact label="Port">
                <code className={CODE}>{component.port}</code>
              </Fact>
            ) : null}
          </FactList>
        ) : null}
      </DetailHeader>

      <DetailSection title="Overview">
        <p className={TEXT}>
          <RichText text={component.summary} />
        </p>
        {component.responsibilities.length > 0 ? (
          <ul className={`mt-2.5 list-disc space-y-1.5 pl-4 marker:text-fg-subtle ${TEXT}`}>
            {keyedStrings(component.responsibilities).map(({ key, value }) => (
              <li key={key}>
                <RichText text={value} />
              </li>
            ))}
          </ul>
        ) : null}
      </DetailSection>

      {entryPoints.length > 0 ? (
        <DetailSection title="Entry points" count={entryPoints.length}>
          <SymbolLinkList ids={entryPoints} />
        </DetailSection>
      ) : null}

      {incoming.length + outgoing.length > 0 ? (
        <DetailSection title="Connections" count={incoming.length + outgoing.length}>
          <div className="flex flex-col gap-3">
            {incoming.length > 0 ? (
              <ConnectionGroup title="Incoming" connections={incoming} />
            ) : null}
            {outgoing.length > 0 ? (
              <ConnectionGroup title="Outgoing" connections={outgoing} />
            ) : null}
          </div>
        </DetailSection>
      ) : null}

      {files.length > 0 ? (
        <DetailSection title="Code" count={files.length} collapsible>
          <ul className="flex flex-col">
            {files.map((file) => {
              const shownPath = pathInside(file.path, component.path);
              return (
                <li key={file.path} className="border-b border-line last:border-b-0">
                  {file.symbols.length === 0 ? (
                    <p className="py-1.5 pl-4 font-mono text-xs text-fg-muted wrap-anywhere">
                      {shownPath}
                    </p>
                  ) : (
                    <details>
                      <summary
                        title={file.path}
                        className="cursor-pointer py-1.5 font-mono text-xs text-fg-muted wrap-anywhere marker:text-fg-subtle"
                      >
                        {shownPath}
                        <span className="ml-2 font-sans text-fg-subtle">
                          {file.symbols.length}
                          <span className="sr-only"> definitions</span>
                        </span>
                      </summary>
                      <ul className={`pb-2 pl-4 ${LIST}`}>
                        {file.symbols.map((symbol) => (
                          <li key={symbol.id}>
                            <SymbolLink id={symbol.id} location="line" />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </DetailSection>
      ) : null}

      {flows.length > 0 ? (
        <DetailSection title="Flows it takes part in" count={flows.length}>
          <ul className={LIST}>
            {flows.map((flow) => (
              <li key={flow.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link to={paths.flow(flow.id)} className={`text-sm ${LINK}`}>
                  {flow.title}
                </Link>
                <span className="text-xs text-fg-subtle">{FLOW_CATEGORY_LABEL[flow.category]}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}

      <DocsBackLinks about={{ component: component.id }} />
    </article>
  );
}

interface ConnectionGroupProps {
  title: string;
  connections: ComponentConnection[];
}

function ConnectionGroup({ title, connections }: ConnectionGroupProps) {
  return (
    <div>
      <SubHeading>{title}</SubHeading>
      <ul className="flex flex-col">
        {connections.map((connection) => {
          const { link, other } = connection;
          return (
            <li
              key={connectionKey(connection)}
              className="flex flex-col gap-1 border-b border-line py-2 first:pt-0 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <NodeLink component={other} className="text-sm font-medium" />
                <StatusBadge status={link.status} plannedIn={link.plannedIn} />
              </div>
              <p className={TEXT}>
                <RichText text={link.label} />
              </p>
              <p className="text-xs text-fg-subtle">{LINK_KIND_LABEL[link.kind]}</p>
              {link.evidence && link.evidence.length > 0 ? (
                <FactList>
                  <Fact label="Code that makes this connection">
                    <SymbolLinkList ids={link.evidence} />
                  </Fact>
                </FactList>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
