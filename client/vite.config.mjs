import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    {
      name: 'load-js-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.match(/[\\/]src[\\/].*\.js$/)) return null;
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic'
        });
      }
    },
    react({ include: /\.(js|jsx|ts|tsx)$/ })
  ],
  publicDir: 'public',
  build: {
    outDir: 'build',
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
