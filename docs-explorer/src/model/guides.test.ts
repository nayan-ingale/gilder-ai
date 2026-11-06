import { describe, expect, it } from 'vitest';
import type { DocPage } from '../data/schema.ts';
import { createGuidesModel, refKey } from './guides.ts';

const logging: DocPage = {
  id: 'logging',
  title: 'Logging',
  summary: 'How the apps log.',
  sections: [
    {
      id: 'setup',
      title: 'Setup',
      status: 'verified',
      blocks: [{ kind: 'text', text: 'One logger per app.' }],
      refs: [
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { symbol: 'backend/shared/src/logger.ts#createLogger' },
        { component: 'shared' },
      ],
    },
    { id: 'levels', title: 'Levels', status: 'verified', blocks: [] },
  ],
};

const errors: DocPage = {
  id: 'error-handling',
  title: 'Error handling',
  summary: 'How errors become responses.',
  section: 'errors',
  sections: [
    {
      id: 'shape',
      title: 'Shape',
      status: 'verified',
      blocks: [],
      refs: [{ component: 'shared' }],
    },
  ],
};

const model = createGuidesModel(
  {
    pages: [logging, errors],
    packageNotes: [{ name: 'pino', layer: 'backend', why: 'Logs.' }],
    plannedTools: [],
  },
  { packages: [{ name: 'pino', usedBy: [{ app: 'shared', version: '^10.4.0', dev: false }] }] },
);

describe('createGuidesModel', () => {
  it('finds pages, keeps section pages out of the Docs list, and finds package notes', () => {
    expect(model.getPage('logging')).toBe(logging);
    expect(model.getPage('nope')).toBeUndefined();
    expect(model.docsPages).toEqual([logging]);
    expect(model.pageForSection('errors')).toBe(errors);
    expect(model.getPackageNote('pino')?.why).toBe('Logs.');
    expect(model.packages.map((entry) => entry.name)).toEqual(['pino']);
  });

  it('finds the sections about a ref, once per section', () => {
    const aboutLogger = model.sectionsAbout({
      symbol: 'backend/shared/src/logger.ts#createLogger',
    });
    expect(aboutLogger.map(({ page, section }) => `${page.id}/${section.id}`)).toEqual([
      'logging/setup',
    ]);
    expect(model.sectionsAbout({ component: 'shared' }).map(({ section }) => section.id)).toEqual([
      'setup',
      'shape',
    ]);
    expect(model.sectionsAbout({ flow: 'health-check' })).toEqual([]);
  });

  it('keys each kind of ref apart', () => {
    expect(refKey({ component: 'gateway' })).toBe('component:gateway');
    expect(refKey({ flow: 'ready' })).toBe('flow:ready');
    expect(refKey({ file: 'backend/docker-compose.yml' })).toBe('file:backend/docker-compose.yml');
  });
});
