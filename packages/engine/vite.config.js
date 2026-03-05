import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  server: {
    port: 3050,
    strictPort: true,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
