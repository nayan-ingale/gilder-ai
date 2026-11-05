// A link to a part of the system (an architecture node). On an architecture view that shows the
// part, it selects it there. Anywhere else it opens the part on System Architecture, and the link
// says so, so the reader isn't surprised by the page changing.
import { Link, useParams } from 'react-router';
import type { ArchComponent } from '../data/schema.ts';
import { useSelection } from '../hooks/use-selection.ts';
import { getArchView } from '../model/architecture-views.ts';
import { paths } from '../routes.ts';
import { LINK } from './classes.ts';
import { nodeTarget } from './node-target.ts';

interface NodeLinkProps {
  component: ArchComponent;
  /** Size and weight of the name. */
  className?: string;
}

export function NodeLink({ component, className = 'text-sm' }: NodeLinkProps) {
  const { viewId } = useParams();
  const { searchWith } = useSelection();
  const target = nodeTarget(component.id, viewId);

  if (target.inPlace) {
    return (
      <Link to={{ search: searchWith({ node: component.id }) }} className={`${className} ${LINK}`}>
        {component.name}
      </Link>
    );
  }

  const viewTitle = getArchView(target.viewId)?.title;
  return (
    <Link to={paths.architecture(target.viewId, component.id)} className={`${className} ${LINK}`}>
      {component.name}
      {viewTitle ? (
        <>
          {' '}
          {/* inline-block keeps the hover underline off the hint. */}
          <span className="inline-block text-xs font-normal text-fg-subtle">(in {viewTitle})</span>
        </>
      ) : null}
    </Link>
  );
}
