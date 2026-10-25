import { defineConfig } from 'vite';

// The playground as a static site: the demo on GitHub Pages.
export default defineConfig({
  root: 'playground',
  base: './',
  build: { outDir: '../site', emptyOutDir: true },
});
