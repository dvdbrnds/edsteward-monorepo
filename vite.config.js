import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  server: {
    port: 3050,
    strictPort: true,
    host: true,
    open: true,
    https: {
      key: fs.readFileSync('certs/localhost-key.pem'),
      cert: fs.readFileSync('certs/localhost.pem'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
