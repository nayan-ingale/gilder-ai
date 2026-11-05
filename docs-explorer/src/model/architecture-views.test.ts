import { describe, expect, it } from 'vitest';
import type { ArchComponent, ArchLink, ComponentKind } from '../data/schema.ts';
import { ARCH_VIEWS, architectureView, getArchView } from './architecture-views.ts';

function component(id: string, kind: ComponentKind, path?: string): ArchComponent {
  return { id, name: id, kind, status: 'verified', summary: id, responsibilities: [], path };
}

function link(from: string, to: string): ArchLink {
  return { from, to, kind: 'http', label: `${from} to ${to}`, status: 'verified' };
}

const components = [
  component('browser', 'client'),
  component('frontend', 'app', 'frontend'),
  component('gateway', 'app', 'backend/gateway'),
  component('shared', 'library', 'backend/shared'),
  component('redis', 'datastore'),
  component('llm', 'external'),
];

const links = [
  link('browser', 'frontend'),
  link('frontend', 'gateway'),
  link('gateway', 'shared'),
  link('gateway', 'redis'),
  link('gateway', 'llm'),
];

const ids = (list: { id: string }[]): string[] => list.map((item) => item.id);

describe('architectureView', () => {
  it('shows everything in the system view', () => {
    const view = architectureView('system', components, links);
    expect(view.components).toHaveLength(components.length);
    expect(view.links).toHaveLength(links.length);
    expect(view.contextIds.size).toBe(0);
  });

  it('adds direct neighbours as context where the view asks for them', () => {
    const view = architectureView('frontend', components, links);
    expect(ids(view.components)).toEqual(['browser', 'frontend', 'gateway']);
    expect([...view.contextIds]).toEqual(['gateway']);
    // Only links with both ends on screen: gateway -> shared would point at nothing.
    expect(view.links.map((l) => `${l.from}>${l.to}`)).toEqual([
      'browser>frontend',
      'frontend>gateway',
    ]);
  });

  it('keeps the backend view to backend code and data stores', () => {
    const view = architectureView('backend', components, links);
    expect(ids(view.components)).toEqual(['gateway', 'shared', 'redis']);
    expect(view.contextIds.size).toBe(0);
  });

  it('shows outside services and data stores with the apps that use them', () => {
    expect(ids(architectureView('integrations', components, links).components)).toEqual([
      'gateway',
      'llm',
    ]);
    expect(ids(architectureView('data', components, links).components)).toEqual([
      'gateway',
      'redis',
    ]);
  });

  it('looks views up by id', () => {
    expect(getArchView('data')?.title).toBe('Database & Data Flow');
    expect(getArchView('nope')).toBeUndefined();
    expect(new Set(ids(ARCH_VIEWS)).size).toBe(ARCH_VIEWS.length);
  });
});
