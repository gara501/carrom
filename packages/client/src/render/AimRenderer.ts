import type Phaser from 'phaser';
import { previewShot, type PieceState, type ShotParams, type Vec2 } from '@carrom/core';
import { PAL } from '../theme';

/** Preview del tiro: guía punteada, bola fantasma, dirección de la pieza golpeada y arco de potencia. */
export function drawAim(
  g: Phaser.GameObjects.Graphics, striker: PieceState, pull: Vec2, shot: ShotParams | null,
  pieces: readonly PieceState[], valid: boolean,
) {
  const sx = striker.x, sy = striker.y;
  const col = valid ? PAL.blue : PAL.bad;

  // Cinta de la honda (hacia el lado contrario del tiro)
  g.lineStyle(5, PAL.ink, 0.18).lineBetween(sx, sy, sx - pull.x, sy - pull.y);
  g.fillStyle(PAL.ink, 0.25).fillCircle(sx - pull.x, sy - pull.y, 9);

  if (!shot) return;
  const pv = previewShot({ x: sx, y: sy }, shot.dir, striker.radius, pieces);
  const len = Math.hypot(pv.point.x - sx, pv.point.y - sy);
  const step = 18;
  g.fillStyle(col, 0.9);
  for (let d = striker.radius + 10; d < len; d += step) g.fillCircle(sx + shot.dir.x * d, sy + shot.dir.y * d, 3);

  g.fillStyle(col, 0.14).fillCircle(pv.point.x, pv.point.y, striker.radius);
  g.lineStyle(3, col, 0.8).strokeCircle(pv.point.x, pv.point.y, striker.radius);
  g.fillStyle(col, 0.9).fillCircle(pv.point.x, pv.point.y, 3.5);
  if (pv.target) {
    const { dir } = pv.target;
    const x0 = pv.point.x + dir.x * striker.radius, y0 = pv.point.y + dir.y * striker.radius;
    const x1 = x0 + dir.x * 80, y1 = y0 + dir.y * 80;
    g.lineStyle(4, PAL.gold, 0.95).lineBetween(x0, y0, x1, y1);
    const ax = -dir.y, ay = dir.x;
    g.fillStyle(PAL.gold, 0.95).fillTriangle(x1 + dir.x * 14, y1 + dir.y * 14, x1 + ax * 8, y1 + ay * 8, x1 - ax * 8, y1 - ay * 8);
  }

  // Potencia: anillo alrededor del striker
  const R = striker.radius + 12;
  g.lineStyle(6, PAL.ink, 0.12).strokeCircle(sx, sy, R);
  g.lineStyle(6, shot.power > 0.85 ? PAL.bad : PAL.gold, 0.95).beginPath();
  g.arc(sx, sy, R, -Math.PI / 2, -Math.PI / 2 + shot.power * Math.PI * 2, false);
  g.strokePath();
}
