import Phaser from 'phaser';
import { POCKETS, type PieceKind } from '@carrom/core';
import { PAL, u } from '../theme';

/** Texturas pequeñas (generadas, sin archivos) para las partículas. Llamar una vez en BootScene. */
export function makeParticleTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('p_dot')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // punto suave: tres discos concéntricos
  g.fillStyle(0xffffff, 0.25).fillCircle(16, 16, 16);
  g.fillStyle(0xffffff, 0.5).fillCircle(16, 16, 11);
  g.fillStyle(0xffffff, 1).fillCircle(16, 16, 6);
  g.generateTexture('p_dot', 32, 32);
  g.clear();
  g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, 16, 9, 2);
  g.generateTexture('p_conf', 16, 9);
  g.clear();
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, r = i % 2 ? 7 : 16;
    pts.push(new Phaser.Math.Vector2(16 + Math.cos(a) * r, 16 + Math.sin(a) * r));
  }
  g.fillStyle(0xffffff, 1).fillPoints(pts, true);
  g.generateTexture('p_star', 32, 32);
  g.destroy();
}

const KIND_COLORS: Record<PieceKind, number[]> = {
  white: [0x9fd3f0, 0x1e9fd8, 0xffffff],
  black: [0x2b3a55, 0x5b6b86, 0x8a93a6],
  queen: [PAL.queen, PAL.gold, 0xffffff],
  striker: [PAL.bad, 0xff9a9d],
};

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/**
 * Partículas sutiles: choques, embolsadas, y celebración/derrota.
 * Los efectos del tablero viven dentro de `root` (unidades en mm); los de pantalla, sobre el modal.
 */
export class Particles {
  private hitE: Emitter;
  private pocketE: Emitter;
  private starE: Emitter;
  private confettiE?: Emitter;
  private rainE?: Emitter;

  constructor(private scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
    this.hitE = scene.add.particles(0, 0, 'p_dot', {
      emitting: false, lifespan: { min: 220, max: 420 }, speed: { min: 50, max: 200 }, angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 0.75, end: 0 },
    });
    this.pocketE = scene.add.particles(0, 0, 'p_dot', {
      emitting: false, lifespan: { min: 400, max: 800 }, speed: { min: 70, max: 260 }, angle: { min: 0, max: 360 },
      scale: { start: 0.75, end: 0 }, alpha: { start: 0.95, end: 0 }, gravityY: 0,
    });
    this.starE = scene.add.particles(0, 0, 'p_star', {
      emitting: false, lifespan: { min: 600, max: 1000 }, speed: { min: 50, max: 190 }, angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, tint: [PAL.gold, 0xffffff],
    });
    root.add([this.hitE, this.pocketE, this.starE]);
  }

  /** Choque pieza-pieza o pieza-banda: soplo corto, más grande cuanto más fuerte. */
  hit(x: number, y: number, speed: number, wall: boolean) {
    if (speed < 250) return;
    const n = Math.min(7, 2 + Math.floor(speed / 600));
    this.hitE.setParticleTint(wall ? 0x8a93a6 : 0x5b6b86);
    this.hitE.explode(n, x, y);
  }

  /** Pieza embolsada: chispas del color de la pieza; estrellas doradas si suma (no es falta). */
  pocket(pocket: number, kind: PieceKind) {
    const p = POCKETS[pocket];
    const cols = KIND_COLORS[kind];
    for (const c of cols) { this.pocketE.setParticleTint(c); this.pocketE.explode(kind === 'striker' ? 6 : 5, p.x, p.y); }
    if (kind !== 'striker') this.starE.explode(kind === 'queen' ? 7 : 3, p.x, p.y);
  }

  /** Confeti desde arriba; `big` para fin de partida. */
  celebrate(big: boolean) {
    const { width: W } = this.scene.scale;
    this.confettiE ??= this.scene.add.particles(0, 0, 'p_conf', {
      emitting: false, x: { min: 0, max: W }, y: -u(10), lifespan: 3800,
      speedX: { min: -u(60), max: u(60) }, speedY: { min: u(120), max: u(300) }, gravityY: u(60),
      rotate: { min: 0, max: 360 }, angle: 0, scale: { min: u(0.55), max: u(1) },
      alpha: { start: 1, end: 0.8 }, tint: [PAL.gold, PAL.blue, PAL.queen, PAL.striker, 0xffffff],
    }).setDepth(950);
    const waves = big ? 9 : 3;
    this.scene.time.addEvent({ delay: 140, repeat: waves - 1, callback: () => this.confettiE?.explode(big ? 14 : 12) });
  }

  /** Derrota: gotas apagadas que caen despacio. */
  sad() {
    const { width: W } = this.scene.scale;
    this.rainE ??= this.scene.add.particles(0, 0, 'p_dot', {
      emitting: false, x: { min: 0, max: W }, y: -u(10), lifespan: 3000,
      speedY: { min: u(70), max: u(150) }, speedX: 0, scale: { min: u(0.3), max: u(0.55) },
      alpha: { start: 0.55, end: 0 }, tint: [0x5b6b86, 0x8a93a6, 0x6d86a8],
    }).setDepth(950);
    this.scene.time.addEvent({ delay: 160, repeat: 9, callback: () => this.rainE?.explode(8) });
  }
}
