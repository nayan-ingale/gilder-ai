import { Link } from 'react-router';
import { paths } from '../routes.ts';
import { EmptyState } from '../ui/EmptyState.tsx';

// Sections the sidebar lists before the code has anything for them. Each one says plainly that
// nothing exists yet, so the explorer never shows made-up content.

type PlaceholderKind = 'agents' | 'jobs';

interface PlaceholderCopy {
  title: string;
  message: string;
  text: string;
  action?: { label: string; to: string };
}

const COPY: Record<PlaceholderKind, PlaceholderCopy> = {
  agents: {
    title: 'Agent Explorer',
    message: 'No agents in the code yet',
    text: 'The agent service runs today, but it only answers health checks. Its agents arrive with the AI answers feature, and this page will then document each one from the real code.',
    action: { label: 'See the agent service', to: paths.architecture('backend', 'agent') },
  },
  jobs: {
    title: 'Background Jobs',
    message: 'No background jobs in the code yet',
    text: 'Nothing runs on a schedule or from a queue today. When something does, it will be documented here from the real code.',
  },
};

export function PlaceholderPage({ kind }: { kind: PlaceholderKind }) {
  const copy = COPY[kind];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <title>{`${copy.title} · GilderAi Docs`}</title>
      <h1 className="text-lg font-semibold text-fg">{copy.title}</h1>
      <div className="mt-6 rounded-md border border-dashed border-line">
        <EmptyState
          title={copy.message}
          action={
            copy.action ? (
              <Link to={copy.action.to} className="rounded-sm text-accent hover:underline">
                {copy.action.label}
              </Link>
            ) : undefined
          }
        >
          <p>{copy.text}</p>
        </EmptyState>
      </div>
    </div>
  );
}
