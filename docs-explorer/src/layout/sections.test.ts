import { describe, expect, it } from 'vitest';
import type { Flow, FlowCategory } from '../data/schema.ts';
import { pathParts, sectionOf } from './sections.ts';

function flow(id: string, category: FlowCategory): Flow {
  return { id, title: id, category, apps: [], summary: '', status: 'verified', steps: [] };
}

const flows = [
  flow('health-check', 'api'),
  flow('error-handling', 'errors'),
  flow('boot', 'lifecycle'),
];
const model = { getFlow: (id: string) => flows.find((item) => item.id === id) };

describe('sectionOf', () => {
  it('maps each top-level page to its section', () => {
    expect(sectionOf('/', model)).toBe('overview');
    expect(sectionOf('/flows', model)).toBe('api');
    expect(sectionOf('/errors', model)).toBe('errors');
    expect(sectionOf('/agents', model)).toBe('agents');
    expect(sectionOf('/jobs', model)).toBe('jobs');
    expect(sectionOf('/code', model)).toBe('code');
  });

  it('maps each architecture view to the section of the same name', () => {
    expect(sectionOf('/architecture/system', model)).toBe('system');
    expect(sectionOf('/architecture/data', model)).toBe('data');
    expect(sectionOf('/architecture/integrations/', model)).toBe('integrations');
  });

  it('puts an error flow under Error Handling and any other flow under API Explorer', () => {
    expect(sectionOf('/flows/error-handling', model)).toBe('errors');
    expect(sectionOf('/flows/health-check', model)).toBe('api');
    expect(sectionOf('/flows/boot', model)).toBe('api');
    expect(sectionOf('/flows/no-such-flow', model)).toBe('api');
  });

  it('decodes the flow id from the path', () => {
    expect(sectionOf('/flows/error%2Dhandling', model)).toBe('errors');
  });

  it('has no section for unknown pages', () => {
    expect(sectionOf('/nope', model)).toBeUndefined();
    expect(sectionOf('/architecture', model)).toBeUndefined();
    expect(sectionOf('/architecture/nope', model)).toBeUndefined();
    expect(sectionOf('/errors/extra', model)).toBeUndefined();
    expect(sectionOf('/flows/health-check/extra', model)).toBeUndefined();
  });
});

describe('pathParts', () => {
  it('splits and decodes, keeping parts that cannot be decoded', () => {
    expect(pathParts('/flows/a%20b/')).toEqual(['flows', 'a b']);
    expect(pathParts('/flows/%E0%A4%A')).toEqual(['flows', '%E0%A4%A']);
  });
});
