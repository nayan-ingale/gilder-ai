// Everything hand-written about the code, in one place for the UI and the checker
// (scripts/verify-docs.ts). The facts these point at come from generated/source-index.json.
import { components, links } from './architecture.ts';
import { authRouteFlows } from './flows/auth-routes.ts';
import { chatErrorFlows, chatRouteFlows } from './flows/chat-routes.ts';
import { errorFlows } from './flows/errors.ts';
import { httpFlows } from './flows/http.ts';
import { lifecycleFlows } from './flows/lifecycle.ts';
import { notes } from './notes.ts';
import type { Flow } from './schema.ts';

export { components, links, notes };
export { packageNotes, pages, plannedTools } from './pages/index.ts';

export const flows: Flow[] = [
  ...httpFlows,
  ...authRouteFlows,
  ...chatRouteFlows,
  ...errorFlows,
  ...chatErrorFlows,
  ...lifecycleFlows,
];
