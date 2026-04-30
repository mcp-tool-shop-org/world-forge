import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      // export-unreal's index re-exports Node-only modules (summary, diff, signing).
      // Point the editor at the core export.ts which has no Node built-in deps.
      '@world-forge/export-unreal': resolve(__dirname, '../export-unreal/dist/export.js'),
      // export-godot is browser-safe — alias to source export.ts via dist.
      '@world-forge/export-godot': resolve(__dirname, '../export-godot/dist/export.js'),
      // export.ts imports signing.ts which uses node:crypto — provide a safe stub.
      'node:crypto': resolve(__dirname, 'src/stubs/crypto.ts'),
    },
  },
});
