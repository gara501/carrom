import Phaser from 'phaser';
import {
  BOARD, SHOT, baselinePosition, projectOnBaseline, shotFromPull, getBaseline,
  type CarromWorld, type ShotParams, type Side, type Vec2,
} from '@carrom/core';

export type InputMode = 'idle' | 'move' | 'aim';

export interface StrikerInputOptions {
  world: CarromWorld;
  /** Convierte un puntero de Phaser a coordenadas de tablero (mm). */
  toWorld: (p: Phaser.Input.Pointer) => Vec2;
  /** Línea base activa del jugador en turno. */
  side: () => Side;
  onShoot: (shot: ShotParams) => void;
}

/**
 * Gestiona colocar el striker y apuntar/cargar el tiro. No simula nada:
 * solo mueve el striker antes del tiro y avisa con onShoot.
 */
export class StrikerInput {
  mode: InputMode = 'idle';
  /** Posición a lo largo de la línea base, 0..1. */
  t = 0.5;
  /** Vector puntero -> striker mientras se apunta (dirección y potencia del tiro). */
  pull?: Vec2;
  enabled = true;

  private opts: StrikerInputOptions;
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

  constructor(private scene: Phaser.Scene, opts: StrikerInputOptions) {
    this.opts = opts;
    scene.input.on('pointerdown', this.down, this);
    scene.input.on('pointermove', this.move, this);
    scene.input.on('pointerup', this.up, this);
    scene.input.on('pointerupoutside', this.up, this);
    this.keys = scene.input.keyboard?.createCursorKeys();
    scene.input.keyboard?.on('keydown-ESC', () => this.cancel());
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.down, this);
      scene.input.off('pointermove', this.move, this);
      scene.input.off('pointerup', this.up, this);
      scene.input.off('pointerupoutside', this.up, this);
    });
  }

  /** Coloca el striker en el centro de la línea base (inicio de turno). */
  placeAtCenter() {
    this.t = 0.5;
    this.cancel();
    const p = baselinePosition(this.opts.side(), this.t);
    this.opts.world.addStriker(p.x, p.y);
  }

  /** ¿El striker está en una posición legal (sin solapar piezas)? */
  isPlacementValid(): boolean {
    const s = this.opts.world.getStriker();
    return !!s && !this.opts.world.isOverlapping(s, s.radius);
  }

  cancel() {
    this.mode = 'idle';
    this.pull = undefined;
  }

  /** Llamar cada frame: movimiento fino con las flechas. */
  update(delta: number) {
    if (!this.enabled || this.mode === 'aim' || !this.keys) return;
    const dir = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    if (dir) this.setT(this.t + dir * (delta / 1000) * 0.5);
  }

  private setT(t: number) {
    this.t = Math.min(1, Math.max(0, t));
    const p = baselinePosition(this.opts.side(), this.t);
    this.opts.world.moveStriker(p.x, p.y);
  }

  private nearBaselineStrip(w: Vec2): boolean {
    const b = getBaseline(this.opts.side());
    const along = b.inward;
    // distancia al plano de la línea base (componente a lo largo de `inward`)
    const d = Math.abs((w.x - b.from.x) * along.x + (w.y - b.from.y) * along.y);
    return d <= BOARD.strikerDiameter * 1.2;
  }

  private down(p: Phaser.Input.Pointer, over?: Phaser.GameObjects.GameObject[]) {
    if (!this.enabled || (over && over.length > 0)) return;
    const s = this.opts.world.getStriker();
    if (!s) return;
    const w = this.opts.toWorld(p);
    if (Math.hypot(w.x - s.x, w.y - s.y) <= s.radius * 1.8) {
      this.mode = 'aim';
      this.pull = { x: s.x - w.x, y: s.y - w.y };
    } else if (this.nearBaselineStrip(w)) {
      this.mode = 'move';
      this.setT(projectOnBaseline(this.opts.side(), w));
    }
  }

  private move(p: Phaser.Input.Pointer) {
    if (!this.enabled) return;
    const s = this.opts.world.getStriker();
    if (!s) return;
    const w = this.opts.toWorld(p);
    if (this.mode === 'aim') this.pull = { x: s.x - w.x, y: s.y - w.y };
    else if (this.mode === 'move') this.setT(projectOnBaseline(this.opts.side(), w));
  }

  private up() {
    if (this.mode === 'aim' && this.pull) {
      const shot = shotFromPull(this.pull);
      const valid = this.isPlacementValid();
      this.cancel();
      if (shot && valid) this.opts.onShoot(shot);
      return;
    }
    this.cancel();
  }

  /** Para dibujar: parámetros del tiro actual (si se está apuntando y es válido). */
  currentShot(): ShotParams | null {
    return this.mode === 'aim' && this.pull ? shotFromPull(this.pull) : null;
  }

  readonly maxDrag = SHOT.maxDrag;
}
