import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FeelingLucky',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'feeling-lucky.js' : 'feeling-lucky.iife.js'),
    },
  },
});
