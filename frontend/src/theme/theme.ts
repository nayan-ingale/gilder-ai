import { THEME_COOKIE } from './theme-names';

/**
 * Theme: light, dark, or follow the system (the default). The choice lives in a cookie, so the
 * very first paint already has the right theme. A tiny script in <head> reads it and sets
 * <html data-theme> before the page shows; with no choice, the CSS follows the system setting.
 *
 * A script, not a server-side cookie read: reading cookies in the root layout would stop every
 * page from being prerendered.
 */

/** Runs before the first paint. Only 'light' or 'dark' are applied; anything else is ignored. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m){document.documentElement.dataset.theme=m[1];}}catch(e){}})();`;
