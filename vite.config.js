import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  // Relative base so the built site works under any GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) as well as at a custom domain root.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        'admin-dashboard': resolve(__dirname, 'admin-dashboard.html'),
        'create-exam': resolve(__dirname, 'create-exam.html'),
        exam: resolve(__dirname, 'exam.html'),
        'exam-results': resolve(__dirname, 'exam-results.html'),
      },
    },
  },
  server: {
    port: 8080,
    host: true,
    open: false,
    // Serve HTML files as static assets
    fs: {
      allow: ['..']
    }
  },
  preview: {
    port: 8080,
    host: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@js': resolve(__dirname, 'js'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  esbuild: {
    target: 'es2020',
  },
  // Ensure HTML files are served as static assets
  optimizeDeps: {
    include: []
  }
});