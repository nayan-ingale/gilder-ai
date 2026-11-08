import { strToU8, zipSync } from 'fflate';

/** A file from a code answer (see the agent's code-files). */
export interface CodeFile {
  name: string;
  language: string;
  content: string;
}

/** All the files as one .zip, for download. */
export function zipFiles(files: readonly CodeFile[]): Blob {
  const entries = Object.fromEntries(files.map((file) => [file.name, strToU8(file.content)]));
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped.slice().buffer], { type: 'application/zip' });
}

/** Saves a Blob as a file through a temporary link. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * What the preview frame shows: the page's index.html with its local CSS and JavaScript files put
 * inline (the frame can't fetch them), plus a policy that blocks every network request, so the
 * page can't load anything from anywhere or send anything out. Null when there is no page.
 */
export function previewDocument(files: readonly CodeFile[]): string | null {
  const page =
    files.find((file) => /(^|\/)index\.html?$/i.test(file.name)) ??
    files.find((file) => /\.html?$/i.test(file.name));
  if (!page) {
    return null;
  }
  const byName = new Map(files.map((file) => [file.name.replace(/^\.\//, ''), file.content]));
  const local = (href: string) => byName.get(href.replace(/^\.\//, ''));

  let html = page.content
    .replace(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi, (tag: string, href: string) => {
      const css = /stylesheet/i.test(tag) ? local(href) : undefined;
      return css === undefined ? '' : `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
    })
    .replace(
      /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
      (_tag: string, before: string, src: string, after: string) => {
        const js = local(src);
        return js === undefined
          ? ''
          : `<script${before}${after}>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
      },
    );

  const policy =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:\">";
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (head) => `${head}${policy}`)
    : `${policy}${html}`;
  return html;
}
