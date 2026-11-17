/** Where this browser remembers that the sidebar is collapsed. */
export const SIDEBAR_KEY = 'gilder_sidebar';

/**
 * The script in <head> that collapses the sidebar before the first paint when it was left
 * collapsed, so it never opens and then jumps shut. Storage can be blocked, so it may do nothing.
 */
export const SIDEBAR_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_KEY}')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`;
