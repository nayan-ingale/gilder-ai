import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { mainArea } from '../layout/main-area.ts';
import { SELECT } from '../routes.ts';
import { sectionElementId } from './guide-links.ts';

/** How long a section opened from a link stays marked. */
export const MARK_MS = 1600;

/**
 * Brings the docs section named by `?section=` into view, moves focus to it (as following an
 * anchor would) and marks it for a moment. Runs on every visit, so following the same link
 * twice shows the section again. A visit with no section, such as the sidebar's link to the
 * open page, starts at the top. Returns the id of the section to mark, if any.
 */
export function useSectionTarget(): string | undefined {
  const [params] = useSearchParams();
  const { key } = useLocation();
  const target = params.get(SELECT.section) ?? undefined;
  const [marked, setMarked] = useState<{ id: string; key: string }>();
  // The visit this page last handled, so the first render isn't taken for a new visit.
  const handledKey = useRef(key);

  useEffect(() => {
    const newVisit = handledKey.current !== key;
    handledKey.current = key;
    if (target === undefined) {
      // Only the query changed, so AppShell (which resets a new path) leaves the scroll as it
      // was. The first render needs nothing: AppShell has just reset the new page.
      const main = mainArea();
      if (newVisit && main) main.scrollTop = 0;
      return;
    }
    let timer: number | undefined;
    // After this render's effects: on a new page the frame scrolls back to the top and focuses
    // the page first (AppShell), and this has to come after that.
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(sectionElementId(target));
      if (!element) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      element.focus({ preventScroll: true });
      setMarked({ id: target, key });
      // Started with the mark, not before the frame: a background tab holds frames back, and a
      // timer started earlier would fire first and leave the mark on for good.
      timer = window.setTimeout(() => setMarked(undefined), MARK_MS);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [target, key]);

  return marked?.key === key ? marked.id : undefined;
}
