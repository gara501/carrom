import { CarromWorld, type HitEvent, type PieceKind, type PocketEvent } from './physics';
import { baselinePosition, shotFromSpeed, type ShotParams } from './shot';
import type { CoinSpawn, Side, Vec2 } from './board';
import type { Difficulty } from './ai';
import type { BoardState, PlayerId, RuleEvent } from './rules';
import { applyShot, createMatch, resignMatch, startNextBoard, type MatchEvent, type MatchState } from './match';

export interface AdvanceResult {
  /** true el frame en que el tiro termina y se aplican las reglas. */
  finished: boolean;
  pocketed: PocketEvent[];
  hits: HitEvent[];
}

const NONE: AdvanceResult = { finished: false, pocketed: [], hits: [] };

/** Estado autoritativo tras un tiro (lo calcula el servidor y lo aplican los clientes). */
export interface ShotOutcome {
  match: MatchState;
  layout: CoinSpawn[];
  ruleEvents: RuleEvent[];
  matchEvents: MatchEvent[];
}

/**
 * Orquesta una partida: mundo físico + reglas + tiro en curso. No usa Phaser:
 * la escena solo dibuja su estado y el servidor en línea usa la misma lógica.
 */
export class MatchController {
  readonly world = new CarromWorld();
  match: MatchState = createMatch();
  shotInFlight = false;
  /** Jugador controlado por la IA (null = partida local entre dos personas). */
  aiPlayer: PlayerId | null = null;
  difficulty: Difficulty = 'medium';
  /** Modo relámpago para las partidas nuevas. */
  blitz = false;
  /** Eventos de reglas y de partida del último tiro resuelto. */
  lastRuleEvents: RuleEvent[] = [];
  lastMatchEvents: MatchEvent[] = [];
  private shotPocketed: PieceKind[] = [];

  get board(): BoardState { return this.match.board; }
  get phase() { return this.match.phase; }
  get current(): PlayerId { return this.match.board.current; }

  isAiTurn(): boolean {
    return this.aiPlayer !== null && this.match.phase === 'board' && this.match.board.current === this.aiPlayer;
  }

  currentSide(): Side {
    return this.board.players[this.board.current].side;
  }

  /** ¿Se puede colocar/apuntar ahora? */
  canAim(): boolean {
    return this.match.phase === 'board' && !this.shotInFlight;
  }

  newGame(firstBreaker: PlayerId = 0) {
    this.match = createMatch(firstBreaker, this.blitz);
    this.resetBoardState();
  }

  /** Abandono: gana el rival. */
  resign(loser: PlayerId) {
    this.match = resignMatch(this.match, loser);
    this.shotInFlight = false;
    this.world.removeStriker();
  }

  /** Pasa al tablero siguiente (solo entre tableros). */
  nextBoard() {
    if (this.match.phase !== 'between') return;
    this.match = startNextBoard(this.match);
    this.resetBoardState();
  }

  private resetBoardState() {
    this.world.reset();
    this.shotInFlight = false;
    this.shotPocketed = [];
    this.lastRuleEvents = [];
    this.lastMatchEvents = [];
  }

  fire(shot: ShotParams): boolean {
    if (!this.canAim() || !this.world.getStriker()) return false;
    this.shotPocketed = [];
    this.world.shoot(shot.velocity);
    this.shotInFlight = true;
    return true;
  }

  /** Avanza la simulación `deltaMs` de tiempo real. */
  advance(deltaMs: number): AdvanceResult {
    if (!this.shotInFlight) return NONE;
    const ev = this.world.advance(deltaMs);
    for (const e of ev.pocketed) this.shotPocketed.push(e.kind);
    if (!this.world.isResting()) return { finished: false, pocketed: ev.pocketed, hits: ev.hits };
    this.finishShot();
    return { finished: true, pocketed: ev.pocketed, hits: ev.hits };
  }

  private finishShot() {
    this.shotInFlight = false;
    this.world.removeStriker(); // fuera del tablero antes de devolver piezas
    const res = applyShot(this.match, this.shotPocketed);
    for (const kind of res.returns) this.world.placeNearCenter(kind);
    this.match = res.match;
    this.lastRuleEvents = res.ruleEvents;
    this.lastMatchEvents = res.matchEvents;
  }

  // ------------------------------------------------------------ en línea

  /**
   * Servidor: coloca el striker en la posición `t` de la línea base, lo dispara y simula
   * el tiro completo. Devuelve null si el tiro no es legal (fase, solapamiento…).
   */
  playShot(t: number, velocity: Vec2): ShotOutcome | null {
    if (!this.canAim() || !Number.isFinite(t) || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) return null;
    const p = baselinePosition(this.currentSide(), t);
    const striker = this.world.addStriker(p.x, p.y);
    if (this.world.isOverlapping(striker, striker.radius)) { this.world.removeStriker(); return null; }
    const sp = Math.hypot(velocity.x, velocity.y);
    if (sp < 1e-6) { this.world.removeStriker(); return null; }
    const shot = shotFromSpeed(velocity, sp);
    this.fire(shot);
    const ev = this.world.runUntilRest();
    for (const e of ev.pocketed) this.shotPocketed.push(e.kind);
    this.finishShot();
    return this.outcome();
  }

  outcome(): ShotOutcome {
    return { match: this.match, layout: this.world.snapshotLayout(), ruleEvents: this.lastRuleEvents, matchEvents: this.lastMatchEvents };
  }

  /** Cliente: adopta el estado del servidor (corrige cualquier desvío de la simulación local). */
  applyOutcome(o: ShotOutcome) {
    this.shotInFlight = false;
    this.world.removeStriker();
    this.match = o.match;
    this.world.reset(o.layout);
    this.lastRuleEvents = o.ruleEvents;
    this.lastMatchEvents = o.matchEvents;
  }
}
