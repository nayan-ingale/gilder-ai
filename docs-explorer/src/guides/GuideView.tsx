// A docs page in full: its title and summary, a list of its sections when it has more than one,
// then each section. `?section=` scrolls to one. A page with no sections yet says so.
import type { DocPage } from '../data/schema.ts';
import { RichText } from '../details/RichText.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { GuideContents } from './GuideContents.tsx';
import { GuideSections } from './GuideSections.tsx';
import { useSectionTarget } from './use-section-target.ts';

export function GuideView({ page }: { page: DocPage }) {
  const marked = useSectionTarget();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <title>{`${page.title} · GilderAi Docs`}</title>
      <h1 className="text-lg font-semibold text-fg">{page.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-fg-subtle">
        <RichText text={page.summary} />
      </p>

      {page.sections.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line">
          <EmptyState title="Nothing written here yet">
            <p>This page has no sections yet.</p>
          </EmptyState>
        </div>
      ) : (
        <>
          {page.sections.length > 1 ? (
            <div className="mt-6">
              <GuideContents page={page} />
            </div>
          ) : null}
          <div className="mt-8">
            <GuideSections page={page} marked={marked} />
          </div>
        </>
      )}
    </div>
  );
}
