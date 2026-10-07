import { defineConfig } from 'vite';

// Build do site/demo (padrão): index.html → dist/
export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,
    assetsInlineLimit: 0,
  },
});
