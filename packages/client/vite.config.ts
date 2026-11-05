import { defineConfig } from 'vite';

// Solo se sirven los assets curados de `static/` (el pack completo de Kenney queda fuera del build).
export default defineConfig({
  publicDir: false,
  base: './', // rutas relativas: itch.io sirve el juego desde una subcarpeta
  build: { chunkSizeWarningLimit: 2000 },
});
