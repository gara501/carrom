# Carrom

Carrom con reglamento ICF, hecho con Phaser 4.2.1, TypeScript y matter-js.

Modos: **contra la IA** (Fácil, Medio, Difícil) y **2 jugadores** en el mismo equipo.
El modo en línea está en desarrollo.

## Uso

```bash
npm install
npm run dev          # servidor de desarrollo (Vite)
npm test             # tests de core (física, tiro, reglas, partida, IA)
npm run typecheck
npm run build:itch   # build/carrom-itch.zip, listo para subir a itch.io
```

Controles: arrastra el striker para colocarlo en tu pista; arrastra hacia atrás para apuntar
(dirección y fuerza) y suelta para disparar. Funciona con mouse y con el dedo.
Atajos: `P` pausa, `M` música, `N` efectos, `R` reiniciar.

## Estructura

- `packages/core`: lógica pura, sin Phaser ni DOM (corre también en Node).
  - `board.ts` geometría · `physics.ts` mundo matter-js determinista · `shot.ts` tiro y preview
  - `rules.ts` reglas del tablero · `match.ts` partida (25 puntos u 8 tableros) · `ai.ts` IA
- `packages/client`: Phaser.
  - `game/` `MatchController` (física + reglas, sin Phaser) y `AiRunner`
  - `scenes/` Boot, Menu, Game · `render/` tablero, piezas, partículas, apuntado
  - `ui/` widgets, marcador, avisos, diálogos, controles y créditos · `audio/` sonidos, música y preferencias
  - `static/` assets curados (Kenney, fuente Play) · `public/assets/` portada, logo y música

## Música

Las pistas `.mp3` no se incluyen en el repositorio. Colócalas en
`packages/client/public/assets/music/`; el juego las reproduce en orden aleatorio.
Sin pistas, el juego funciona en silencio.

## Créditos

- Creado por Paramdev.
- Interfaz y efectos de sonido: [UI Pack de Kenney](https://kenney.nl/assets/ui-pack), CC0.
- Tipografía: [Play](https://fonts.google.com/specimen/Play), de Jonas Hecksher (SIL Open Font License).
- Música: ver la pantalla de créditos del juego.

## Modo en línea
Menú → **Jugar en línea**: uno crea una sala y comparte el código de 4 letras; el otro se une con él.
El servidor (`packages/server`, Socket.IO en Cloud Run) simula y valida cada tiro con `@carrom/core`.
Ver `docs/cloud-run.md` para desplegarlo. Para probar en local: `npm run dev:server` y
`VITE_SERVER_URL=http://localhost:8080 npm run dev`.
