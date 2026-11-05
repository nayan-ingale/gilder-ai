// Flow steps that run some piece of code, grouped under their flow. Each step links to its flow
// page with that step selected.
import { Link } from 'react-router';
import { paths } from '../routes.ts';
import { LINK } from './classes.ts';
import type { FlowUsageGroup } from './format.ts';

interface FlowUsageListProps {
  groups: FlowUsageGroup[];
}

export function FlowUsageList({ groups }: FlowUsageListProps) {
  return (
    <ul className="flex flex-col gap-2.5">
      {groups.map(({ flow, steps }) => (
        <li key={flow.id}>
          <span className="text-xs text-fg-subtle">{flow.title}</span>
          <ul className="mt-1 flex flex-col gap-1 border-l border-line pl-3">
            {steps.map((step) => (
              <li key={step.id}>
                <Link to={paths.flow(flow.id, step.id)} className={`text-sm ${LINK}`}>
                  {step.title}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
