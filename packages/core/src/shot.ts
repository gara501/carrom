/**
 * Lógica pura del tiro: posición en la línea base, mapeo arrastre -> velocidad
 * y previsualización de trayectoria (raycast analítico, sin simular).
 */
import { BOARD, getBaseline, type Side, type Vec2 } from './board';
import type { PieceKind, PieceState } from './physics';

export const SHOT = {
  /** Arrastre mínimo (mm) para que cuente como tiro; menos = cancelar. */
  minDrag: 25,
  /** Arrastre que da la potencia máxima (mm). */
  maxDrag: 320,
  /** Velocidades de salida (mm/s). */
  minSpeed: 500,
  maxSpeed: 4500,
} as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Posición del striker en la línea base; t=0 extremo `from`, t=1 extremo `to`. */
export function baselinePosition(side: Side, t: number): Vec2 {
  const b = getBaseline(side);
  const u = clamp01(t);
  return { x: lerp(b.from.x, b.to.x, u), y: lerp(b.from.y, b.to.y, u) };
}

/** Proyecta un punto sobre la línea base y devuelve t en [0,1]. */
export function projectOnBaseline(side: Side, p: Vec2): number {
  const b = getBaseline(side);
  const dx = b.to.x - b.from.x, dy = b.to.y - b.from.y;
  const t = ((p.x - b.from.x) * dx + (p.y - b.from.y) * dy) / (dx * dx + dy * dy);
  return clamp01(t);
}

export interface ShotParams {
  dir: Vec2;      // unitario
  speed: number;  // mm/s
  power: number;  // 0..1
  velocity: Vec2; // dir * speed
}

/**
 * `pull` = vector desde el puntero hasta el striker (estilo honda): apunta en
 * la dirección del tiro y su longitud fija la potencia. null si es muy corto.
 */
export function shotFromPull(pull: Vec2): ShotParams | null {
  const len = Math.hypot(pull.x, pull.y);
  if (len < SHOT.minDrag) return null;
  const power = clamp01((len - SHOT.minDrag) / (SHOT.maxDrag - SHOT.minDrag));
  const speed = lerp(SHOT.minSpeed, SHOT.maxSpeed, power);
  const dir = { x: pull.x / len, y: pull.y / len };
  return { dir, speed, power, velocity: { x: dir.x * speed, y: dir.y * speed } };
}

/** Tiro a partir de una dirección (se normaliza) y una velocidad en mm/s (se acota al rango legal). */
export function shotFromSpeed(dir: Vec2, speed: number): ShotParams {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const d = { x: dir.x / len, y: dir.y / len };
  const sp = Math.min(SHOT.maxSpeed, Math.max(SHOT.minSpeed, speed));
  return { dir: d, speed: sp, power: clamp01((sp - SHOT.minSpeed) / (SHOT.maxSpeed - SHOT.minSpeed)), velocity: { x: d.x * sp, y: d.y * sp } };
}

export interface ShotPreview {
  /** Centro del striker en el primer contacto. */
  point: Vec2;
  /** Distancia recorrida hasta el contacto. */
  distance: number;
  hit: PieceKind | 'wall';
  /** Si golpea una pieza: hacia dónde sale (aprox., línea de centros). */
  target?: { id: number; kind: PieceKind; dir: Vec2 };
}

/** Primer contacto de un círculo de `radius` que parte de `origin` en la dirección unitaria `dir`. */
export function previewShot(origin: Vec2, dir: Vec2, radius: number, pieces: readonly PieceState[]): ShotPreview {
  let best = Infinity;
  let hit: ShotPreview['hit'] = 'wall';
  let targetPiece: PieceState | undefined;

  for (const p of pieces) {
    if (p.kind === 'striker') continue;
    const R = radius + p.radius;
    const fx = origin.x - p.x, fy = origin.y - p.y;
    const b = fx * dir.x + fy * dir.y;
    const c = fx * fx + fy * fy - R * R;
    const disc = b * b - c;
    if (disc < 0) continue;
    const s = -b - Math.sqrt(disc);
    if (s >= 0 && s < best) { best = s; hit = p.kind; targetPiece = p; }
  }

  const lim = BOARD.size / 2 - radius;
  const wall = (o: number, d: number) => (d > 1e-9 ? (lim - o) / d : d < -1e-9 ? (-lim - o) / d : Infinity);
  const sw = Math.min(wall(origin.x, dir.x), wall(origin.y, dir.y));
  if (sw >= 0 && sw < best) { best = sw; hit = 'wall'; targetPiece = undefined; }

  const point = { x: origin.x + dir.x * best, y: origin.y + dir.y * best };
  const out: ShotPreview = { point, distance: best, hit };
  if (targetPiece) {
    const nx = targetPiece.x - point.x, ny = targetPiece.y - point.y;
    const n = Math.hypot(nx, ny) || 1;
    out.target = { id: targetPiece.id, kind: targetPiece.kind, dir: { x: nx / n, y: ny / n } };
  }
  return out;
}
