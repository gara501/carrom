/**
 * Mundo físico del Carrom sobre matter-js. Sin Phaser, sin DOM: corre igual en
 * navegador y en Node (tests, IA, futuro servidor).
 *
 * Unidades: mm, ms, mm/s. Origen en el centro del tablero.
 * Simulación a paso fijo -> determinista para una misma secuencia de entradas.
 */
import Matter from 'matter-js';
import { BOARD, POCKETS, initialLayout, type CoinSpawn, type Vec2 } from './board';

const { Engine, Bodies, Body, Composite, Events } = Matter;

export type PieceKind = 'white' | 'black' | 'queen' | 'striker';

export interface PhysicsConfig {
  /** Frecuencia del paso fijo. Alta para evitar atravesar piezas a alta velocidad. */
  stepHz: number;
  /** Restitución (Matter usa el máximo de las dos superficies, así que aplica a bandas y piezas). */
  restitution: number;
  /** Desaceleración constante por el talco (mm/s²). */
  frictionDecel: number;
  /** Por debajo de esta velocidad (mm/s) la pieza se detiene. */
  stopSpeed: number;
  /** Velocidad máxima de cualquier pieza (mm/s). */
  maxSpeed: number;
  /** Masas relativas (g). */
  coinMass: number;
  strikerMass: number;
  /** Una pieza cae si la distancia centro-bolsillo <= radio_bolsillo * este factor. */
  pocketCapture: number;
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  stepHz: 480,
  restitution: 0.8,
  frictionDecel: 400,
  stopSpeed: 6,
  maxSpeed: 5000,
  coinMass: 5.5,
  strikerMass: 15,
  pocketCapture: 1,
};

export interface PieceState {
  readonly id: number;
  readonly kind: PieceKind;
  readonly radius: number;
  x: number;
  y: number;
  pocketed: boolean;
}

export interface PocketEvent { pieceId: number; kind: PieceKind; pocket: number }
export interface HitEvent { a: PieceKind | 'wall'; b: PieceKind | 'wall'; speed: number; /** Punto de contacto (mm). */ x: number; y: number }
export interface StepEvents { pocketed: PocketEvent[]; hits: HitEvent[] }

/** Matter expresa la velocidad en "mm por 1/60 s"; convertimos de/hacia mm/s. */
const V_UNIT = 60;
const CIRCLE_SIDES = 48;

interface Piece extends PieceState { body: Matter.Body }

export class CarromWorld {
  readonly config: PhysicsConfig;
  private engine: Matter.Engine;
  private pieceList: Piece[] = [];
  private byBody = new Map<number, Piece>();
  private nextId = 1;
  private acc = 0;
  private resting = true;
  private pendingHits: HitEvent[] = [];

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS, ...config };
    this.engine = Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
      positionIterations: 8,
      velocityIterations: 6,
      enableSleeping: false,
    });
    this.buildWalls();
    Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of e.pairs) {
        const a = this.byBody.get(pair.bodyA.id);
        const b = this.byBody.get(pair.bodyB.id);
        if (!a && !b) continue;
        const va = a ? Body.getVelocity(a.body) : { x: 0, y: 0 };
        const vb = b ? Body.getVelocity(b.body) : { x: 0, y: 0 };
        const speed = Math.hypot(va.x - vb.x, va.y - vb.y) * V_UNIT;
        const sp = pair.collision.supports[0] ?? { x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2, y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2 };
        this.pendingHits.push({ a: a?.kind ?? 'wall', b: b?.kind ?? 'wall', speed, x: sp.x, y: sp.y });
      }
    });
  }

  private buildWalls() {
    const half = BOARD.size / 2;
    const t = 400; // grosor: imposible de atravesar
    const opts = { isStatic: true, restitution: this.config.restitution, friction: 0, label: 'wall' };
    Composite.add(this.engine.world, [
      Bodies.rectangle(0, -half - t / 2, BOARD.size + 2 * t, t, opts),
      Bodies.rectangle(0, half + t / 2, BOARD.size + 2 * t, t, opts),
      Bodies.rectangle(-half - t / 2, 0, t, BOARD.size + 2 * t, opts),
      Bodies.rectangle(half + t / 2, 0, t, BOARD.size + 2 * t, opts),
    ]);
  }

  // ------------------------------------------------------------------ piezas

  /** Piezas que siguen en juego (incluye el striker si está en el tablero). */
  get pieces(): readonly PieceState[] {
    return this.pieceList.filter((p) => !p.pocketed);
  }

  /** Disposición actual de las piezas (sin el striker), lista para `reset()` en otro mundo. */
  snapshotLayout(): CoinSpawn[] {
    return this.pieces.filter((p) => p.kind !== 'striker').map((p) => ({ x: p.x, y: p.y, color: p.kind as CoinSpawn['color'] }));
  }

  /** Reinicia el tablero con la disposición inicial (o una personalizada). */
  reset(layout: readonly CoinSpawn[] = initialLayout()) {
    for (const p of this.pieceList) if (!p.pocketed) Composite.remove(this.engine.world, p.body);
    this.pieceList = [];
    this.byBody.clear();
    this.acc = 0;
    this.resting = true;
    for (const c of layout) this.addPiece(c.color, c.x, c.y);
  }

  addStriker(x: number, y: number): PieceState {
    this.removeStriker();
    return this.addPiece('striker', x, y);
  }

  removeStriker() {
    const s = this.pieceList.find((p) => p.kind === 'striker' && !p.pocketed);
    if (!s) return;
    Composite.remove(this.engine.world, s.body);
    this.byBody.delete(s.body.id);
    this.pieceList = this.pieceList.filter((p) => p !== s);
  }

  getStriker(): PieceState | undefined {
    return this.pieceList.find((p) => p.kind === 'striker' && !p.pocketed);
  }

  /** ¿Un círculo de ese radio en esa posición se solapa con alguna pieza (salvo el striker)? */
  isOverlapping(pos: Vec2, radius: number): boolean {
    return this.pieces.some((p) => p.kind !== 'striker' && Math.hypot(p.x - pos.x, p.y - pos.y) < p.radius + radius);
  }

  /**
   * Devuelve una pieza al tablero en el punto libre más cercano al centro
   * (espiral determinista). Úsalo con el striker ya retirado.
   */
  placeNearCenter(kind: Exclude<PieceKind, 'striker'>): PieceState {
    const r = BOARD.coinDiameter / 2;
    const need = r + 0.5; // holgura para no arrancar solapada
    if (!this.isOverlapping({ x: 0, y: 0 }, need)) return this.addPiece(kind, 0, 0);
    for (let ring = 1; ring <= 40; ring++) {
      const radius = ring * r;
      for (let a = 0; a < 360; a += 15) {
        const rad = ((a - 90) * Math.PI) / 180;
        const pos = { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
        if (!this.isOverlapping(pos, need)) return this.addPiece(kind, pos.x, pos.y);
      }
    }
    return this.addPiece(kind, 0, 0); // inalcanzable en la práctica
  }

  /** Mueve el striker (solo para colocarlo antes del tiro; no usar durante la simulación). */
  moveStriker(x: number, y: number) {
    const s = this.pieceList.find((p) => p.kind === 'striker' && !p.pocketed);
    if (!s) return;
    Body.setPosition(s.body, { x, y });
    s.x = x; s.y = y;
  }

  /** Impulsa el striker con una velocidad en mm/s. */
  shoot(velocity: Vec2) {
    const s = this.pieceList.find((p) => p.kind === 'striker' && !p.pocketed);
    if (!s) return;
    this.setSpeed(s.body, velocity.x, velocity.y);
    this.resting = false;
  }

  private addPiece(kind: PieceKind, x: number, y: number): Piece {
    const radius = (kind === 'striker' ? BOARD.strikerDiameter : BOARD.coinDiameter) / 2;
    const body = Bodies.polygon(x, y, CIRCLE_SIDES, radius, {
      restitution: this.config.restitution,
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      slop: 0.05,
      label: kind,
    });
    Body.setMass(body, kind === 'striker' ? this.config.strikerMass : this.config.coinMass);
    Body.setInertia(body, Infinity); // sin giro: simplifica y es estable
    Composite.add(this.engine.world, body);
    const piece: Piece = { id: this.nextId++, kind, radius, x, y, pocketed: false, body };
    this.pieceList.push(piece);
    this.byBody.set(body.id, piece);
    return piece;
  }

  // -------------------------------------------------------------- simulación

  /** ¿Todas las piezas están detenidas? */
  isResting(): boolean {
    return this.resting;
  }

  /** Avanza dtMs de tiempo real con pasos fijos. Devuelve los eventos ocurridos. */
  advance(dtMs: number): StepEvents {
    const stepMs = 1000 / this.config.stepHz;
    this.acc += Math.min(dtMs, 100);
    const out: StepEvents = { pocketed: [], hits: [] };
    while (this.acc >= stepMs) {
      this.acc -= stepMs;
      this.stepOnce(stepMs, out);
    }
    return out;
  }

  /** Simula hasta que todo se detenga (para IA/tests). Devuelve los eventos acumulados. */
  runUntilRest(maxSeconds = 60): StepEvents {
    const out: StepEvents = { pocketed: [], hits: [] };
    const stepMs = 1000 / this.config.stepHz;
    const maxSteps = Math.ceil((maxSeconds * 1000) / stepMs);
    for (let i = 0; i < maxSteps && !this.resting; i++) this.stepOnce(stepMs, out);
    return out;
  }

  private stepOnce(stepMs: number, out: StepEvents) {
    this.applyFriction(stepMs / 1000);
    Engine.update(this.engine, stepMs);
    this.checkPockets(out);
    for (const p of this.pieceList) {
      if (p.pocketed) continue;
      p.x = p.body.position.x;
      p.y = p.body.position.y;
    }
    out.hits.push(...this.pendingHits);
    this.pendingHits.length = 0;
  }

  private setSpeed(body: Matter.Body, vx: number, vy: number) {
    const max = this.config.maxSpeed;
    const sp = Math.hypot(vx, vy);
    const k = sp > max ? max / sp : 1;
    Body.setVelocity(body, { x: (vx * k) / V_UNIT, y: (vy * k) / V_UNIT });
  }

  /** Fricción de Coulomb: la velocidad decrece linealmente hasta detenerse. */
  private applyFriction(dtS: number) {
    let moving = false;
    for (const p of this.pieceList) {
      if (p.pocketed) continue;
      const v = Body.getVelocity(p.body);
      const sp = Math.hypot(v.x, v.y) * V_UNIT;
      if (sp < this.config.stopSpeed) {
        if (sp > 0) Body.setVelocity(p.body, { x: 0, y: 0 });
        continue;
      }
      const ns = Math.min(Math.max(0, sp - this.config.frictionDecel * dtS), this.config.maxSpeed);
      const k = ns / sp;
      Body.setVelocity(p.body, { x: v.x * k, y: v.y * k });
      moving = true;
    }
    this.resting = !moving;
  }

  private checkPockets(out: StepEvents) {
    const capture = (BOARD.pocketDiameter / 2) * this.config.pocketCapture;
    for (const p of this.pieceList) {
      if (p.pocketed) continue;
      const { x, y } = p.body.position;
      for (let i = 0; i < POCKETS.length; i++) {
        if (Math.hypot(x - POCKETS[i].x, y - POCKETS[i].y) <= capture) {
          p.pocketed = true;
          Composite.remove(this.engine.world, p.body);
          this.byBody.delete(p.body.id);
          out.pocketed.push({ pieceId: p.id, kind: p.kind, pocket: i });
          break;
        }
      }
    }
  }
}
