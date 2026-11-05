// Where a link to a part of the system (an architecture node) should go from the page that is
// open. A part shown on the open architecture view is only selected there; anything else opens
// on System Architecture, the one view that shows every part.
import { architectureView, getArchView, type ArchViewId } from '../model/architecture-views.ts';
import { docs } from '../model/index.ts';

export interface NodeTarget {
  /** The architecture view the link opens. */
  viewId: ArchViewId;
  /** The part is on the view already open, so the link only changes the selection. */
  inPlace: boolean;
}

// The parts each view shows. The docs never change while the page is open, so each view is
// worked out once.
const shownByView = new Map<ArchViewId, Set<string>>();

function shownIn(viewId: ArchViewId): Set<string> {
  let shown = shownByView.get(viewId);
  if (!shown) {
    const view = architectureView(viewId, docs.components, docs.links);
    shown = new Set(view.components.map((component) => component.id));
    shownByView.set(viewId, shown);
  }
  return shown;
}

/** `openViewId` is the `:viewId` of the URL: the architecture view on screen, if any. */
export function nodeTarget(componentId: string, openViewId: string | undefined): NodeTarget {
  const open = openViewId === undefined ? undefined : getArchView(openViewId);
  return open && shownIn(open.id).has(componentId)
    ? { viewId: open.id, inPlace: true }
    : { viewId: 'system', inPlace: false };
}
