import { Navigate, useParams, useSearchParams } from 'react-router';
import { redirectPath } from '../guides/guide-links.ts';
import { GuideView } from '../guides/GuideView.tsx';
import { guides } from '../model/index.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

// One docs page (/docs/:pageId), with `?section=` scrolling to one of its sections. A page
// shown inside a sidebar section (the error-handling page, under Error Handling) opens there
// instead, at the same section.

export function GuidePage() {
  const { pageId } = useParams();
  const [params] = useSearchParams();
  const page = pageId === undefined ? undefined : guides.getPage(pageId);

  if (!page) return <NotFoundPage />;
  const redirect = redirectPath(page, params);
  if (redirect !== undefined) return <Navigate to={redirect} replace />;
  return <GuideView page={page} />;
}
