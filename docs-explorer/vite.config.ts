import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// A static site: `vite build` writes plain files to dist/ that any static host can serve.
// strictPort stops Vite from silently moving to another port when 3100 is taken.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3100, strictPort: true },
  preview: { port: 3100, strictPort: true },
});
