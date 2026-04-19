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
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/@dimforge/rapier3d-compat')) return 'rapier';
          if (id.includes('node_modules/bitecs')) return 'ecs';
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
