/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Caminho relativo: permite publicar o site em qualquer endereço (ex.: GitHub Pages)
  base: './',
  // Duas páginas: a apresentação (endereço principal) e a plataforma (em /app/)
  build: {
    rollupOptions: {
      input: {
        apresentacao: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
