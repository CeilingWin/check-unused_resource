import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/code-viewer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/code-viewer',
    emptyOutDir: true,
  },
});
