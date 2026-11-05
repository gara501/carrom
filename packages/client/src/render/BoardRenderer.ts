import type Phaser from 'phaser';
import { BOARD, POCKETS, getBaseline, type Side } from '@carrom/core';
import { PAL } from '../theme';

/** Rectángulo (con radio) de la pista del striker para una banda, en mm. */
export function trackRect(side: Side) {
  const b = getBaseline(side);
  const ex = BOARD.strikerDiameter / 2;
  const ux = Math.sign(b.to.x - b.from.x), uy = Math.sign(b.to.y - b.from.y);
  const a = { x: b.from.x - ux * ex, y: b.from.y - uy * ex };
  const c = { x: b.to.x + ux * ex, y: b.to.y + uy * ex };
  const pad = ex + 8;
  const horizontal = uy === 0;
  return {
    a, c, pad,
    rx: horizontal ? Math.min(a.x, c.x) - 8 : a.x - pad,
    ry: horizontal ? a.y - pad : Math.min(a.y, c.y) - 8,
    rw: horizontal ? Math.abs(c.x - a.x) + 16 : pad * 2,
    rh: horizontal ? pad * 2 : Math.abs(c.y - a.y) + 16,
  };
}

/** Tablero "papel": marco azul tinta, superficie crema con rejilla de puntos, pistas redondeadas. Unidades en mm. */
export function drawBoard(g: Phaser.GameObjects.Graphics) {
  g.clear();
  const half = BOARD.size / 2;
  const fr = BOARD.frameThickness;
  const total = BOARD.size + fr * 2;

  // Sombra suave del tablero
  for (let i = 5; i >= 1; i--) {
    g.fillStyle(0x2b3a55, 0.035).fillRoundedRect(-half - fr - i * 3, -half - fr + 10 - i * 2, total + i * 6, total + i * 6, 40 + i * 3);
  }
  // Marco con bisel: canto oscuro, cuerpo, luz arriba-izquierda, sombra abajo-derecha y veta suave
  g.fillStyle(0x1b2638, 1).fillRoundedRect(-half - fr, -half - fr, total, total, 40);
  g.fillStyle(PAL.ink, 1).fillRoundedRect(-half - fr + 4, -half - fr + 4, total - 8, total - 8, 36);
  g.fillStyle(0x34466a, 0.55).fillRoundedRect(-half - fr + 4, -half - fr + 4, total - 8, (total - 8) * 0.5, { tl: 36, tr: 36, bl: 0, br: 0 });
  g.lineStyle(3, 0xffffff, 0.16).beginPath().arc(-half - fr + 40, -half - fr + 40, 36, Math.PI, Math.PI * 1.5).lineTo(half + fr - 40, -half - fr + 4).strokePath();
  g.lineStyle(3, 0xffffff, 0.1).beginPath().arc(-half - fr + 40, -half - fr + 40, 36, Math.PI, Math.PI * 0.5, true).lineTo(-half - fr + 4, half + fr - 40).strokePath();
  g.lineStyle(3, 0x0a1020, 0.35).beginPath().arc(half + fr - 40, half + fr - 40, 36, 0, Math.PI * 0.5).lineTo(-half - fr + 40, half + fr - 4).strokePath();
  g.lineStyle(3, 0x0a1020, 0.3).beginPath().arc(half + fr - 40, half + fr - 40, 36, 0, -Math.PI * 0.5, true).lineTo(half + fr - 4, -half - fr + 40).strokePath();
  // veta: líneas finas a lo largo de cada banda del marco
  g.lineStyle(1.5, 0xffffff, 0.05);
  for (let k = 8; k < fr - 4; k += 7) {
    g.lineBetween(-half, -half - k, half, -half - k);
    g.lineBetween(-half, half + k, half, half + k);
    g.lineBetween(-half - k, -half, -half - k, half);
    g.lineBetween(half + k, -half, half + k, half);
  }
  g.fillStyle(PAL.surface, 1).fillRoundedRect(-half, -half, BOARD.size, BOARD.size, 14);
  // sombra interior de la superficie (el marco sobresale)
  for (let i = 1; i <= 7; i++) g.lineStyle(2, PAL.ink, 0.075 * (8 - i)).strokeRoundedRect(-half + i * 1.6, -half + i * 1.6, BOARD.size - i * 3.2, BOARD.size - i * 3.2, 14);

  // Rejilla de puntos sutil
  g.fillStyle(PAL.ink, 0.07);
  for (let x = -half + 40; x < half; x += 40) for (let y = -half + 40; y < half; y += 40) g.fillCircle(x, y, 2);

  // Diagonales decorativas desde los bolsillos
  g.lineStyle(3, PAL.ink, 0.12);
  for (const p of POCKETS) {
    const sx = Math.sign(-p.x), sy = Math.sign(-p.y);
    g.lineBetween(p.x + sx * 46, p.y + sy * 46, p.x + sx * 92, p.y + sy * 92);
  }

  // Círculo central y de la reina
  g.fillStyle(PAL.tint, 1).fillCircle(0, 0, BOARD.centerCircleDiameter / 2);
  g.lineStyle(3, PAL.ink, 0.45).strokeCircle(0, 0, BOARD.centerCircleDiameter / 2);
  g.lineStyle(3, PAL.queen, 0.8).strokeCircle(0, 0, BOARD.baseCircleDiameter / 2);

  // Pistas del striker (cápsulas) con los círculos de salida
  (['bottom', 'top', 'left', 'right'] as Side[]).forEach((side) => {
    const { a, c, pad, rx, ry, rw, rh } = trackRect(side);
    g.fillStyle(PAL.track, 1).fillRoundedRect(rx, ry, rw, rh, pad);
    g.lineStyle(2.5, PAL.ink, 0.28).strokeRoundedRect(rx, ry, rw, rh, pad);
    g.lineStyle(2.5, PAL.ink, 0.4).lineBetween(a.x, a.y, c.x, c.y);
    g.strokeCircle(a.x, a.y, BOARD.baseCircleDiameter / 2);
    g.strokeCircle(c.x, c.y, BOARD.baseCircleDiameter / 2);
  });

  // Bolsillos con profundidad: aro, pozo degradado y brillo en el borde
  for (const p of POCKETS) {
    const r = BOARD.pocketDiameter / 2;
    g.fillStyle(0x1b2638, 1).fillCircle(p.x, p.y, r + 7);
    g.fillStyle(0x3a4c70, 1).fillCircle(p.x, p.y, r + 4);
    g.fillStyle(PAL.pocket, 1).fillCircle(p.x, p.y, r);
    g.fillStyle(0x121a2a, 1).fillCircle(p.x + 1, p.y + 2, r * 0.8);
    g.fillStyle(0x080d17, 1).fillCircle(p.x + 2, p.y + 4, r * 0.56);
    g.lineStyle(3, 0xffffff, 0.14).beginPath().arc(p.x, p.y, r + 1.5, Math.PI * 0.1, Math.PI * 0.9).strokePath();
    g.lineStyle(2, 0x000000, 0.3).beginPath().arc(p.x, p.y, r - 1, Math.PI * 1.1, Math.PI * 1.9).strokePath();
  }
}
