import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The same JSX setting Next.js uses: no `import React` needed in components.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // Most tests are plain logic; component tests opt into a browser-like DOM per file.
    environment: 'node',
  },
});
