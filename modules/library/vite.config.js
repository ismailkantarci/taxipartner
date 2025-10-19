import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    lib: {
      entry: {
        index: resolve(__dirname, 'index.js'),
        tokens: resolve(__dirname, 'tokens/index.js'),
        'components/phone-input': resolve(__dirname, 'components/phone-input/phone-input.js')
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: ['intl-tel-input'],
      output: {
        preserveModules: true,
        preserveModulesRoot: __dirname,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
