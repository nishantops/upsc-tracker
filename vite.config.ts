import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // react-draggable v4 uses process.env.NODE_ENV internally; Vite doesn't
    // polyfill `process`, so we must define it to prevent "process is not defined"
    // errors that abort drag/resize handlers at runtime.
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  build: {
    rollupOptions: {
      input: 'app.html',
      output: {
        // Group all react-* packages together — avoids circular chunk deps
        // (react-grid-layout/react-draggable depend on react & react-dom;
        //  splitting them caused "Cannot set properties of undefined" in prod)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react'))     return 'vendor-react'; // react, react-dom, react-grid-layout, react-draggable, react-resizable
            return 'vendor-misc';
          }
          // Keep PYQ data in its own chunk (already lazy-loaded)
          if (id.includes('pyq-data') || id.includes('PYQ/') || id.includes('pyq_data')) return 'data-pyq';
          // Group all modals together (lazy-loaded, small)
          if (id.includes('/modals/')) return 'chunk-modals';
          // Group all heavy view/feature components together (lazy-loaded)
          if (
            id.includes('/plans/') || id.includes('/sources/') ||
            id.includes('/syllabus/') || id.includes('/ca/') || id.includes('/testseries/')
          ) return 'chunk-views';
        },
      },
    },
    outDir: 'dist',
    // Don't inline small assets — let them get their own cached URL
    assetsInlineLimit: 0,
    // Remove console.* in production
    minify: 'esbuild',
    // Increase chunk warning limit since PYQ data is large but isolated
    chunkSizeWarningLimit: 2000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
