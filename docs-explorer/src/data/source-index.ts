/**
 * The shape of the generated source index in src/data/generated/, written by
 * scripts/index-source.ts. It describes the real code: files, the functions and types inside
 * them, and which function calls which.
 */

export type SymbolKind =
  'function' | 'class' | 'method' | 'interface' | 'type' | 'const' | 'module';

export interface SymbolParam {
  name: string;
  /** As written in the code, or as TypeScript infers it when no type is written. */
  type: string;
  optional: boolean;
  defaultValue?: string;
}

/** An HTTP route registered in the code, found from calls like `router.get('/healthz', ...)`. */
export interface DetectedRoute {
  method: string;
  path: string;
  line: number;
}

/** A call into an npm package or a Node built-in, such as `json` from `express`. */
export interface ExternalCall {
  package: string;
  name: string;
}

export interface IndexedSymbol {
  /** Stable reference used by the hand-written docs: `<file path>#<name>`. */
  id: string;
  name: string;
  /** `module` is the code at the top level of a file, outside any function (an app's startup). */
  kind: SymbolKind;
  exported: boolean;
  /** Functions and methods only, e.g. `withTimeout(promise: Promise<T>, ms: number): Promise<T>`. */
  signature?: string;
  params?: SymbolParam[];
  returnType?: string;
  /** Constants only: their type as TypeScript sees it. */
  valueType?: string;
  /** The comment written right above it in the code. */
  doc?: string;
  startLine: number;
  endLine: number;
  /** IDs of project symbols it calls (or renders, for React components). */
  calls: string[];
  /** IDs of project symbols that call it. */
  calledBy: string[];
  externalCalls: ExternalCall[];
  routes: DetectedRoute[];
}

export interface IndexedFile {
  path: string;
  /** Which app the file belongs to: frontend, gateway, shared, auth, chat, agent or billing. */
  app: string;
  language: 'ts' | 'tsx';
  lineCount: number;
  symbols: IndexedSymbol[];
}

export interface SourceIndex {
  files: IndexedFile[];
}

/** One app's use of an npm package, as its package.json lists it. */
export interface PackageUse {
  /** The app, named as for files (frontend, gateway, auth...); `root` is the repo's own tooling. */
  app: string;
  /** The version range as written, e.g. `^5.3.0`. */
  version: string;
  /** Listed under devDependencies: used to build or test, not at run time. */
  dev: boolean;
}

export interface IndexedPackage {
  name: string;
  usedBy: PackageUse[];
}

/** Every npm package the apps list, in generated/packages.json. The project's own packages are left out. */
export interface PackageIndex {
  packages: IndexedPackage[];
}

/** One file's code, stored separately so the explorer loads it only when it's opened. */
export interface SourceFileContent {
  path: string;
  code: string;
}

/** Name of a file's code in generated/sources/, e.g. `backend__shared__src__errors.ts.json`. */
export function sourceFileName(filePath: string): string {
  return `${filePath.replaceAll('/', '__')}.json`;
}
