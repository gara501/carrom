/**
 * Reglas del Carrom (ICF simplificado) como función pura.
 * Entrada: estado del tablero + piezas embolsadas en el tiro. Salida: estado nuevo,
 * piezas que hay que devolver al centro y eventos para la interfaz.
 * No depende de física ni de Phaser.
 */
import type { CoinColor, Side } from './board';
import type { PieceKind } from './physics';

export type PlayerId = 0 | 1;
export type PlayerColor = 'white' | 'black';
export type QueenStatus = 'board' | 'pending' | 'covered';
/** cleared = embolsó todas las suyas; queen-left = embolsó todas las suyas con la reina en el tablero (pierde);
 *  opponent-last = embolsó la última pieza del rival (pierde). */
export type BoardEndReason = 'cleared' | 'queen-left' | 'opponent-last';

export const COINS_PER_COLOR = 9;
export const QUEEN_POINTS = 3;

export interface PlayerState {
  id: PlayerId;
  color: PlayerColor;
  side: Side;
}

export interface BoardState {
  players: [PlayerState, PlayerState];
  current: PlayerId;
  /** Piezas de cada color que están en un bolsillo (las embolsó quien sea). */
  pocketed: Record<PlayerColor, number>;
  /** 'board' = en el tablero; 'pending' = embolsada, falta cubrirla; 'covered' = confirmada. */
  queen: QueenStatus;
  queenOwner: PlayerId | null;
  /** Piezas que cada jugador debe devolver por una falta sin tener piezas embolsadas. */
  owed: [number, number];
  phase: 'playing' | 'over';
  winner: PlayerId | null;
  endReason: BoardEndReason | null;
  shots: number;
}

export type RuleEvent =
  | { type: 'foul'; player: PlayerId }
  | { type: 'penalty-returned'; player: PlayerId }
  | { type: 'penalty-owed'; player: PlayerId }
  | { type: 'debt-paid'; player: PlayerId; count: number }
  | { type: 'queen-pocketed'; player: PlayerId }
  | { type: 'queen-covered'; player: PlayerId }
  | { type: 'queen-returned'; player: PlayerId }
  | { type: 'extra-turn'; player: PlayerId }
  | { type: 'turn-change'; from: PlayerId; to: PlayerId }
  | { type: 'board-over'; winner: PlayerId; reason: BoardEndReason };

export interface ShotResolution {
  state: BoardState;
  /** Piezas que el anfitrión debe volver a poner en el centro, en este orden. */
  returns: CoinColor[];
  events: RuleEvent[];
}

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const otherColor = (c: PlayerColor): PlayerColor => (c === 'white' ? 'black' : 'white');

/**
 * Tablero nuevo. Jugador 0 siempre se sienta abajo y jugador 1 arriba; quien saca
 * (`breaker`) juega con blancas y abre. Los colores se intercambian al alternar el saque.
 */
export function createBoard(breaker: PlayerId = 0): BoardState {
  const colors: [PlayerColor, PlayerColor] = breaker === 0 ? ['white', 'black'] : ['black', 'white'];
  return {
    players: [
      { id: 0, color: colors[0], side: 'bottom' },
      { id: 1, color: colors[1], side: 'top' },
    ],
    current: breaker,
    pocketed: { white: 0, black: 0 },
    queen: 'board',
    queenOwner: null,
    owed: [0, 0],
    phase: 'playing',
    winner: null,
    endReason: null,
    shots: 0,
  };
}

export function playerOfColor(s: BoardState, c: PlayerColor): PlayerId {
  return s.players[0].color === c ? 0 : 1;
}

/** Piezas de ese color que siguen en el tablero (no embolsadas). */
export function remainingCoins(s: BoardState, c: PlayerColor): number {
  return COINS_PER_COLOR - s.pocketed[c];
}

/** Resuelve un tiro ya terminado. `pocketedKinds` incluye 'striker' si cayó. */
export function resolveShot(prev: BoardState, pocketedKinds: readonly PieceKind[]): ShotResolution {
  if (prev.phase === 'over') throw new Error('El tablero ya terminó');
  const s: BoardState = structuredClone(prev);
  const events: RuleEvent[] = [];
  const returns: CoinColor[] = [];

  const p = s.current;
  const me = s.players[p].color;
  const oppColor = otherColor(me);
  const count = (k: PieceKind) => pocketedKinds.filter((x) => x === k).length;
  const ownN = count(me);
  const oppN = count(oppColor);
  const queenP = count('queen') > 0;
  s.shots++;

  const endTurn = (): ShotResolution => {
    const to = other(p);
    s.current = to;
    events.push({ type: 'turn-change', from: p, to });
    return { state: s, returns, events };
  };

  // ------------------------------------------------------------------ falta
  if (count('striker') > 0) {
    events.push({ type: 'foul', player: p });
    // Todo lo embolsado en el tiro de falta vuelve al tablero.
    if (queenP) returns.push('queen');
    for (let i = 0; i < ownN; i++) returns.push(me);
    for (let i = 0; i < oppN; i++) returns.push(oppColor);
    // Si había una reina por cubrir, también vuelve.
    if (s.queen === 'pending' && s.queenOwner === p) {
      returns.push('queen');
      s.queen = 'board';
      s.queenOwner = null;
      events.push({ type: 'queen-returned', player: p });
    }
    // Multa: devolver una pieza propia ya embolsada, o quedar en deuda.
    if (s.pocketed[me] > 0) {
      s.pocketed[me]--;
      returns.push(me);
      events.push({ type: 'penalty-returned', player: p });
    } else {
      s.owed[p]++;
      events.push({ type: 'penalty-owed', player: p });
    }
    return endTurn();
  }

  // ---------------------------------------------------------- tiro sin falta
  s.pocketed[oppColor] += oppN;
  s.pocketed[me] += ownN;
  let effOwn = ownN;

  // Una deuda se paga con las primeras piezas propias que se embolsen.
  if (s.owed[p] > 0 && ownN > 0) {
    const pay = Math.min(s.owed[p], ownN);
    s.owed[p] -= pay;
    s.pocketed[me] -= pay;
    effOwn -= pay;
    for (let i = 0; i < pay; i++) returns.push(me);
    events.push({ type: 'debt-paid', player: p, count: pay });
  }

  let keep = effOwn > 0;

  if (queenP) {
    events.push({ type: 'queen-pocketed', player: p });
    if (effOwn > 0) {
      s.queen = 'covered';
      s.queenOwner = p;
      events.push({ type: 'queen-covered', player: p });
    } else {
      s.queen = 'pending';
      s.queenOwner = p;
      keep = true; // tiro extra para cubrirla
    }
  } else if (s.queen === 'pending' && s.queenOwner === p) {
    if (effOwn > 0) {
      s.queen = 'covered';
      events.push({ type: 'queen-covered', player: p });
    } else {
      returns.push('queen');
      s.queen = 'board';
      s.queenOwner = null;
      keep = false;
      events.push({ type: 'queen-returned', player: p });
    }
  }

  // Final del tablero (reglamento ICF)
  const finish = (winner: PlayerId, reason: BoardEndReason): ShotResolution => {
    s.phase = 'over';
    s.winner = winner;
    s.endReason = reason;
    events.push({ type: 'board-over', winner, reason });
    return { state: s, returns, events };
  };
  if (s.pocketed[oppColor] === COINS_PER_COLOR) return finish(other(p), 'opponent-last');
  if (s.pocketed[me] === COINS_PER_COLOR) {
    return s.queen === 'board' ? finish(other(p), 'queen-left') : finish(p, 'cleared');
  }

  if (keep) {
    events.push({ type: 'extra-turn', player: p });
    return { state: s, returns, events };
  }
  return endTurn();
}
