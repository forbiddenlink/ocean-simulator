import { defineConfig } from 'vite';
import path from 'path';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [
    glsl({ watch: true }) // Enable shader hot reload
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
          ecs: ['bitecs'],
        },
      },
    },
  },
  
  optimizeDeps: {
    include: ['three', '@dimforge/rapier3d-compat', 'bitecs'],
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
