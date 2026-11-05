import { useCallback, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { ComponentDetails } from '../details/ComponentDetails.tsx';
import { SymbolDetails } from '../details/SymbolDetails.tsx';
import { ArchitectureGraph } from '../graph/ArchitectureGraph.tsx';
import { useSelection } from '../hooks/use-selection.ts';
import { symbolName } from '../layout/breadcrumbs.ts';
import { Workspace } from '../layout/Workspace.tsx';
import { architectureView, getArchView } from '../model/architecture-views.ts';
import { docs } from '../model/index.ts';
import { plural } from '../ui/plural.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

// One view of the system map (/architecture/:viewId): the graph of its components and links,
// and the details of the selected component, or of a symbol opened from it.

export function ArchitecturePage() {
  const { viewId } = useParams();
  const view = viewId === undefined ? undefined : getArchView(viewId);
  const { node, symbol, select } = useSelection();

  const data = useMemo(
    () => (view ? architectureView(view.id, docs.components, docs.links) : undefined),
    [view],
  );
  const onSelect = useCallback((id: string | undefined) => select({ node: id }), [select]);
  const onClosePanel = useCallback(() => select({ node: undefined, symbol: undefined }), [select]);

  if (!view || !data) return <NotFoundPage />;

  let panel: ReactNode;
  let panelLabel: string | undefined;
  if (symbol) {
    panel = <SymbolDetails symbolId={symbol} />;
    panelLabel = symbolName(symbol);
  } else if (node) {
    panel = <ComponentDetails componentId={node} />;
    panelLabel = docs.getComponent(node)?.name ?? node;
  }

  const contextCount = data.contextIds.size;
  const meta = (
    <span>
      {plural(data.components.length - contextCount, 'component')}
      {contextCount > 0 ? `, plus ${contextCount} they connect to` : ''}
      {' · '}
      {plural(data.links.length, 'connection')}
    </span>
  );

  return (
    <>
      <title>{`${view.title} · GilderAi Docs`}</title>
      <Workspace
        title={view.title}
        summary={view.summary}
        meta={meta}
        panel={panel}
        panelLabel={panelLabel}
        // Names repeat (many files have an `env`), so the selection ids say what is open.
        panelKey={symbol ?? node}
        onClosePanel={onClosePanel}
      >
        <ArchitectureGraph
          components={data.components}
          links={data.links}
          contextIds={data.contextIds}
          selectedId={node}
          onSelect={onSelect}
        />
      </Workspace>
    </>
  );
}
