import { defineConfig } from 'vite';

// Build da biblioteca (ES module minificado; d.ts via tsconfig.lib.json):
//   npm run build:lib  →  dist-lib/bee-mascot.js + dist-lib/index.d.ts
// (estilos do componente são injetados pelo próprio JS — não há CSS separado)
export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BeeMascot',
      formats: ['es'],
      fileName: () => 'bee-mascot.js',
    },
    outDir: 'dist-lib',
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
