'use client';

import { Check, Copy } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { highlightCode } from '@/lib/highlight';

/**
 * Renders a model's answer as Markdown, safely:
 * - raw HTML in the text is shown as text, never run (react-markdown's default);
 * - javascript: and other unsafe links are removed (its default URL check);
 * - an image the model wrote becomes a plain link, so an answer can't load a tracking pixel or
 *   an image from anywhere it likes;
 * - links open in a new tab without access to this page.
 */

function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const code = children as { props?: { className?: string; children?: unknown } } | undefined;
  const language = /language-([\w+-]+)/.exec(code?.props?.className ?? '')?.[1];
  const text = typeof code?.props?.children === 'string' ? code.props.children : undefined;
  const highlighted = text === undefined ? null : highlightCode(text.replace(/\n$/, ''), language);

  async function copy() {
    await navigator.clipboard.writeText(ref.current?.innerText ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <div className="my-3 overflow-hidden rounded-md border border-line bg-sunken">
      <div className="flex items-center justify-between border-b border-line px-3 py-1 text-xs text-fg-subtle">
        <span>{language ?? 'code'}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-surface hover:text-fg"
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref} className="hljs overflow-x-auto p-3 text-[13px] leading-relaxed">
        {highlighted === null ? (
          children
        ) : (
          // highlight.js escapes the code; its output only adds colour spans.
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
      </pre>
    </div>
  );
}

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
  // A model-written image is shown as a link to it, never loaded (SEC-10).
  img: ({ src, alt }) =>
    typeof src === 'string' && /^https?:\/\//i.test(src) ? (
      <a href={src} target="_blank" rel="noopener noreferrer nofollow">
        {alt?.trim() ? `Image: ${alt}` : 'Image link'}
      </a>
    ) : (
      <span>{alt ?? ''}</span>
    ),
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
