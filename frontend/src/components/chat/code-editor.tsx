'use client';

import Editor, { type EditorProps, loader, type Monaco } from '@monaco-editor/react';
import { type ReactNode, useEffect, useState } from 'react';

// Monaco is served by this app from public/monaco (copied there by scripts/copy-monaco.mjs before
// dev and build), never from a CDN: the security policy allows scripts only from this app.
loader.config({ paths: { vs: '/monaco/vs' } });

type PageTheme = 'light' | 'dark';

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

/** The theme the page shows: the user's pick on <html data-theme>, otherwise the system's. */
function pageTheme(): PageTheme {
  const picked = document.documentElement.dataset.theme;
  if (picked === 'light' || picked === 'dark') {
    return picked;
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** The page's theme, kept up to date when the user or the system switches it. */
function usePageTheme(): PageTheme {
  const [theme, setTheme] = useState<PageTheme>(() =>
    typeof document === 'undefined' ? 'light' : pageTheme(),
  );
  useEffect(() => {
    const update = () => setTheme(pageTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media =
      typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    media?.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', update);
    };
  }, []);
  return theme;
}

/**
 * Defines a Monaco theme in the app's colours, read from the page's CSS variables for the theme
 * showing now, and returns its name. Only hex values are passed, since Monaco accepts nothing else.
 */
export function defineAppTheme(monaco: Monaco, theme: PageTheme): string {
  const css = getComputedStyle(document.documentElement);
  const colors: Record<string, string> = {};
  for (const [key, variable] of [
    ['editor.background', '--sunken'],
    ['editorGutter.background', '--sunken'],
    ['editor.foreground', '--text'],
    ['editorLineNumber.foreground', '--text-subtle'],
  ] as const) {
    const value = css.getPropertyValue(variable).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(value)) {
      colors[key] = value;
    }
  }
  const name = `gilder-${theme}`;
  monaco.editor.defineTheme(name, {
    base: theme === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors,
  });
  return name;
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
 * A file in the read-only Monaco editor (line numbers, folding, find), in the app's theme.
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
  const theme = usePageTheme();
  const [monaco, setMonaco] = useState<Monaco | null>(null);

  // A theme switch while the panel is open: define the new colours, then apply them.
  useEffect(() => {
    if (monaco) {
      monaco.editor.setTheme(defineAppTheme(monaco, theme));
    }
  }, [monaco, theme]);

  return (
    <div className="min-h-0 flex-1">
      <Editor
        height="100%"
        value={code}
        language={monacoLanguage(language, fileName)}
        theme={`gilder-${theme}`}
        loading={fallback}
        beforeMount={(instance) => {
          defineAppTheme(instance, theme);
          setMonaco(instance);
        }}
        options={{ ...EDITOR_OPTIONS, ariaLabel: fileName }}
      />
    </div>
  );
}
