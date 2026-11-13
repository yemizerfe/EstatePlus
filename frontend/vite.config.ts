import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    // How long (ms) the dev server waits for the proxied backend to respond.
    proxyTimeout: 30000,
    // How long (ms) the browser is willing to wait for the dev server response.
    timeout: 30000,
    proxy: {
      '/api': {
        // Use 127.0.0.1 instead of localhost to avoid Node.js resolving
        // "localhost" to both IPv4 (127.0.0.1) and IPv6 (::1) addresses,
        // which produces an AggregateError [ECONNREFUSED] when the backend
        // is briefly unavailable (e.g. during a tsx-watch restart).
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        // Surface proxy errors as 502 responses instead of crashing the
        // connection; the frontend can then handle them gracefully.
        configure(proxy) {
          proxy.on('error', (err, _req, res) => {
            if (res && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Backend service unavailable' }));
            } else {
              console.error('Vite proxy error:', err?.message || err);
            }
          });
        },
      },
      // Avatars (and any other uploaded media) are served by the backend from
      // its uploads directory; proxy them so <img src="/uploads/..."> resolves
      // in development exactly as it does in production.
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          map: ['leaflet', 'react-leaflet'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
