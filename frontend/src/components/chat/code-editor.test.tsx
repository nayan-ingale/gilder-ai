// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// jsdom can't run Monaco, so a stand-in records what the panel asks it for.
const monaco = vi.hoisted(() => {
  const defineTheme = vi.fn();
  const setTheme = vi.fn();
  return {
    // A plain list, so the run's mock clearing doesn't wipe the call made on import.
    configured: [] as unknown[],
    props: [] as Record<string, unknown>[],
    defineTheme,
    setTheme,
    instance: { editor: { defineTheme, setTheme } },
  };
});
vi.mock('@monaco-editor/react', async () => {
  const { useEffect } = await import('react');
  return {
    loader: { config: (value: unknown) => monaco.configured.push(value) },
    // Like the real editor, it calls beforeMount once, when Monaco has loaded.
    default: function StandIn(props: Record<string, unknown>) {
      monaco.props.push(props);
      useEffect(() => {
        (props.beforeMount as (instance: unknown) => void)(monaco.instance);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <pre data-testid="monaco">{String(props.value)}</pre>;
    },
  };
});

const { CodeEditor, monacoLanguage } = await import('./code-editor');

afterEach(() => {
  cleanup();
  monaco.props.length = 0;
  monaco.defineTheme.mockClear();
  monaco.setTheme.mockClear();
  delete document.documentElement.dataset.theme;
});

describe('CodeEditor', () => {
  it('loads Monaco from this app, never from a CDN', () => {
    expect(monaco.configured).toEqual([{ paths: { vs: '/monaco/vs' } }]);
  });

  it('shows the file read-only, with line numbers and no minimap, named for screen readers', () => {
    render(<CodeEditor code="const a = 1;" language="ts" fileName="app.ts" fallback={null} />);

    expect(screen.getByTestId('monaco').textContent).toBe('const a = 1;');
    const props = monaco.props.at(-1);
    expect(props?.language).toBe('typescript');
    expect(props?.options).toMatchObject({
      readOnly: true,
      domReadOnly: true,
      lineNumbers: 'on',
      minimap: { enabled: false },
      ariaLabel: 'app.ts',
    });
  });

  it("uses the app's theme, and switches when the page does", () => {
    document.documentElement.dataset.theme = 'dark';
    render(<CodeEditor code="x" language="js" fileName="x.js" fallback={null} />);

    expect(monaco.props.at(-1)?.theme).toBe('gilder-dark');
    expect(monaco.defineTheme).toHaveBeenCalledWith(
      'gilder-dark',
      expect.objectContaining({ base: 'vs-dark' }),
    );

    act(() => {
      document.documentElement.dataset.theme = 'light';
    });

    return vi.waitFor(() => {
      expect(monaco.setTheme).toHaveBeenLastCalledWith('gilder-light');
      expect(monaco.props.at(-1)?.theme).toBe('gilder-light');
    });
  });
});

describe('monacoLanguage', () => {
  it.each([
    ['javascript', 'a.js', 'javascript'],
    ['jsx', 'a.jsx', 'javascript'],
    ['py', 'a.py', 'python'],
    ['bash', 'run.sh', 'shell'],
    ['', 'styles.css', 'css'],
    ['text', 'notes.md', 'markdown'],
    ['', 'Makefile', 'plaintext'],
  ])('maps %s (%s) to %s', (language, fileName, expected) => {
    expect(monacoLanguage(language, fileName)).toBe(expected);
  });
});
