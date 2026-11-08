/**
 * Splits a PDF's text into overlapping pieces, page by page, so every piece knows its page (for
 * [p. N] citations) and a sentence cut at one piece's end is whole in the next.
 */

export interface Chunk {
  page: number;
  text: string;
}

export const CHUNK_CHARS = 1_000;
export const CHUNK_OVERLAP = 200;

export function chunkPages(
  pages: readonly string[],
  size = CHUNK_CHARS,
  overlap = CHUNK_OVERLAP,
): Chunk[] {
  const chunks: Chunk[] = [];
  pages.forEach((raw, index) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + size, text.length);
      // End on a word boundary when one is close, so words aren't cut in half.
      if (end < text.length) {
        const space = text.lastIndexOf(' ', end);
        if (space > start + size / 2) {
          end = space;
        }
      }
      chunks.push({ page: index + 1, text: text.slice(start, end).trim() });
      if (end >= text.length) {
        break;
      }
      start = Math.max(end - overlap, start + 1);
    }
  });
  return chunks.filter((chunk) => chunk.text.length > 0);
}
