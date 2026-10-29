import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000, target: 'es2020' },
  // en desarrollo, /ws se reenvía al servidor online local (npm run server)
  server: { host: true, proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } } }
});
