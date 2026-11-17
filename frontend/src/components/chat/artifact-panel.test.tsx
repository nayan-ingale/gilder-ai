// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ArtifactPanel } from './artifact-panel';
import { FilesCard } from './files-card';

afterEach(() => {
  cleanup();
});

const files = [
  { name: 'index.html', language: 'html', content: '<h1>Hi</h1><script src="script.js"></script>' },
  { name: 'script.js', language: 'javascript', content: 'document.title = "x";' },
];

describe('files card and panel', () => {
  it('opens the files, shows each one, and previews the page in a locked-down frame', async () => {
    render(<FilesCard files={files} />);

    const card = screen.getByRole('button', { name: /2 files · HTML, JavaScript/ });
    await userEvent.click(card);

    const dialog = screen.getByRole('dialog', { name: 'Code' });
    expect(within(dialog).getByText('2 files')).toBeTruthy();
    expect(
      within(screen.getByRole('tablist', { name: 'Files' }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['index.html', 'script.js']);

    await userEvent.click(screen.getByRole('tab', { name: 'script.js' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('document.title = "x";');

    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const frame = screen.getByTitle('Preview');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain('document.title');
    expect(screen.getByText(/Preview runs in a sandbox/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Close the files' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('docks beside the chat with its title and version', () => {
    render(
      <ArtifactPanel
        files={files}
        open
        onOpenChange={() => {}}
        title="Brew & Co. landing page"
        version={2}
        docked
      />,
    );

    const panel = screen.getByRole('complementary', { name: 'Code files' });
    expect(within(panel).getByRole('heading', { name: 'Brew & Co. landing page' })).toBeTruthy();
    expect(within(panel).getByText('Version 2 · 2 files')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
