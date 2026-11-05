import type Phaser from 'phaser';
import type { PieceKind, PieceState } from '@carrom/core';
import { PAL } from '../theme';

export interface PieceStyle { fill: number; edge: number; ring: number; ringAlpha: number }

export const PIECE_STYLE: Record<PieceKind, PieceStyle> = {
  white: { fill: PAL.coinWhite, edge: 0xc2cde0, ring: 0xdde5f1, ringAlpha: 1 },
  black: { fill: PAL.coinBlack, edge: 0x182236, ring: 0x6a7ea6, ringAlpha: 0.7 },
  queen: { fill: PAL.queen, edge: 0xd24b4b, ring: 0xffe0e0, ringAlpha: 0.95 },
  striker: { fill: PAL.striker, edge: 0x1580b8, ring: 0xffffff, ringAlpha: 0.9 },
};

/** Paleta de relieve de cada pieza: canto, cara en sombra, cara iluminada, cúpula y anillo grabado. */
interface Relief { rim: number; shade: number; lit: number; dome: number; ringShadow: number; ringLight: number; arcLight: number; arcShade: number }

const RELIEF: Record<PieceKind, Relief> = {
  white: { rim: 0x9aabc8, shade: 0xdfe7f3, lit: 0xf6f9fd, dome: 0xffffff, ringShadow: 0xb4c2da, ringLight: 0xffffff, arcLight: 0xffffff, arcShade: 0x8294b4 },
  black: { rim: 0x121a2b, shade: 0x243149, lit: 0x32436a, dome: 0x40527c, ringShadow: 0x141c2e, ringLight: 0x7488b0, arcLight: 0x9db0d6, arcShade: 0x05080f },
  queen: { rim: 0xc04242, shade: 0xe65a5a, lit: 0xff6b6b, dome: 0xff8d8d, ringShadow: 0xc04242, ringLight: 0xffe3e3, arcLight: 0xffffff, arcShade: 0x8c2020 },
  striker: { rim: 0x1580b8, shade: 0x2398d3, lit: 0x2aa5e8, dome: 0x58c2f4, ringShadow: 0x1580b8, ringLight: 0xffffff, arcLight: 0xffffff, arcShade: 0x0c5a85 },
};
const RELIEF_BAD: Relief = { rim: 0xa02a2f, shade: 0xd8454a, lit: 0xe5484d, dome: 0xf06b70, ringShadow: 0xa02a2f, ringLight: 0xffd6d8, arcLight: 0xffffff, arcShade: 0x701a1e };

/** Disco con relieve: canto oscuro, cara abombada con luz arriba-izquierda y anillo grabado. */
function drawRelief(g: Phaser.GameObjects.Graphics, x: number, y: number, R: number, s: number, a: number, k: Relief) {
  g.fillStyle(k.rim, a).fillCircle(x, y, R);
  g.fillStyle(k.shade, a).fillCircle(x, y, R * 0.9);
  g.fillStyle(k.lit, a).fillCircle(x - R * 0.06, y - R * 0.08, R * 0.82);
  g.fillStyle(k.dome, a).fillCircle(x - R * 0.12, y - R * 0.15, R * 0.62);
  const r = R * 0.58, w = 2 * s;
  g.lineStyle(w, k.ringShadow, a).strokeCircle(x + w * 0.35, y + w * 0.45, r);
  g.lineStyle(w * 0.8, k.ringLight, a * 0.9).strokeCircle(x - w * 0.3, y - w * 0.35, r);
  g.lineStyle(2 * s, k.arcLight, 0.85 * a).beginPath().arc(x, y, R * 0.9, Math.PI * 1.05, Math.PI * 1.45).strokePath();
  g.lineStyle(2 * s, k.arcShade, 0.55 * a).beginPath().arc(x, y, R * 0.93, Math.PI * 0.05, Math.PI * 0.45).strokePath();
}

/**
 * Dibuja una pieza con relieve y sombra suave. `scale` anima la aparición/caída.
 * `vel` (mm/s) alarga la sombra hacia atrás y deja estela al striker.
 */
export function drawPiece(
  g: Phaser.GameObjects.Graphics, kind: PieceKind, x: number, y: number, radius: number,
  scale = 1, alpha = 1, invalid = false, vel?: { x: number; y: number },
) {
  if (scale <= 0.01 || alpha <= 0) return;
  const R = radius * scale;
  const sp = vel ? Math.hypot(vel.x, vel.y) : 0;
  if (vel && sp > 120) {
    const ux = vel.x / sp, uy = vel.y / sp;
    const len = Math.min(R * 1.6, sp * 0.03);
    // sombra alargada hacia atrás
    for (let i = 3; i >= 1; i--) {
      const f = i / 3;
      g.fillStyle(PAL.ink, 0.05 * alpha).fillCircle(x - ux * len * f + 1, y - uy * len * f + 4 * scale, R * (1.02 - 0.08 * f));
    }
    // estela del striker
    if (kind === 'striker') {
      const tl = Math.min(R * 3.2, sp * 0.06);
      for (let i = 4; i >= 1; i--) {
        const f = i / 4;
        g.fillStyle(PAL.striker, 0.2 * (1 - f) * alpha + 0.04).fillCircle(x - ux * tl * f, y - uy * tl * f, R * (1 - 0.5 * f));
      }
    }
  }
  g.fillStyle(PAL.ink, 0.1 * alpha).fillCircle(x + 1, y + 4 * scale, R * 1.03);
  g.fillStyle(PAL.ink, 0.07 * alpha).fillCircle(x + 2, y + 7 * scale, R * 1.12);
  drawRelief(g, x, y, R, scale, alpha, invalid ? RELIEF_BAD : RELIEF[kind]);
  if (kind === 'striker') g.fillStyle(0xffffff, 0.5 * alpha).fillCircle(x - R * 0.35, y - R * 0.38, R * 0.14);
}

const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Dibuja todas las piezas; las nuevas "brotan" con un pequeño rebote. */
export class PieceRenderer {
  private born = new Map<number, number>();
  private prev = new Map<number, { x: number; y: number; t: number; vx: number; vy: number }>();

  draw(g: Phaser.GameObjects.Graphics, pieces: readonly PieceState[], now: number, strikerValid: boolean) {
    const seen = new Set<number>();
    for (const p of pieces) {
      seen.add(p.id);
      if (!this.born.has(p.id)) this.born.set(p.id, now);
      const t = Math.min(1, (now - this.born.get(p.id)!) / 300);
      const s = t >= 1 ? 1 : Math.max(0.01, easeOutBack(t));
      // velocidad suavizada a partir del desplazamiento entre frames (mm/s)
      const pv = this.prev.get(p.id);
      let vx = 0, vy = 0;
      if (pv && now > pv.t) {
        const dt = (now - pv.t) / 1000;
        vx = pv.vx * 0.5 + ((p.x - pv.x) / dt) * 0.5;
        vy = pv.vy * 0.5 + ((p.y - pv.y) / dt) * 0.5;
        if (Math.hypot(vx, vy) > 6000) { vx = 0; vy = 0; } // salto (colocación), no movimiento
      }
      this.prev.set(p.id, { x: p.x, y: p.y, t: now, vx, vy });
      drawPiece(g, p.kind, p.x, p.y, p.radius, s, 1, p.kind === 'striker' && !strikerValid, { x: vx, y: vy });
    }
    for (const id of this.born.keys()) if (!seen.has(id)) { this.born.delete(id); this.prev.delete(id); }
  }
}
