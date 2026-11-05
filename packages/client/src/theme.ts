/** Paleta y constantes visuales: estilo "papel" minimalista, con la UI de Kenney (CC0). */
export const FONT = '"Play", "Segoe UI", system-ui, sans-serif';
export const FONT_NARROW = FONT;

export const PAL = {
  paper: 0xf2eee6,
  paperCss: '#f2eee6',
  ink: 0x2b3a55,
  inkCss: '#2b3a55',
  inkSoftCss: '#5b6b86',
  surface: 0xfbf8f1,
  tint: 0xe3eefb,
  track: 0xeaf1fa,
  pocket: 0x1b2538,
  coinWhite: 0xffffff,
  coinBlack: 0x2b3a55,
  queen: 0xff6b6b,
  striker: 0x2aa5e8,
  bad: 0xe5484d,
  blue: 0x1e9fd8,
  blueCss: '#1e9fd8',
  gold: 0xffc83d,
} as const;

/** Densidad de píxeles usada también por el canvas (ver main.ts). */
export const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
/** Px de CSS -> px de canvas. */
export const u = (n: number) => n * dpr();
/** Las texturas de Kenney "Double" están a 2x: se escalan a dpr/2 para verse del tamaño nominal. */
export const texScale = () => dpr() / 2;

export const UI_COLORS = ['blue', 'green', 'red', 'yellow', 'grey'] as const;
export type UIColor = (typeof UI_COLORS)[number];
