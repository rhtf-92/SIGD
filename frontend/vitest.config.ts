/// <reference types="vitest" />

/**
 * @file vitest.config.ts
 * @description Configuración de Vitest para las pruebas unitarias del proyecto
 */

import { defineConfig as defineViteConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import { mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const viteConfig = defineViteConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  })
);
