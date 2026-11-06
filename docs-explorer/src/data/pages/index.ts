// The docs pages, in the order the sidebar lists them. The error-handling page opens the Error
// Handling section instead of being listed under Docs (see DocPage.section).
import type { DocPage } from '../schema.ts';
import { decisionsPage } from './decisions.ts';
import { deploymentPage } from './deployment.ts';
import { errorHandlingPage } from './error-handling.ts';
import { loggingPage } from './logging.ts';
import { stackPage } from './stack.ts';

export { packageNotes, plannedTools } from './stack.ts';

export const pages: DocPage[] = [
  stackPage,
  decisionsPage,
  loggingPage,
  deploymentPage,
  errorHandlingPage,
];
