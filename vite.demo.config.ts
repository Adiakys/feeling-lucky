import { defineConfig } from 'vite';

// The playground: served by `npm run dev`, with the multiplayer server of docker-compose behind /feeling-lucky, and
// built as a static site for the demo on GitHub Pages, single player.
export default defineConfig({
  root: 'playground',
  base: './',
  build: { outDir: '../site', emptyOutDir: true },
  server: { proxy: { '/feeling-lucky': 'http://localhost:5080' } },
});
