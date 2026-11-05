import Phaser from 'phaser';
import type { MatchState } from '@carrom/core';
import { PAL, u } from '../theme';
import type { InfoContent } from './InfoOverlay';
import type { Names } from './messages';
import { addText } from './widgets';

function star(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  g.fillStyle(color, 1).fillPoints(pts, true);
}

/** Copa dorada (victoria) o medalla apagada (derrota). */
function drawTrophy(g: Phaser.GameObjects.Graphics, cx: number, y: number, won: boolean) {
  const gold = won ? PAL.gold : 0xb7c0d0, dark = won ? 0xe0a020 : 0x8f9bb0, light = won ? 0xffe38a : 0xdde3ee;
  const s = u(1);
  // asas
  g.lineStyle(5 * s, dark, 1).strokeCircle(cx - 30 * s, y + 24 * s, 12 * s).strokeCircle(cx + 30 * s, y + 24 * s, 12 * s);
  // copa
  g.fillStyle(dark, 1).fillRoundedRect(cx - 28 * s, y + 6 * s, 56 * s, 12 * s, 4 * s);
  g.fillStyle(gold, 1).beginPath().moveTo(cx - 26 * s, y + 10 * s).lineTo(cx + 26 * s, y + 10 * s).lineTo(cx + 18 * s, y + 52 * s).lineTo(cx - 18 * s, y + 52 * s).closePath().fillPath();
  g.fillStyle(light, 0.8).beginPath().moveTo(cx - 20 * s, y + 14 * s).lineTo(cx - 12 * s, y + 14 * s).lineTo(cx - 8 * s, y + 48 * s).lineTo(cx - 13 * s, y + 48 * s).closePath().fillPath();
  // pie
  g.fillStyle(dark, 1).fillRect(cx - 5 * s, y + 52 * s, 10 * s, 12 * s);
  g.fillStyle(gold, 1).fillRoundedRect(cx - 22 * s, y + 62 * s, 44 * s, 12 * s, 4 * s);
  g.fillStyle(0x000000, 0.1).fillRoundedRect(cx - 22 * s, y + 69 * s, 44 * s, 5 * s, 3 * s);
  if (won) { star(g, cx, y + 30 * s, 9 * s, 0xffffff); star(g, cx - 46 * s, y + 4 * s, 6 * s, PAL.gold); star(g, cx + 48 * s, y + 10 * s, 5 * s, PAL.gold); }
}

/** Fin de partida: copa o medalla, marcador grande y resumen de tableros. */
export function endSummaryContent(m: MatchState, names: Names, won: boolean, reason: string): InfoContent {
  const w = u(360);
  const sub = [
    `Tableros jugados: ${m.boards.length}`,
    `Tableros ganados: ${names.short[0]} ${m.boards.filter((b) => b.winner === 0).length} · ${names.short[1]} ${m.boards.filter((b) => b.winner === 1).length}`,
    `Reinas cubiertas: ${names.short[0]} ${m.boards.filter((b) => b.queenCounted && b.winner === 0).length} · ${names.short[1]} ${m.boards.filter((b) => b.queenCounted && b.winner === 1).length}`,
  ];
  return {
    w, h: u(100) + u(70) + u(60) + sub.length * u(22) + u(8),
    build(scene, c) {
      const g = scene.add.graphics();
      c.add(g);
      drawTrophy(g, w / 2, u(4), won);
      // marcador grande
      const y = u(100);
      c.add(addText(scene, w * 0.25, y + u(20), names.card[0], 12, { color: PAL.inkSoftCss }));
      c.add(addText(scene, w * 0.75, y + u(20), names.card[1], 12, { color: PAL.inkSoftCss }));
      c.add(addText(scene, w * 0.25, y + u(52), String(m.scores[0]), 44, { color: m.scores[0] >= m.scores[1] ? '#1e9fd8' : PAL.inkCss }));
      c.add(addText(scene, w * 0.75, y + u(52), String(m.scores[1]), 44, { color: m.scores[1] > m.scores[0] ? '#1e9fd8' : PAL.inkCss }));
      c.add(addText(scene, w / 2, y + u(52), '—', 30, { color: PAL.inkSoftCss }));
      c.add(addText(scene, w / 2, y + u(96), reason, 12, { color: PAL.inkSoftCss, wrap: w - u(20), align: 'center' }));
      let yy = y + u(70) + u(60);
      for (const l of sub) { c.add(addText(scene, w / 2, yy, l, 12, { color: PAL.inkCss })); yy += u(22); }
    },
  };
}
