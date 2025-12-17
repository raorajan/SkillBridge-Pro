import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // Fast refresh configuration
      fastRefresh: true,
    }),
    tailwindcss(),
  ],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false, // Allow automatic port selection if 5173 is busy
    // Optimize HMR for better stability
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
      overlay: true,
    },
    watch: {
      usePolling: false,
      // Reduce file system events to improve performance
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    // Improve server stability for concurrent requests
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
    // Increase connection limits
    fs: {
      // Allow serving files from outside root
      strict: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
          'ui-vendor': ['lucide-react', 'react-toastify'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'react-toastify',
      'lucide-react',
    ],
    // Pre-bundle dependencies to avoid loading issues
    force: false,
    // Exclude problematic dependencies
    exclude: [],
    // Enable esbuild optimizations
    esbuildOptions: {
      target: 'es2020',
    },
  },
  // Improve module resolution
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': '/src',
    },
  },
  // Improve CSS handling
  css: {
    devSourcemap: true,
  },
  // Logging configuration
  logLevel: 'info',
  clearScreen: false,
})