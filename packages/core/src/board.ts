/**
 * Geometría del tablero. Sin dependencias de Phaser ni de matter-js.
 * Unidad: 1 unidad = 1 mm. Origen (0,0) = centro del tablero, +y hacia abajo.
 * Medidas basadas en el reglamento ICF; todas ajustables para "game feel".
 */

export const BOARD = {
  /** Lado de la superficie de juego (74 cm). */
  size: 740,
  /** Diámetro del bolsillo (4.45 cm). */
  pocketDiameter: 44.5,
  /** Diámetro de peón y reina (3.18 cm). */
  coinDiameter: 31.8,
  /** Diámetro del striker (ICF: 4.13 cm; agrandado para mejor jugabilidad). */
  strikerDiameter: 48,
  /** Largo de la línea base (47.3 cm). */
  baselineLength: 473,
  /** Distancia del borde a la línea base (centro del círculo de salida). */
  baselineOffset: 100,
  /** Diámetro del círculo central (17 cm). */
  centerCircleDiameter: 170,
  /** Diámetro del círculo de la reina (3.2 cm). */
  baseCircleDiameter: 32,
  /** Grosor visual del marco. */
  frameThickness: 40,
} as const;

export type Vec2 = { x: number; y: number };
export type Side = 'bottom' | 'top' | 'left' | 'right';

const HALF = BOARD.size / 2;

/** Los bolsillos son tangentes a las dos bandas de su esquina. */
const PC = HALF - BOARD.pocketDiameter / 2;
export const POCKETS: readonly Vec2[] = [
  { x: -PC, y: -PC },
  { x: PC, y: -PC },
  { x: -PC, y: PC },
  { x: PC, y: PC },
];

export interface Baseline {
  side: Side;
  /** Extremos del segmento sobre el que se desliza el striker (centros). */
  from: Vec2;
  to: Vec2;
  /** Dirección unitaria hacia el centro del tablero. */
  inward: Vec2;
}

export function getBaseline(side: Side): Baseline {
  const d = HALF - BOARD.baselineOffset;
  const h = BOARD.baselineLength / 2 - BOARD.strikerDiameter / 2;
  switch (side) {
    case 'bottom': return { side, from: { x: -h, y: d }, to: { x: h, y: d }, inward: { x: 0, y: -1 } };
    case 'top':    return { side, from: { x: -h, y: -d }, to: { x: h, y: -d }, inward: { x: 0, y: 1 } };
    case 'left':   return { side, from: { x: -d, y: -h }, to: { x: -d, y: h }, inward: { x: 1, y: 0 } };
    case 'right':  return { side, from: { x: d, y: -h }, to: { x: d, y: h }, inward: { x: -1, y: 0 } };
  }
}

/** Posiciones iniciales: reina al centro, anillo interno de 6 y externo de 12 (18 peones). */
export type CoinColor = 'white' | 'black' | 'queen';
export interface CoinSpawn extends Vec2 { color: CoinColor }

export function initialLayout(): CoinSpawn[] {
  // Separación mínima para que las piezas no arranquen solapadas (evita jitter del solver).
  const r = (BOARD.coinDiameter / 2) * 1.003;
  const out: CoinSpawn[] = [{ x: 0, y: 0, color: 'queen' }];
  // Anillo interno: 6 piezas tangentes a la reina, alternando color.
  const ringIn = 2 * r;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    out.push({ x: Math.cos(a) * ringIn, y: Math.sin(a) * ringIn, color: i % 2 === 0 ? 'white' : 'black' });
  }
  // Anillo externo: 12 piezas, alternando color; 6 en los "vértices" y 6 entre ellos.
  const ringOut = 4 * r * Math.cos(Math.PI / 6); // hueco entre piezas del anillo interno
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 6;
    const radius = i % 2 === 0 ? 4 * r : ringOut * 1.0;
    out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius, color: i % 2 === 0 ? 'black' : 'white' });
  }
  return out;
}
