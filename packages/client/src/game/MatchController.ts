import {
  CarromWorld, applyShot, createMatch, startNextBoard,
  type BoardState, type Difficulty, type HitEvent, type MatchEvent, type MatchState, type PieceKind, type PlayerId,
  type PocketEvent, type RuleEvent, type ShotParams, type Side,
} from '@carrom/core';

export interface AdvanceResult {
  /** true el frame en que el tiro termina y se aplican las reglas. */
  finished: boolean;
  pocketed: PocketEvent[];
  hits: HitEvent[];
}

const NONE: AdvanceResult = { finished: false, pocketed: [], hits: [] };

/**
 * Orquesta una partida: mundo físico + reglas + tiro en curso. No usa Phaser:
 * la escena solo dibuja su estado, y más adelante el servidor podrá usar la misma lógica.
 */
export class MatchController {
  readonly world = new CarromWorld();
  match: MatchState = createMatch();
  shotInFlight = false;
  /** Jugador controlado por la IA (null = partida local entre dos personas). */
  aiPlayer: PlayerId | null = null;
  difficulty: Difficulty = 'medium';
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
    this.match = createMatch(firstBreaker);
    this.resetBoardState();
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

    this.shotInFlight = false;
    this.world.removeStriker(); // fuera del tablero antes de devolver piezas
    const res = applyShot(this.match, this.shotPocketed);
    for (const kind of res.returns) this.world.placeNearCenter(kind);
    this.match = res.match;
    this.lastRuleEvents = res.ruleEvents;
    this.lastMatchEvents = res.matchEvents;
    return { finished: true, pocketed: ev.pocketed, hits: ev.hits };
  }
}
