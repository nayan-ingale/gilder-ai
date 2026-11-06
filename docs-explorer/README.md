# GilderAi Docs Explorer

An interactive map of the GilderAi codebase. Pick any request, follow it step by step through the code, open the real source of each function, and see how the apps, services and data stores fit together.

It is a separate static app. It reads the repository when it builds and never talks to the running product.

## What it shows

| Section            | What you get                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project Overview   | What is documented, and what each status label means                                                                                                       |
| Architecture views | System, frontend, backend, integrations and data, as graphs. Click a part to see what it does, its files, its connections and the flows it takes part in   |
| API Explorer       | Each request and lifecycle event (startup, graceful shutdown) as a flow graph. Click a step for what happens, why, its input and output, and the real code |
| Walkthrough        | Step through a flow like a debugger: one stop at a time with ← / →, in the order the code runs, parallel work included                                     |
| Code Explorer      | Every indexed file and function, with highlighted source, who calls it, what it calls and the routes it registers                                          |
| Error Handling     | How errors become responses, and the error flows                                                                                                           |
| Docs               | Tech stack, architecture decisions, logging and deployment, each section linked to the parts, flows and code it describes                                  |
| Search             | <kbd>⌘K</kbd>, <kbd>Ctrl+K</kbd> or <kbd>/</kbd>: components, flows, steps, routes, files, functions and docs sections, with typo tolerance                |

Every selection lives in the URL, so any view can be shared as a link.

## Run it

From the repository root:

```bash
pnpm docs:dev
```

It opens on http://localhost:3100. Inside `docs-explorer/`, the scripts are:

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `pnpm dev`          | Index the code, then start the dev server with hot reload             |
| `pnpm build`        | Index the code, check the docs against it, then build the static site |
| `pnpm preview`      | Serve the production build from `dist/` on :3100                      |
| `pnpm verify`       | Index the code and check the docs, without building                   |
| `pnpm index:source` | Rebuild the generated index only                                      |
| `pnpm typecheck`    | Index the code, then type-check the app and the scripts               |
| `pnpm test`         | Unit and component tests (Vitest)                                     |
| `pnpm lint`         | ESLint                                                                |

`pnpm build` writes plain files to `dist/`. Any static host can serve them, and hash URLs mean no server rewrites are needed.

## How it stays accurate

The explorer is built from three layers, and the build fails when they disagree.

**1. A generated index of the real code** (`scripts/index-source.ts` → `src/data/generated/`, git-ignored)

- Every `.ts` and `.tsx` file under `backend/shared/src`, `backend/gateway/src`, `backend/services/*/src` and `frontend/src` is read with the TypeScript compiler API, except tests and type declarations.
- For every symbol it records the signature, parameters, return type, comment, lines, the calls it makes, its callers, the npm calls and the HTTP routes it registers.
- Each file's code is saved on its own, so the browser loads it only when it is opened.
- The npm packages each app's `package.json` lists are saved too, for the tech stack page.
- Apart from the `package.json` files, it reads nothing outside those folders, and never env files or keys. It stops with an error if a source file looks like it contains a secret.

**2. Written docs that point at the code** (`src/data/`)

| File              | What it holds                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| `architecture.ts` | The apps, data stores and outside services, and the links between them              |
| `flows/*.ts`      | Each request or lifecycle event, step by step, with the code that runs at each step |
| `notes.ts`        | What each function is for, in words                                                 |
| `pages/*.ts`      | The docs pages, plus why each npm package is used                                   |

They name code by symbol id, `<file path>#<name>`, such as `backend/shared/src/health.ts#healthRouter`. Signatures, line numbers and callers are never written by hand; they come from the index.

**3. A checker** (`scripts/verify-docs.ts`)

It runs before every build, so CI fails when a doc points at code that changed or no longer exists. It fails when:

- a doc points at a symbol, component, flow or file that doesn't exist;
- a highlighted line or a quoted line is no longer in its file;
- a flow's route isn't registered in the code, or a step leads to a step that doesn't exist;
- a verified flow has a code step that isn't verified;
- parallel work doesn't name the step where it joins, or a piece never reaches it;
- something planned doesn't name the feature that adds it;
- a docs page quotes or links a file the explorer must never show, or quotes text that looks like a secret.

It warns, without failing, about shared code that has no note yet and packages that have no line on the tech stack page.

### Status labels

Everything carries one, so nothing unverified looks like fact.

| Label           | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| Verified        | Traced in the code: the route, the functions and their order all exist |
| Partly verified | Some steps are traced; the others are marked on their own              |
| Inferred        | Follows from how the code is put together, but not traced line by line |
| Not wired yet   | Exists and works on its own, but no route or flow uses it yet          |
| Planned         | Designed but not built yet; the feature that adds it is named          |
| Unknown         | Could not be traced in the code                                        |

## When the code changes

Update the explorer in the same change as the code. Run `pnpm verify` first: it lists every reference that no longer lands in the code. It can't judge the words themselves, so a sentence or a status that is no longer true still passes. Reread what the docs say about the code you changed.

- **A function was renamed, moved or deleted.** Fix the symbol ids the checker names, in `flows/`, `notes.ts`, `architecture.ts` or `pages/`.
- **New shared code.** Add a note to `notes.ts`. The checker's warnings list the code that still has none.
- **A new route or lifecycle event.** Add a flow to `src/data/flows/`: the steps in the order the code runs them, each with the symbol that runs it. Use `highlight` when a step is one line of a bigger function, `next` for branches, error paths and later work, and `join` where parallel work meets.
- **A new app, data store or outside service.** Add a component and its links to `architecture.ts`.
- **Something planned is now built.** Change its status and remove `plannedIn`. Once the code exists, give it a flow or a note.
- **A new npm package.** Add a line to `packageNotes` in `pages/stack.ts`. If it was listed as planned, move it out of `plannedTools`.
- **A behaviour a docs page describes changed.** Edit the section in `pages/`. If a quoted line changed, the checker points to it.

Only document what the code does. A flow for something that isn't built would be a guess, so planned work stays a labelled component, link or docs section until it exists.

## Project layout

```
scripts/
  index-source.ts      builds src/data/generated/
  indexer/             reads files, symbols and packages
  verify-docs.ts       checks src/data/ against the index
  verifier/            the checks
src/
  data/                written docs, their types, and the generated index
  model/               joins docs and index: lookups such as "which flows use this function"
  pages/               one component per section
  graph/               architecture and flow graphs (React Flow + dagre)
  walkthrough/         step-by-step mode
  code-explorer/       file tree and file details
  details/             the detail panel
  guides/              docs page rendering
  search/              ⌘K search (MiniSearch, loaded on first open)
  code/                source viewer (Shiki, loaded on demand)
  layout/              sidebar, breadcrumbs, panel
```

Built with Vite, React 19, TypeScript, Tailwind CSS 4, React Router, React Flow with dagre, Shiki and MiniSearch.
