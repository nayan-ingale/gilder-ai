# GilderAi frontend

Next.js (App Router) + TypeScript + Tailwind CSS. The browser only ever talks to this app; its server proxies `/api/*` to the backend gateway, so backend addresses and secrets never reach the browser.

Run it from the repo root with `pnpm dev` (starts the frontend and the backend together), or on its own:

```bash
pnpm --filter @gilder/frontend dev   # http://localhost:3000
```
