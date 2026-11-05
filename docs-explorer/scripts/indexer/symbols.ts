import { existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type {
  ExternalCall,
  IndexedFile,
  IndexedSymbol,
  SourceIndex,
  SymbolKind,
  SymbolParam,
} from '../../src/data/source-index.ts';
import type { RepoFile } from './files.ts';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/** What every extractor needs to know about the file it's reading. */
interface FileContext {
  repoRoot: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  filePath: string;
}

/**
 * A symbol while the index is being built. A call can point at a file that isn't read yet, so
 * calls are kept as declaration keys ("file:position") and turned into IDs at the end.
 */
interface Draft {
  symbol: IndexedSymbol;
  callKeys: Set<string>;
  externals: Map<string, ExternalCall>;
}

/**
 * Reads the files with the TypeScript compiler, one program per package with that package's own
 * tsconfig (the same way `pnpm typecheck` sees them), and links who calls whom across packages.
 */
export function buildSourceIndex(repoRoot: string, files: RepoFile[]): SourceIndex {
  const drafts: Draft[] = [];
  const idByDeclaration = new Map<string, string>();
  const indexedFiles: IndexedFile[] = [];

  for (const [packageDir, packageFiles] of groupByPackage(repoRoot, files)) {
    const program = createProgram(repoRoot, packageDir, packageFiles);
    const checker = program.getTypeChecker();

    for (const file of packageFiles) {
      const sourceFile = program.getSourceFile(path.join(repoRoot, file.path));
      if (!sourceFile) {
        throw new Error(`TypeScript could not read ${file.path}`);
      }
      const fileDrafts = extractSymbols(
        { repoRoot, program, checker, sourceFile, filePath: file.path },
        idByDeclaration,
      );
      drafts.push(...fileDrafts);
      indexedFiles.push({
        path: file.path,
        app: appOf(file.path),
        language: file.path.endsWith('.tsx') ? 'tsx' : 'ts',
        lineCount: file.content.replace(/\n$/, '').split('\n').length,
        symbols: fileDrafts.map((draft) => draft.symbol),
      });
    }
  }

  linkCalls(drafts, idByDeclaration);
  return { files: indexedFiles.sort((a, b) => a.path.localeCompare(b.path)) };
}

/** Groups files by the nearest folder with a tsconfig.json: backend/shared, frontend and so on. */
function groupByPackage(repoRoot: string, files: RepoFile[]): Map<string, RepoFile[]> {
  const groups = new Map<string, RepoFile[]>();
  for (const file of files) {
    let dir = path.posix.dirname(file.path);
    while (dir !== '.' && !existsSync(path.join(repoRoot, dir, 'tsconfig.json'))) {
      dir = path.posix.dirname(dir);
    }
    if (dir === '.') {
      throw new Error(`${file.path} has no tsconfig.json above it`);
    }
    groups.set(dir, [...(groups.get(dir) ?? []), file]);
  }
  return groups;
}

function createProgram(repoRoot: string, packageDir: string, files: RepoFile[]): ts.Program {
  const configPath = path.join(repoRoot, packageDir, 'tsconfig.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (!parsed) {
    throw new Error(`Could not read ${packageDir}/tsconfig.json`);
  }
  return ts.createProgram({
    rootNames: files.map((file) => path.join(repoRoot, file.path)),
    options: { ...parsed.options, noEmit: true },
  });
}

/** Lists the top-level functions, classes, types and constants of one file. */
function extractSymbols(context: FileContext, idByDeclaration: Map<string, string>): Draft[] {
  const drafts: Draft[] = [];
  const moduleStatements: ts.Statement[] = [];
  const add = (draft: Draft, declaration: ts.Node): void => {
    drafts.push(draft);
    idByDeclaration.set(declarationKey(context.repoRoot, declaration), draft.symbol.id);
  };

  for (const statement of context.sourceFile.statements) {
    const exported = isExported(statement);

    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      add(
        functionDraft(context, statement.name.text, 'function', statement, statement, exported),
        statement,
      );
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const value = declaration.initializer;
        const isFunction = value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value));
        add(
          isFunction
            ? functionDraft(context, declaration.name.text, 'function', value, statement, exported)
            : constDraft(context, declaration, statement, exported),
          declaration,
        );
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const className = statement.name.text;
      add(newDraft(context, className, 'class', statement, exported), statement);
      for (const member of statement.members) {
        if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
          const name = ts.isConstructorDeclaration(member)
            ? 'constructor'
            : member.name.getText(context.sourceFile);
          add(
            functionDraft(context, `${className}.${name}`, 'method', member, member, exported),
            member,
          );
        }
      }
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      const kind = ts.isInterfaceDeclaration(statement) ? 'interface' : 'type';
      add(newDraft(context, statement.name.text, kind, statement, exported), statement);
    } else if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement) &&
      !ts.isModuleDeclaration(statement)
    ) {
      moduleStatements.push(statement);
    }
  }

  // Top-level code outside any function, such as an app's startup in index.ts.
  const [first] = moduleStatements;
  const last = moduleStatements.at(-1);
  if (first && last) {
    const draft = newDraft(context, '(module)', 'module', first, false);
    draft.symbol.doc = undefined;
    draft.symbol.endLine = lineOf(context.sourceFile, last.getEnd());
    for (const statement of moduleStatements) {
      scanCalls(context, statement, draft);
    }
    drafts.push(draft);
  }
  return drafts;
}

/** A symbol with its name, place in the file and comment, but no calls yet. */
function newDraft(
  context: FileContext,
  name: string,
  kind: SymbolKind,
  node: ts.Node,
  exported: boolean,
): Draft {
  const { sourceFile } = context;
  return {
    symbol: {
      id: `${context.filePath}#${name}`,
      name,
      kind,
      exported,
      doc: leadingComment(node, sourceFile),
      startLine: lineOf(sourceFile, node.getStart(sourceFile)),
      endLine: lineOf(sourceFile, node.getEnd()),
      calls: [],
      calledBy: [],
      externalCalls: [],
      routes: [],
    },
    callKeys: new Set(),
    externals: new Map(),
  };
}

/** A function or method: its signature, parameters, return type and everything its body calls. */
function functionDraft(
  context: FileContext,
  name: string,
  kind: SymbolKind,
  fn: ts.SignatureDeclaration,
  rangeNode: ts.Node,
  exported: boolean,
): Draft {
  const { checker, sourceFile } = context;
  const draft = newDraft(context, name, kind, rangeNode, exported);
  const params = fn.parameters.map((param) => paramOf(context, param));

  let returnType: string | undefined;
  if (!ts.isConstructorDeclaration(fn)) {
    const signature = checker.getSignatureFromDeclaration(fn);
    returnType = fn.type
      ? oneLine(fn.type.getText(sourceFile))
      : signature && checker.typeToString(checker.getReturnTypeOfSignature(signature), fn);
  }

  draft.symbol.params = params;
  draft.symbol.returnType = returnType;
  draft.symbol.signature = formatSignature(name, params, returnType);
  if ('body' in fn && fn.body) {
    scanCalls(context, fn.body, draft);
  }
  return draft;
}

/** A constant: its type, and the calls made to compute its value. */
function constDraft(
  context: FileContext,
  declaration: ts.VariableDeclaration,
  statement: ts.VariableStatement,
  exported: boolean,
): Draft {
  const { checker, sourceFile } = context;
  const draft = newDraft(
    context,
    declaration.name.getText(sourceFile),
    'const',
    statement,
    exported,
  );
  draft.symbol.valueType = oneLine(
    declaration.type?.getText(sourceFile) ??
      checker.typeToString(checker.getTypeAtLocation(declaration.name), declaration),
  );
  if (declaration.initializer) {
    scanCalls(context, declaration.initializer, draft);
  }
  return draft;
}

function paramOf(context: FileContext, param: ts.ParameterDeclaration): SymbolParam {
  const { checker, sourceFile } = context;
  const result: SymbolParam = {
    name: `${param.dotDotDotToken ? '...' : ''}${oneLine(param.name.getText(sourceFile))}`,
    type: oneLine(
      param.type?.getText(sourceFile) ??
        checker.typeToString(checker.getTypeAtLocation(param), param),
    ),
    optional: Boolean(param.questionToken ?? param.initializer),
  };
  if (param.initializer) {
    result.defaultValue = oneLine(param.initializer.getText(sourceFile));
  }
  return result;
}

/** Walks a piece of code and records every function it calls and every route it registers. */
function scanCalls(context: FileContext, root: ts.Node, draft: Draft): void {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const target = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name
        : node.expression;
      recordReference(context, target, draft, true);
      if (ts.isCallExpression(node)) {
        recordRoute(context, node, draft);
      }
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      // <Sidebar /> renders a project component: count it like a call. HTML tags are skipped.
      recordReference(context, node.tagName, draft, false);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
}

/** Finds where a called name is declared: in this project (a call) or in an npm package. */
function recordReference(
  context: FileContext,
  target: ts.Node,
  draft: Draft,
  keepExternal: boolean,
): void {
  if (!ts.isIdentifier(target)) {
    return;
  }
  let symbol = context.checker.getSymbolAtLocation(target);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    symbol = context.checker.getAliasedSymbol(symbol);
  }
  const declaration = symbol?.declarations?.[0];
  if (!declaration) {
    return;
  }
  const declarationFile = declaration.getSourceFile();
  if (context.program.isSourceFileDefaultLibrary(declarationFile)) {
    return; // JavaScript built-ins such as Promise.all or JSON.stringify
  }
  const packageName = packageOf(declarationFile.fileName);
  if (packageName) {
    if (keepExternal) {
      draft.externals.set(`${packageName}:${target.text}`, {
        package: packageName,
        name: target.text,
      });
    }
    return;
  }
  draft.callKeys.add(declarationKey(context.repoRoot, declaration));
}

function recordRoute(context: FileContext, call: ts.CallExpression, draft: Draft): void {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return;
  }
  const method = call.expression.name.text;
  const [routePath] = call.arguments;
  if (
    HTTP_METHODS.has(method) &&
    routePath &&
    ts.isStringLiteralLike(routePath) &&
    routePath.text.startsWith('/')
  ) {
    draft.symbol.routes.push({
      method: method.toUpperCase(),
      path: routePath.text,
      line: lineOf(context.sourceFile, call.getStart(context.sourceFile)),
    });
  }
}

/** Turns call keys into symbol IDs, then fills in `calledBy` from the other direction. */
function linkCalls(drafts: Draft[], idByDeclaration: Map<string, string>): void {
  const symbolsById = new Map(drafts.map((draft) => [draft.symbol.id, draft.symbol]));
  for (const { symbol, callKeys, externals } of drafts) {
    const ids = [...callKeys]
      .map((key) => idByDeclaration.get(key))
      .filter((id): id is string => id !== undefined && id !== symbol.id);
    symbol.calls = [...new Set(ids)].sort();
    symbol.externalCalls = [...externals.values()].sort(
      (a, b) => a.package.localeCompare(b.package) || a.name.localeCompare(b.name),
    );
  }
  for (const symbol of symbolsById.values()) {
    for (const id of symbol.calls) {
      symbolsById.get(id)?.calledBy.push(symbol.id);
    }
  }
  for (const symbol of symbolsById.values()) {
    symbol.calledBy.sort();
  }
}

/** Where a declaration lives, the same whichever package's program found it. */
function declarationKey(repoRoot: string, node: ts.Node): string {
  const filePath = path.relative(repoRoot, node.getSourceFile().fileName).split(path.sep).join('/');
  return `${filePath}:${node.getStart()}`;
}

/** The npm package a declaration file belongs to (`@types/express` counts as `express`). */
/**
 * Packages whose types live in a separate types-only package. A call is credited to the package
 * the code installs and imports: Express declares router.get and res.json in
 * @types/express-serve-static-core, but they are Express calls.
 */
const TYPES_ONLY_PACKAGES: Record<string, string> = { 'express-serve-static-core': 'express' };

function packageOf(fileName: string): string | undefined {
  const marker = '/node_modules/';
  const at = fileName.lastIndexOf(marker);
  if (at === -1) {
    return undefined;
  }
  const [scopeOrName, name] = fileName.slice(at + marker.length).split('/');
  const packageName = scopeOrName?.startsWith('@') ? `${scopeOrName}/${name}` : scopeOrName;
  const plainName = packageName?.replace(/^@types\//, '');
  return plainName && (TYPES_ONLY_PACKAGES[plainName] ?? plainName);
}

/** frontend/… → frontend, backend/shared/… → shared, backend/services/auth/… → auth. */
function appOf(filePath: string): string {
  const [top, second, third] = filePath.split('/');
  if (top === 'frontend') {
    return 'frontend';
  }
  return (second === 'services' ? third : second) ?? 'unknown';
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

/** The comment right above a declaration, without comment markers or lint directives. */
function leadingComment(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
  const text = ranges
    .map((range) =>
      sourceFile.text
        .slice(range.pos, range.end)
        .replace(/^\/\*\*?|\*\/$/g, '')
        .split('\n')
        .map((line) => line.replace(/^\s*(\*|\/\/)\s?/, '').trimEnd())
        .join('\n')
        .trim(),
    )
    .filter((comment) => !/^(eslint-|@ts-|prettier-ignore)/.test(comment))
    .join('\n')
    .trim();
  return text || undefined;
}

function formatSignature(name: string, params: SymbolParam[], returnType?: string): string {
  const list = params
    .map((param) => {
      const marker = param.optional && !param.defaultValue ? '?' : '';
      const fallback = param.defaultValue ? ` = ${param.defaultValue}` : '';
      return `${param.name}${marker}: ${param.type}${fallback}`;
    })
    .join(', ');
  return `${name}(${list})${returnType ? `: ${returnType}` : ''}`;
}

function lineOf(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

/** Collapses code written over several lines into one, e.g. a destructured parameter. */
function oneLine(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/,\s*([}\])])/g, ' $1')
    .trim();
}
