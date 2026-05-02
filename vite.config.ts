import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
          output: {
            // Avoid manual chunking per-package which can create circular
            // dependencies between vendor chunks and produce runtime errors
            // (e.g. "B is undefined"). Use a single `vendor` chunk so that
            // all node_modules are bundled together and execution order is
            // deterministic.
            manualChunks(id: string) {
              if (id.includes('node_modules')) {
                return 'vendor';
              }
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
