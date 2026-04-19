import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base lets the build work on github.io project pages,
// user pages, or any static host at any subpath.
export default defineConfig({
  plugins: [react()],
  base: './',
});
