import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json' with { type: 'json' };

const appVersion = pkg.version;

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // The overlay pages compare this with the version the app reports (src/lib/overlayVersion.ts).
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  build: {
    target: 'chrome120',
    outDir: 'dist',
    manifest: true,
    rollupOptions: {
      input: {
        app: 'index.html',
        chatOverlay: 'src/chat-overlay.html',
        obsChat: 'src/obs-chat.html',
        voteOverlay: 'src/vote-overlay.html',
        imageOverlay: 'src/image-overlay.html',
        clipOverlay: 'src/clip-overlay.html',
      },
    },
  },
});
