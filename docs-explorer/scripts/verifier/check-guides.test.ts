import { describe, expect, it } from 'vitest';
import {
  ERROR_FLOWS_SECTION_ID,
  type DocsData,
  type DocSection,
  type GuidesData,
} from '../../src/data/schema.ts';
import type { PackageIndex, SourceIndex } from '../../src/data/source-index.ts';
import type { RepoAccess } from './check-docs.ts';
import { checkGuides, type GuidesContext } from './check-guides.ts';

const LOGGER = `import pino from 'pino';

export const logger = pino({ level: 'info' });
`;

// A fake key, built from parts so secret scanners don't flag this test file.
const FAKE_AWS_KEY = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');

// A tiny repo: one shared logger file, a config file with a key in it, and an env file the docs
// must never show.
const FILES: Record<string, string> = {
  'backend/shared/src/logger.ts': LOGGER,
  'backend/docker-compose.yml': `environment:\n  AWS_ACCESS_KEY_ID: ${FAKE_AWS_KEY}\n`,
  '.env': 'LOG_LEVEL=debug\n',
};

const REPO: RepoAccess = {
  readFile: (filePath) => FILES[filePath],
  exists: (filePath) => filePath in FILES,
};

const INDEX: SourceIndex = {
  files: [
    {
      path: 'backend/shared/src/logger.ts',
      app: 'shared',
      language: 'ts',
      lineCount: 3,
      symbols: [
        {
          id: 'backend/shared/src/logger.ts#logger',
          name: 'logger',
          kind: 'const',
          exported: true,
          startLine: 3,
          endLine: 3,
          calls: [],
          calledBy: [],
          externalCalls: [{ package: 'pino', name: 'default' }],
          routes: [],
        },
      ],
    },
  ],
};

// Only the ids matter here: sections link to this component and this flow.
const DOCS: DocsData = {
  components: [
    {
      id: 'shared',
      name: 'Shared',
      kind: 'library',
      status: 'verified',
      summary: 'Shared code.',
      responsibilities: [],
    },
  ],
  links: [],
  flows: [
    {
      id: 'health-check',
      title: 'GET /healthz',
      category: 'api',
      apps: ['shared'],
      summary: 'Says the app is alive.',
      status: 'verified',
      steps: [],
    },
  ],
  notes: [],
};

const PACKAGES: PackageIndex = {
  packages: [
    { name: '@types/node', usedBy: [{ app: 'shared', version: '^22.20.5', dev: true }] },
    { name: 'pino', usedBy: [{ app: 'shared', version: '^10.1.0', dev: false }] },
  ],
};

const CONTEXT: GuidesContext = { index: INDEX, docs: DOCS, packages: PACKAGES, repo: REPO };

/** Valid docs pages; each test breaks one thing. */
function validGuides(): GuidesData {
  return {
    pages: [
      {
        id: 'logging',
        title: 'Logging',
        summary: 'How the apps write logs.',
        sections: [
          {
            id: 'setup',
            title: 'Setup',
            status: 'verified',
            blocks: [
              { kind: 'text', text: 'Every app logs through `logger`.' },
              {
                kind: 'quote',
                file: 'backend/shared/src/logger.ts',
                text: "export const logger = pino({ level: 'info' });",
              },
              { kind: 'table', columns: ['Level', 'When'], rows: [['info', 'Normal work']] },
            ],
            refs: [
              { component: 'shared' },
              { flow: 'health-check' },
              { symbol: 'backend/shared/src/logger.ts#logger' },
              { file: 'backend/shared/src/logger.ts' },
            ],
          },
          {
            id: 'tracing',
            title: 'Tracing',
            status: 'planned',
            plannedIn: 'Observability',
            blocks: [],
          },
        ],
      },
      {
        id: 'error-handling',
        title: 'Error handling',
        summary: 'How errors reach the user.',
        section: 'errors',
        sections: [],
      },
    ],
    packageNotes: [{ name: 'pino', layer: 'backend', why: 'Fast JSON logs.' }],
    plannedTools: [
      {
        name: 'Sentry',
        package: '@sentry/node',
        layer: 'quality',
        why: 'Error reports.',
        plannedIn: 'Observability',
      },
    ],
  };
}

/** The setup section of the logging page, which most tests break. */
function setupOf(guides: GuidesData): DocSection {
  return guides.pages[0]!.sections[0]!;
}

function problemsOf(guides: GuidesData): string[] {
  return checkGuides(guides, CONTEXT).problems;
}

describe('checkGuides', () => {
  it('accepts docs pages that match the repo', () => {
    expect(checkGuides(validGuides(), CONTEXT)).toEqual({ problems: [], warnings: [] });
  });

  it('rejects duplicate page and section ids, and two pages opening one sidebar section', () => {
    const guides = validGuides();
    const logging = guides.pages[0]!;
    logging.sections.push({ ...logging.sections[1]! });
    guides.pages.push({ ...logging, sections: [] });
    guides.pages.push({ ...guides.pages[1]!, id: 'errors-again' });

    expect(problemsOf(guides)).toEqual([
      'page logging, section tracing: the id is used twice',
      'page logging: the id is used twice',
      'page errors-again: page error-handling already opens the errors section',
    ]);
  });

  it('rejects the error flows id on the page that opens the errors section only', () => {
    const guides = validGuides();
    const flows: DocSection = {
      id: ERROR_FLOWS_SECTION_ID,
      title: 'Flows',
      status: 'verified',
      blocks: [],
    };
    guides.pages[1]!.sections.push(flows);
    // Other pages may use the id: only the Error Handling section lists its flows under it.
    guides.pages[0]!.sections.push({ ...flows });

    expect(problemsOf(guides)).toEqual([
      'page error-handling, section error-flows: the Error Handling section already uses this id for its list of flows',
    ]);
  });

  it('rejects a planned section that does not name the feature that adds it', () => {
    const guides = validGuides();
    guides.pages[0]!.sections[1]!.plannedIn = undefined;

    expect(problemsOf(guides)).toEqual([
      "page logging, section tracing: planned, but plannedIn doesn't name the feature that adds it",
    ]);
  });

  it('rejects refs to parts, flows, symbols and files that do not exist, and private files', () => {
    const guides = validGuides();
    setupOf(guides).refs = [
      { component: 'ghost' },
      { flow: 'nowhere' },
      { symbol: 'backend/shared/src/logger.ts#gone' },
      { file: 'backend/shared/src/missing.ts' },
      { file: '.env' },
      { file: 'docs/notes.md' },
    ];

    expect(problemsOf(guides)).toEqual([
      'page logging, section setup: no component ghost',
      'page logging, section setup: no flow nowhere',
      'page logging, section setup: no symbol backend/shared/src/logger.ts#gone in the code',
      "page logging, section setup: file backend/shared/src/missing.ts doesn't exist",
      'page logging, section setup: file .env must never be shown',
      'page logging, section setup: file docs/notes.md must never be shown',
    ]);
  });

  it('rejects a quote that is no longer in its file', () => {
    const guides = validGuides();
    setupOf(guides).blocks[1] = {
      kind: 'quote',
      file: 'backend/shared/src/logger.ts',
      text: "export const logger = pino({ level: 'debug' });",
    };

    expect(problemsOf(guides)).toEqual([
      `page logging, section setup: "export const logger = pino({ level: 'debug' });" is no longer in backend/shared/src/logger.ts`,
    ]);
  });

  it('rejects empty quotes, quotes from missing files and quotes from private files', () => {
    const guides = validGuides();
    setupOf(guides).blocks = [
      { kind: 'quote', file: 'backend/shared/src/logger.ts', text: '  ' },
      { kind: 'quote', file: 'backend/shared/src/missing.ts', text: 'logger' },
      // The text is in .env, but a private file is never read, so it still fails.
      { kind: 'quote', file: '.env', text: 'LOG_LEVEL=debug' },
    ];

    expect(problemsOf(guides)).toEqual([
      'page logging, section setup: a quote from backend/shared/src/logger.ts has no text',
      "page logging, section setup: quotes backend/shared/src/missing.ts, which doesn't exist",
      'page logging, section setup: quotes .env, which must never be shown',
    ]);
  });

  it('rejects a quote that holds a secret, without repeating the secret', () => {
    const guides = validGuides();
    setupOf(guides).blocks = [
      // The text is in the file, so only the secret check stops it.
      {
        kind: 'quote',
        file: 'backend/docker-compose.yml',
        text: `AWS_ACCESS_KEY_ID: ${FAKE_AWS_KEY}`,
      },
      // Not in the file either, but saying so would print the text, key and all.
      {
        kind: 'quote',
        file: 'backend/shared/src/logger.ts',
        text: `const id = '${FAKE_AWS_KEY}';`,
      },
    ];

    const problems = problemsOf(guides);
    expect(problems).toEqual([
      'page logging, section setup: a quote from backend/docker-compose.yml seems to contain a secret (AWS access key)',
      'page logging, section setup: a quote from backend/shared/src/logger.ts seems to contain a secret (AWS access key)',
    ]);
    expect(problems.join('\n')).not.toContain(FAKE_AWS_KEY);
  });

  it('rejects quotes and file refs that are not plain paths from the repo root, unread', () => {
    const touched: string[] = [];
    const repo: RepoAccess = {
      readFile: (filePath) => {
        touched.push(filePath);
        return REPO.readFile(filePath);
      },
      exists: (filePath) => {
        touched.push(filePath);
        return REPO.exists(filePath);
      },
    };
    const unsafe = [
      '/etc/hosts',
      '../outside.txt',
      'backend/../../outside.txt',
      'backend\\shared\\src\\logger.ts',
      'C:/repo/package.json',
      // Would slip past the private docs rule, which looks at the first folder.
      './docs/notes.md',
      'backend//shared/src/logger.ts',
    ];
    const guides = validGuides();
    setupOf(guides).blocks = [{ kind: 'quote', file: '../outside.txt', text: 'logger' }];
    setupOf(guides).refs = unsafe.map((file) => ({ file }));

    expect(checkGuides(guides, { ...CONTEXT, repo }).problems).toEqual([
      'page logging, section setup: quotes ../outside.txt, which must be a plain path from the repo root',
      ...unsafe.map(
        (file) =>
          `page logging, section setup: file ${file} must be a plain path from the repo root`,
      ),
    ]);
    expect(touched).toEqual([]);
  });

  it('rejects table rows whose cells do not match the columns', () => {
    const guides = validGuides();
    setupOf(guides).blocks[2] = {
      kind: 'table',
      columns: ['Level', 'When'],
      rows: [['info', 'Normal work'], ['error'], ['warn', 'Odd input', 'extra']],
    };

    expect(problemsOf(guides)).toEqual([
      'page logging, section setup: table row 2 has 1 cells, but there are 2 columns',
      'page logging, section setup: table row 3 has 3 cells, but there are 2 columns',
    ]);
  });

  it('rejects duplicate package notes and notes for packages nobody lists', () => {
    const guides = validGuides();
    guides.packageNotes.push(
      { name: 'pino', layer: 'backend', why: 'Again.' },
      { name: 'winston', layer: 'backend', why: 'Logs.' },
    );

    expect(problemsOf(guides)).toEqual([
      'package note pino: written twice',
      'package note winston: no package.json lists it',
    ]);
  });

  it('warns about listed packages with no note, except type packages, without failing', () => {
    const guides = validGuides();
    guides.packageNotes = [];

    expect(checkGuides(guides, CONTEXT)).toEqual({
      problems: [],
      warnings: ['package pino has no note yet'],
    });
  });

  it('rejects planned tools with no feature, and planned tools that are installed now', () => {
    const guides = validGuides();
    guides.plannedTools.push(
      { name: 'Pino', package: 'pino', layer: 'backend', why: 'Logs.', plannedIn: 'Logging' },
      { name: 'Grafana', layer: 'tooling', why: 'Dashboards.', plannedIn: ' ' },
    );

    expect(problemsOf(guides)).toEqual([
      'planned tool Pino: pino is installed now: move it to packageNotes',
      "planned tool Grafana: plannedIn doesn't name the feature that adds it",
    ]);
  });
});
