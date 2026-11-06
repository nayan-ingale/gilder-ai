import { useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { buildCodeTree } from '../code-explorer/code-tree.ts';
import { CodeTree } from '../code-explorer/CodeTree.tsx';
import { FileDetails } from '../code-explorer/FileDetails.tsx';
import { SymbolDetails } from '../details/SymbolDetails.tsx';
import { useSelection } from '../hooks/use-selection.ts';
import { symbolName } from '../layout/breadcrumbs.ts';
import { Workspace } from '../layout/Workspace.tsx';
import { docs } from '../model/index.ts';
import { plural } from '../ui/plural.ts';

// The code explorer (/code): every indexed file and symbol in a tree that can be filtered, and
// the details of the selected file (?file=) or symbol (?symbol=) with its real code.

// The docs never change while the page is open, so the tree is built once.
const TREE = buildCodeTree();

const SUMMARY =
  'Every file in the code index, grouped by app, with the functions, types and constants ' +
  'inside it. Filter by path, name, kind, route or signature, then open a file or a symbol to ' +
  'read its details and its code.';

export function CodePage() {
  const { file, symbol, searchWith, select } = useSelection();
  const navigate = useNavigate();

  // A symbol always belongs to one file, so its file is the open one, whatever ?file= says.
  const symbolFile = symbol === undefined ? undefined : docs.getSymbol(symbol)?.file.path;
  const activeFile = symbolFile ?? file;

  // Links in the panel (calls, called by) change only ?symbol=. The URL is then brought in line,
  // replacing the entry so Back still goes to the previous symbol, and closing the symbol shows
  // its own file.
  useEffect(() => {
    if (symbolFile !== undefined && symbolFile !== file) {
      void navigate({ search: searchWith({ file: symbolFile }) }, { replace: true });
    }
  }, [symbolFile, file, navigate, searchWith]);

  const onClosePanel = useCallback(() => select({ file: undefined, symbol: undefined }), [select]);

  let panel: ReactNode;
  let panelLabel: string | undefined;
  if (symbol) {
    panel = <SymbolDetails symbolId={symbol} />;
    panelLabel = symbolName(symbol);
  } else if (file) {
    panel = <FileDetails path={file} />;
    panelLabel = file;
  }

  const meta = (
    <span>
      {plural(TREE.fileCount, 'file')} · {plural(TREE.symbolCount, 'symbol')}
    </span>
  );

  return (
    <>
      <title>Code Explorer · GilderAi Docs</title>
      <Workspace
        title="Code Explorer"
        summary={SUMMARY}
        meta={meta}
        panel={panel}
        panelLabel={panelLabel}
        // Symbol IDs hold a `#`, so they never equal a file path.
        panelKey={symbol ?? file}
        onClosePanel={onClosePanel}
      >
        <CodeTree tree={TREE} activeFile={activeFile} activeSymbol={symbol} />
      </Workspace>
    </>
  );
}
