import type Phaser from 'phaser';
import { BOARD, POCKETS, type PieceKind } from '@carrom/core';
import { PAL } from '../theme';
import { drawPiece } from './PieceRenderer';

interface PocketAnim { x: number; y: number; kind: PieceKind; t0: number }
const DUR = 420;

/** Efectos: la pieza se hunde en el bolsillo y deja una onda. */
export class Fx {
  private anims: PocketAnim[] = [];

  addPocket(pocket: number, kind: PieceKind, now: number) {
    const p = POCKETS[pocket];
    this.anims.push({ x: p.x, y: p.y, kind, t0: now });
  }

  clear() { this.anims = []; }

  draw(g: Phaser.GameObjects.Graphics, now: number) {
    this.anims = this.anims.filter((a) => now - a.t0 < DUR);
    for (const a of this.anims) {
      const t = (now - a.t0) / DUR;
      const r = BOARD.coinDiameter / 2;
      const rr = kindRadius(a.kind);
      drawPiece(g, a.kind, a.x, a.y, rr, 1 - t * t, 1 - t);
      const ring = BOARD.pocketDiameter / 2 + t * 34;
      g.lineStyle(4 * (1 - t), PAL.blue, 0.8 * (1 - t)).strokeCircle(a.x, a.y, ring);
      void r;
    }
  }
}

const kindRadius = (k: PieceKind) => (k === 'striker' ? BOARD.strikerDiameter : BOARD.coinDiameter) / 2;
