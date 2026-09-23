import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = Number(process.env.PORT ?? 3000);

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5180,
    strictPort: true,
    host: true,
    fs: { allow: ['..'] },
    proxy: {
      '/socket.io': { target: `http://localhost:${backendPort}`, ws: true },
      '/api': { target: `http://localhost:${backendPort}` },
    },
  },
});
