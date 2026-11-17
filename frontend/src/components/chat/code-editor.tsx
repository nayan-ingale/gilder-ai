'use client';

import Editor, { type EditorProps, loader, type Monaco } from '@monaco-editor/react';
import { type ReactNode, useRef } from 'react';

// Monaco is served by this app from public/monaco (copied there by scripts/copy-monaco.mjs before
// dev and build), never from a CDN: the security policy allows scripts only from this app.
loader.config({ paths: { vs: '/monaco/vs' } });

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  md: 'markdown',
  htm: 'html',
};

/** Monaco's name for a file's language: the one the answer gave, else the file's extension. */
export function monacoLanguage(language: string, fileName: string): string {
  const given = language.trim().toLowerCase();
  if (given && given !== 'text' && given !== 'plaintext') {
    return LANGUAGE_ALIASES[given] ?? given;
  }
  const extension = fileName.includes('.') ? (fileName.split('.').pop()?.toLowerCase() ?? '') : '';
  return LANGUAGE_ALIASES[extension] ?? (extension || 'plaintext');
}

/** The name of the Monaco theme for the code area. */
export const CODE_THEME = 'gilder-code';

/**
 * Defines the Monaco theme for the code area, which is dark in both page themes. The colours are
 * read from the CSS variables of `scope` (an element inside .code-dark); only hex values are
 * passed, since Monaco accepts nothing else.
 */
export function defineCodeTheme(monaco: Monaco, scope: Element = document.documentElement): string {
  const css = getComputedStyle(scope);
  const colors: Record<string, string> = {};
  for (const [key, variable] of [
    ['editor.background', '--code-bg'],
    ['editorGutter.background', '--code-bg'],
    ['editor.foreground', '--code-text'],
    ['editorLineNumber.foreground', '--text-subtle'],
  ] as const) {
    const value = css.getPropertyValue(variable).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(value)) {
      colors[key] = value;
    }
  }
  monaco.editor.defineTheme(CODE_THEME, { base: 'vs-dark', inherit: true, rules: [], colors });
  return CODE_THEME;
}

const EDITOR_OPTIONS: EditorProps['options'] = {
  readOnly: true,
  domReadOnly: true,
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on',
  folding: true,
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  renderLineHighlight: 'none',
  padding: { top: 12, bottom: 12 },
};

/**
 * A file in the read-only Monaco editor (line numbers, folding, find), on the dark code colours.
 * `fallback` shows while Monaco loads, so the panel is never empty.
 */
export function CodeEditor({
  code,
  language,
  fileName,
  fallback,
}: {
  code: string;
  language: string;
  fileName: string;
  fallback: ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);

  return (
    <div ref={scope} className="code-dark min-h-0 flex-1 bg-code">
      <Editor
        height="100%"
        value={code}
        language={monacoLanguage(language, fileName)}
        theme={CODE_THEME}
        loading={fallback}
        beforeMount={(instance) => {
          defineCodeTheme(instance, scope.current ?? document.documentElement);
        }}
        options={{ ...EDITOR_OPTIONS, ariaLabel: fileName }}
      />
    </div>
  );
}
