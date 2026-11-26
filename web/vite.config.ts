import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/DataVisualization/ in production,
// from / during local development.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/DataVisualization/' : '/',
  plugins: [react()],
}))
