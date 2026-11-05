import Phaser from 'phaser';
import { COINS_PER_COLOR, MATCH_RULES, type MatchState, type PlayerId } from '@carrom/core';
import { PAL, texScale, u } from '../theme';
import { addText } from './widgets';
import type { Avatar, Names } from './messages';

/**
 * Cabecera: tarjeta de cada jugador (marcador, bandeja de 9 piezas, reina) y datos del tablero.
 * Se reconstruye solo cuando cambia algo relevante.
 */
export class Scoreboard {
  readonly container: Phaser.GameObjects.Container;
  private key = '';
  private match?: MatchState;
  /** Altura ocupada en px de canvas. */
  height = 0;
  private cards: { x: number; y: number; w: number; h: number }[] = [];
  private prevFilled = { white: 0, black: 0 };
  private prevScores: [number, number] = [0, 0];

  constructor(private scene: Phaser.Scene, private names: Names) {
    this.container = scene.add.container(0, 0).setDepth(100);
  }

  private static keyOf(m: MatchState, w: number) {
    const b = m.board;
    return [w, m.scores, m.boardNumber, b.current, b.pocketed.white, b.pocketed.black, b.queen, b.queenOwner,
      b.owed, b.players[0].color, m.phase].join('|');
  }

  /** Centro de la tarjeta del jugador en px de canvas (destino de las fichas que vuelan al marcador). */
  cardCenter(id: PlayerId) {
    const c = this.cards[id];
    return c ? { x: c.x + c.w / 2, y: c.y + c.h / 2 } : { x: this.scene.scale.width / 2, y: 0 };
  }

  /** Destello breve sobre la tarjeta: llega una ficha embolsada. */
  flash(id: PlayerId) {
    const c = this.cards[id];
    if (!c) return;
    const g = this.scene.add.graphics().setDepth(101);
    g.fillStyle(PAL.gold, 0.5).fillRoundedRect(c.x, c.y, c.w, c.h, u(14));
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
  }

  update(m: MatchState) {
    this.match = m;
    const key = Scoreboard.keyOf(m, this.scene.scale.width);
    if (key === this.key) return;
    this.key = key;
    this.render();
  }

  /** Fuerza la reconstrucción con el estado dado (p. ej. tras un cambio de tamaño). */
  refresh(m: MatchState) { this.key = ''; this.update(m); }

  private render() {
    const m = this.match!;
    const s = this.scene;
    this.container.removeAll(true);
    const W = s.scale.width;
    const margin = u(12), gap = u(10);
    const cardH = u(78);
    const narrow = W < u(560);
    const centerW = narrow ? 0 : Math.min(u(150), W * 0.22);
    const cardW = Math.min(u(330), (W - margin * 2 - gap * (narrow ? 1 : 2) - centerW) / 2);
    this.height = margin + cardH + (narrow ? u(30) : u(10));

    this.cards = [{ x: margin, y: margin, w: cardW, h: cardH }, { x: W - margin - cardW, y: margin, w: cardW, h: cardH }];
    this.card(0, margin, margin, cardW, cardH, m, narrow);
    this.card(1, W - margin - cardW, margin, cardW, cardH, m, narrow);
    this.prevFilled = { white: m.board.pocketed.white, black: m.board.pocketed.black };
    this.prevScores = [m.scores[0], m.scores[1]];

    // Centro (o línea bajo las tarjetas en pantallas estrechas): tablero y objetivo
    const cx = W / 2;
    const label = m.boardNumber > MATCH_RULES.maxBoards ? 'TABLERO EXTRA' : `TABLERO ${m.boardNumber}/${MATCH_RULES.maxBoards}`;
    if (narrow) {
      this.container.add(addText(s, cx, margin + cardH + u(17), `${label}  ·  a ${MATCH_RULES.targetPoints} puntos`, 11, { color: '#2b3a55' }));
    } else {
      const cy = margin + cardH / 2;
      this.container.add([
        addText(s, cx, cy - u(10), label, 12, { color: '#2b3a55' }),
        addText(s, cx, cy + u(10), `a ${MATCH_RULES.targetPoints} puntos`, 11, { color: '#5b6b86' }),
      ]);
    }
  }

  private card(id: PlayerId, x: number, y: number, w: number, h: number, m: MatchState, narrow = false) {
    const s = this.scene;
    const b = m.board;
    const color = b.players[id].color;
    const active = m.phase === 'board' && b.current === id;
    // Capas: resaltado de turno -> panel -> contenido (discos, bandeja, estrella, textos)
    const glow = s.add.graphics();
    if (active) glow.fillStyle(PAL.blue, 1).fillRoundedRect(x - u(4), y - u(4), w + u(8), h + u(8), u(16));
    const ts = texScale();
    const panel = s.add.nineslice(x + w / 2, y + h / 2, 'panel_white', undefined, w / ts, h / ts, 30, 30, 30, 30).setScale(ts);
    const g = s.add.graphics();
    this.container.add([glow, panel, g]);

    const coinFill = color === 'white' ? PAL.coinWhite : PAL.coinBlack;
    const coinEdge = color === 'white' ? 0xc7d1e2 : 0x1a2336;
    const cr = u(13);
    g.fillStyle(coinFill, 1).fillCircle(x + u(26), y + u(26), cr);
    g.lineStyle(u(2), coinEdge, 1).strokeCircle(x + u(26), y + u(26), cr);

    this.avatar(g, x + u(26) + u(11), y + u(26) + u(11), this.names.avatar[id]);

    const debt = b.owed[id] ? `  debe ${b.owed[id]}` : '';
    const name = addText(s, x + u(48), y + u(26), `${narrow ? this.names.short[id] : this.names.card[id]}${debt}`, narrow ? 13 : 12, { origin: [0, 0.5], color: b.owed[id] ? '#d94f4f' : '#2b3a55' });
    const score = addText(s, x + w - u(18), y + u(27), String(m.scores[id]), 28, { origin: [1, 0.5] });
    this.container.add([name, score]);
    if (m.scores[id] > this.prevScores[id]) {
      score.setScale(1.7);
      s.tweens.add({ targets: score, scale: 1, duration: 450, ease: 'Back.easeOut' });
    }

    // Bandeja: 9 piezas propias; llenas = embolsadas
    const n = COINS_PER_COLOR;
    const starSpace = u(34);
    const step = Math.min(u(19), (w - u(28) - starSpace) / n);
    const dotR = Math.min(u(5.5), step * 0.32);
    const ty = y + h - u(20);
    const filled = b.pocketed[color];
    for (let i = 0; i < n; i++) {
      const dx = x + u(20) + i * step + dotR;
      if (i < filled && i >= this.prevFilled[color]) {
        // pieza recién embolsada: aparece con un pequeño rebote
        const pop = s.add.graphics({ x: dx, y: ty });
        pop.fillStyle(coinFill, 1).fillCircle(0, 0, dotR);
        pop.lineStyle(u(1.5), coinEdge, 1).strokeCircle(0, 0, dotR);
        pop.setScale(2.4);
        s.tweens.add({ targets: pop, scale: 1, duration: 420, ease: 'Back.easeOut' });
        this.container.add(pop);
      } else if (i < filled) {
        g.fillStyle(coinFill, 1).fillCircle(dx, ty, dotR);
        g.lineStyle(u(1.5), coinEdge, 1).strokeCircle(dx, ty, dotR);
      } else {
        g.lineStyle(u(1.5), 0xb9c4d8, 1).strokeCircle(dx, ty, dotR);
      }
    }

    // Reina: dorada si la cubrió este jugador; parpadea si está pendiente de cubrir
    const sx = x + w - u(22);
    const covered = b.queen === 'covered' && b.queenOwner === id;
    const pending = b.queen === 'pending' && b.queenOwner === id;
    const mine = covered || pending;
    const star = s.add.image(sx, ty, mine ? 'star_yellow' : 'star_grey').setAlpha(mine ? 1 : 0.35);
    star.setDisplaySize(u(18), u(17));
    this.container.add(star);
    if (pending) s.tweens.add({ targets: star, alpha: 0.35, yoyo: true, repeat: -1, duration: 420 });
  }

  /** Insignia del jugador (persona o robot) pegada al disco de su color. */
  private avatar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, kind: Avatar) {
    const r = u(8.5), ink = PAL.ink;
    g.fillStyle(0xe3eefb, 1).fillCircle(cx, cy, r);
    g.lineStyle(u(1.5), ink, 1).strokeCircle(cx, cy, r);
    if (kind === 'person') {
      g.fillStyle(ink, 1).fillCircle(cx, cy - u(2), u(2.4));
      g.beginPath().arc(cx, cy + u(5.2), u(4.4), Math.PI, 0).closePath().fillPath();
    } else {
      g.fillStyle(ink, 1).fillRoundedRect(cx - u(4.2), cy - u(2.6), u(8.4), u(6.4), u(1.4));
      g.lineStyle(u(1.2), ink, 1).lineBetween(cx, cy - u(2.6), cx, cy - u(5)).strokeCircle(cx, cy - u(5.3), u(0.7));
      g.fillStyle(0xe3eefb, 1).fillCircle(cx - u(1.8), cy + u(0.3), u(1)).fillCircle(cx + u(1.8), cy + u(0.3), u(1));
    }
  }
}
