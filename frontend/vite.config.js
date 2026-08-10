import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // maplibre-gl spawns its worker from a sibling .mjs that the dep optimizer
    // does not emit, so the worker 404s unless the package is left unbundled.
    exclude: ['maplibre-gl'],
  },
})
