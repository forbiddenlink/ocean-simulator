import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/bitecs')) return 'ecs';
        },
      },
    },
  },

  optimizeDeps: {
    include: ['three', 'bitecs'],
  },

  server: {
    port: 3000,
    open: true,
  },

  test: {
    globals: true,
    environment: 'jsdom',
  },
});
