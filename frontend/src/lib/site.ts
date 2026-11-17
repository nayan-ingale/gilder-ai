/** The public address of the site, for links in metadata, the sitemap and robots.txt. */
export const SITE_URL = (process.env.SITE_URL ?? 'https://gilderai.in').replace(/\/$/, '');

export const SITE_NAME = 'GilderAi';

/** One sentence on what the app does, for search results and link previews. */
export const SITE_DESCRIPTION =
  'One AI workspace for chat, web search with sources, code with a live preview, PDFs, slides and images, and answers from your own documents.';
