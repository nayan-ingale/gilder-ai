// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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

    await userEvent.click(screen.getByRole('button', { name: /Open 2 files/ }));

    expect(screen.getByRole('dialog', { name: '2 files' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Preview', 'index.html', 'script.js']);

    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const frame = screen.getByTitle('Preview');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain('document.title');

    await userEvent.click(screen.getByRole('tab', { name: 'script.js' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('document.title = "x";');
  });
});
