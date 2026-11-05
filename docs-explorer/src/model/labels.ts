import type { ComponentKind, EdgeKind, FlowCategory, LinkKind, StepKind } from '../data/schema.ts';
import type { SymbolKind } from '../data/source-index.ts';

// The words the UI uses for each kind of thing, so the graph, its legend and the detail panel
// always name things the same way.

export const COMPONENT_KIND_LABEL: Record<ComponentKind, string> = {
  client: 'Client',
  app: 'App',
  library: 'Library',
  datastore: 'Data store',
  external: 'Outside service',
};

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  http: 'HTTP call',
  internal: 'Import (same process)',
  data: 'Data store connection',
  external: 'Outside service call',
};

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  trigger: 'Trigger',
  middleware: 'Middleware',
  handler: 'Route handler',
  function: 'Function',
  datastore: 'Data store',
  external: 'Outside service',
  response: 'Response',
  error: 'Error',
};

export const EDGE_KIND_LABEL: Record<EdgeKind, string> = {
  next: 'Next step',
  branch: 'Condition',
  error: 'Error path',
  parallel: 'Runs at the same time',
  async: 'Finishes later',
};

export const FLOW_CATEGORY_LABEL: Record<FlowCategory, string> = {
  api: 'API calls',
  errors: 'Errors',
  lifecycle: 'App lifecycle',
};

export const SYMBOL_KIND_LABEL: Record<SymbolKind, string> = {
  function: 'Function',
  class: 'Class',
  method: 'Method',
  interface: 'Interface',
  type: 'Type',
  const: 'Constant',
  module: 'Top-level code',
};
