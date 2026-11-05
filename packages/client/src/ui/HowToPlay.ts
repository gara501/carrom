import Phaser from 'phaser';
import { PAL, u } from '../theme';
import type { InfoContent } from './InfoOverlay';
import { addText } from './widgets';

const INK: number = PAL.ink, SOFT = 0x5b6b86;

type G = Phaser.GameObjects.Graphics;

function disc(g: G, x: number, y: number, r: number, fill: number, rim = INK) {
  g.fillStyle(0x000000, 0.12).fillCircle(x + r * 0.08, y + r * 0.16, r);
  g.fillStyle(fill, 1).fillCircle(x, y, r);
  g.lineStyle(Math.max(1, r * 0.1), rim, 0.9).strokeCircle(x, y, r);
  g.lineStyle(Math.max(1, r * 0.07), 0xffffff, 0.55).strokeCircle(x, y, r * 0.62);
}
function dots(g: G, x1: number, y1: number, x2: number, y2: number, step: number, r: number, color: number, a = 0.9) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(d / step);
  g.fillStyle(color, a);
  for (let i = 0; i <= n; i++) g.fillCircle(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, r);
}
function arrowHead(g: G, x: number, y: number, ang: number, size: number, color: number) {
  const p = (a: number, l: number) => new Phaser.Math.Vector2(x + Math.cos(ang + a) * l, y + Math.sin(ang + a) * l);
  g.fillStyle(color, 1).fillTriangle(x + Math.cos(ang) * size, y + Math.sin(ang) * size, p(2.5, size).x, p(2.5, size).y, p(-2.5, size).x, p(-2.5, size).y);
}
function star(g: G, x: number, y: number, r: number, color: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  g.fillStyle(color, 1).fillPoints(pts, true);
}
/** Indicador de toque (dedo): anillos concéntricos. */
function touch(g: G, x: number, y: number, r: number) {
  g.fillStyle(PAL.blue, 0.18).fillCircle(x, y, r * 1.9);
  g.fillStyle(PAL.blue, 0.28).fillCircle(x, y, r * 1.3);
  g.fillStyle(PAL.blue, 0.9).fillCircle(x, y, r * 0.7);
  g.lineStyle(r * 0.18, 0xffffff, 0.9).strokeCircle(x, y, r * 0.7);
}

/** Dibuja la ilustración del paso `i` (0..2) dentro de una caja w×h con origen (ox, oy). */
function drawStep(g: G, i: number, ox: number, oy: number, w: number, h: number) {
  g.fillStyle(0xfbf8f1, 1).fillRoundedRect(ox, oy, w, h, u(14));
  g.lineStyle(u(3), PAL.blue, 0.55).strokeRoundedRect(ox, oy, w, h, u(14));
  const X = (f: number) => ox + w * f, Y = (f: number) => oy + h * f;
  const R = h * 0.09; // radio de las fichas
  if (i === 0) {
    // pista del jugador y striker deslizándose a izquierda/derecha
    g.fillStyle(PAL.tint, 1).fillRoundedRect(X(0.08), Y(0.6), w * 0.84, h * 0.22, h * 0.11);
    g.lineStyle(u(2), PAL.blue, 0.8).strokeRoundedRect(X(0.08), Y(0.6), w * 0.84, h * 0.22, h * 0.11);
    g.fillStyle(PAL.striker, 0.25).fillCircle(X(0.27), Y(0.71), R * 1.15).fillCircle(X(0.73), Y(0.71), R * 1.15);
    disc(g, X(0.5), Y(0.71), R * 1.15, PAL.striker, 0x1a7fb8);
    arrowHead(g, X(0.33), Y(0.71), Math.PI, R * 0.9, INK);
    arrowHead(g, X(0.67), Y(0.71), 0, R * 0.9, INK);
    g.lineStyle(u(3), INK, 0.8).lineBetween(X(0.33), Y(0.71), X(0.4), Y(0.71)).lineBetween(X(0.6), Y(0.71), X(0.67), Y(0.71));
    touch(g, X(0.5), Y(0.71), R * 0.9);
    // monedas del centro, como contexto
    disc(g, X(0.45), Y(0.22), R, 0xffffff); disc(g, X(0.55), Y(0.22), R, PAL.coinBlack); disc(g, X(0.5), Y(0.34), R, PAL.queen);
  } else if (i === 1) {
    const sx = X(0.4), sy = Y(0.72), px = X(0.3), py = Y(0.92);
    // línea de apuntado (al lado contrario del arrastre) hacia las monedas
    const dx = sx - px, dy = sy - py, len = Math.hypot(dx, dy);
    const tx = sx + (dx / len) * h * 0.62, ty = sy + (dy / len) * h * 0.62;
    dots(g, sx, sy, tx, ty, u(10), u(2.2), PAL.blue);
    disc(g, X(0.62), Y(0.25), R, 0xffffff); disc(g, X(0.71), Y(0.2), R, PAL.coinBlack); disc(g, X(0.7), Y(0.34), R, PAL.queen);
    // arrastre hacia atrás
    g.lineStyle(u(4), INK, 0.75).lineBetween(sx, sy, px, py);
    disc(g, sx, sy, R * 1.15, PAL.striker, 0x1a7fb8);
    touch(g, px, py, R * 0.9);
    // barra de potencia
    g.fillStyle(0xe3eefb, 1).fillRoundedRect(X(0.82), Y(0.45), w * 0.06, h * 0.45, u(5));
    g.fillStyle(PAL.gold, 1).fillRoundedRect(X(0.82), Y(0.62), w * 0.06, h * 0.28, u(5));
  } else {
    // el striker golpea y la ficha cae al bolsillo
    const px = X(0.84), py = Y(0.2);
    g.fillStyle(PAL.pocket, 1).fillCircle(px, py, R * 1.5);
    g.lineStyle(u(2.5), PAL.blue, 0.9).strokeCircle(px, py, R * 1.8);
    dots(g, X(0.52), Y(0.46), px, py, u(11), u(2), SOFT, 0.7);
    disc(g, X(0.52), Y(0.46), R, 0xffffff);
    // estela del striker
    for (let k = 4; k >= 1; k--) g.fillStyle(PAL.striker, 0.12 * (5 - k)).fillCircle(X(0.3 - k * 0.04), Y(0.84 + k * 0.03), R * (1.15 - k * 0.12));
    disc(g, X(0.4), Y(0.66), R * 1.15, PAL.striker, 0x1a7fb8);
    star(g, X(0.72), Y(0.38), R * 0.9, PAL.gold); star(g, X(0.9), Y(0.42), R * 0.6, PAL.gold); star(g, X(0.82), Y(0.55), R * 0.5, 0xffffff);
  }
}

function mouseIcon(g: G, x: number, y: number) {
  const w = u(20), h = u(30);
  g.fillStyle(0xffffff, 1).fillRoundedRect(x, y, w, h, u(9));
  g.fillStyle(PAL.blue, 1).fillRoundedRect(x, y, w / 2, h * 0.42, { tl: u(9), tr: 0, bl: 0, br: 0 });
  g.lineStyle(u(2), INK, 1).strokeRoundedRect(x, y, w, h, u(9)).lineBetween(x + w / 2, y, x + w / 2, y + h * 0.42).lineBetween(x, y + h * 0.42, x + w, y + h * 0.42);
}

const STEPS = [
  { t: 'COLOCA', d: 'Desliza el striker sobre tu pista.' },
  { t: 'APUNTA', d: 'Arrastra hacia atrás: la línea marca la dirección y la barra, la fuerza.' },
  { t: 'SUELTA', d: 'Al soltar, el striker sale disparado. ¡Embolsa tus fichas!' },
];

/** Pantalla de controles: tres pasos ilustrados y cómo se hace con mouse o con el dedo. */
export function howToPlayContent(wide: boolean): InfoContent {
  const cw = u(220), ch = u(150), pad = u(14);
  const rowH = u(132), rowW = u(420);
  const footH = wide ? u(52) : u(84);
  const w = wide ? cw * 3 + pad * 2 : rowW;
  const h = (wide ? ch + u(96) : rowH * 3 + pad * 2) + pad + footH;
  return {
    w, h,
    build(scene, c) {
      const g = scene.add.graphics();
      c.add(g);
      STEPS.forEach((s, i) => {
        if (wide) {
          const x = i * (cw + pad);
          drawStep(g, i, x, 0, cw, ch);
          g.fillStyle(PAL.blue, 1).fillCircle(x + u(18), u(18), u(13));
          c.add(addText(scene, x + u(18), u(18), `${i + 1}`, 14, { color: '#ffffff' }));
          c.add(addText(scene, x + cw / 2, ch + u(18), s.t, 15, { color: PAL.inkCss }));
          c.add(addText(scene, x + cw / 2, ch + u(36), s.d, 12, { origin: [0.5, 0], wrap: cw - u(8), align: 'center', color: PAL.inkSoftCss }));
        } else {
          const y = i * (rowH + pad), iw = u(170), ih = rowH - u(8);
          drawStep(g, i, 0, y, iw, ih);
          g.fillStyle(PAL.blue, 1).fillCircle(u(16), y + u(16), u(12));
          c.add(addText(scene, u(16), y + u(16), `${i + 1}`, 13, { color: '#ffffff' }));
          c.add(addText(scene, iw + u(14), y + u(18), s.t, 15, { origin: [0, 0.5], color: PAL.inkCss }));
          c.add(addText(scene, iw + u(14), y + u(34), s.d, 12, { origin: [0, 0], wrap: rowW - iw - u(18), color: PAL.inkSoftCss }));
        }
      });
      // Mouse o dedo
      const fy = wide ? ch + u(96) + pad : rowH * 3 + pad * 3;
      const chip = (x: number, y: number, kind: 'mouse' | 'touch', text: string) => {
        if (kind === 'mouse') mouseIcon(g, x, y); else touch(g, x + u(10), y + u(15), u(9));
        c.add(addText(scene, x + u(34), y + u(15), text, 13, { origin: [0, 0.5], color: PAL.inkCss }));
      };
      if (wide) {
        chip(w * 0.1, fy, 'mouse', 'Mouse: clic y arrastra');
        chip(w * 0.55, fy, 'touch', 'Móvil: toca y arrastra con el dedo');
      } else {
        chip(u(40), fy, 'mouse', 'Mouse: clic y arrastra');
        chip(u(40), fy + u(42), 'touch', 'Móvil: toca y arrastra con el dedo');
      }
    },
  };
}
