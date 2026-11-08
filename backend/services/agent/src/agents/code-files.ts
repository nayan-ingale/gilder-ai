import { z } from '@gilder/shared';

/**
 * The files a code answer contains. The model writes them as Markdown, so the user sees the code
 * as it streams: a heading with the file's path, then a fenced block. Afterwards they are parsed
 * and checked here before they become a downloadable artifact.
 */

export const MAX_FILES = 10;
export const MAX_FILE_CHARS = 200_000;

// Relative paths of plain names: no "..", no leading slash, no drive letters or odd characters.
const filePath = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/,
    'is not a safe file path',
  )
  .refine((path) => !path.split('/').includes('..'), 'is not a safe file path');

export const codeFileSchema = z.object({
  name: filePath,
  language: z.string().max(40),
  content: z.string().max(MAX_FILE_CHARS),
});
export type CodeFile = z.output<typeof codeFileSchema>;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  py: 'python',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  go: 'go',
  rs: 'rust',
  java: 'java',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  kt: 'kotlin',
  swift: 'swift',
};

function languageOf(name: string, fenceLanguage: string | undefined): string {
  if (fenceLanguage) {
    return fenceLanguage.toLowerCase();
  }
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXTENSION[extension] ?? 'text';
}

/**
 * Finds every "heading with a path, then a fenced block" pair. Files that fail the checks are
 * skipped, and a later file with the same name replaces an earlier one.
 */
export function parseCodeFiles(markdown: string): CodeFile[] {
  const pattern = /^#{2,4}\s+`?([^\s`]+?)`?\s*\n+```([\w+#-]*)[^\n]*\n([\s\S]*?)\n```/gm;
  const files = new Map<string, CodeFile>();
  for (const match of markdown.matchAll(pattern)) {
    const [, name = '', fence, content = ''] = match;
    const parsed = codeFileSchema.safeParse({ name, language: languageOf(name, fence), content });
    if (parsed.success) {
      files.set(parsed.data.name, parsed.data);
    }
  }
  return [...files.values()].slice(0, MAX_FILES);
}
