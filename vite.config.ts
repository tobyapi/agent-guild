import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tauri の devUrl は http://localhost:1420
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/agent-runner/**', '**/data/**'] },
  },
  build: { target: 'es2022', outDir: 'dist' },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'agent-runner/src/**/*.test.ts'],
    environment: 'node',
  },
});
