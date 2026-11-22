import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages のサブパス配信でも動くよう相対パスでビルドする
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
