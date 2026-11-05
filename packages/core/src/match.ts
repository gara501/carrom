/**
 * Partida completa: varios tableros hasta 25 puntos u 8 tableros (ICF).
 * Función pura sobre BoardState; sin física ni Phaser.
 */
import type { CoinColor } from './board';
import type { PieceKind } from './physics';
import {
  QUEEN_POINTS, createBoard, remainingCoins, resolveShot,
  type BoardEndReason, type BoardState, type PlayerId, type RuleEvent,
} from './rules';

export const MATCH_RULES = {
  /** Puntos que ganan la partida. */
  targetPoints: 25,
  /** Tableros máximos; si hay empate se juega uno extra. */
  maxBoards: 8,
  /** Con 22 puntos o más ya no se cobra la reina. */
  queenCutoff: 22,
  /** Puntos que recibe el rival cuando pierdes el tablero por falta grave. */
  penaltyPoints: 3,
  /** Igual, si el rival ya tiene 22 puntos o más. */
  penaltyPointsHigh: 1,
} as const;

export interface BoardSummary {
  number: number;
  winner: PlayerId;
  reason: BoardEndReason;
  points: number;
  queenCounted: boolean;
}

export interface MatchState {
  scores: [number, number];
  boards: BoardSummary[];
  /** Número (1-based) del tablero actual o del último jugado. */
  boardNumber: number;
  breaker: PlayerId;
  board: BoardState;
  /** board = jugándose; between = tablero terminado, falta pasar al siguiente; over = partida terminada. */
  phase: 'board' | 'between' | 'over';
  winner: PlayerId | null;
}

export type MatchEvent =
  | { type: 'board-scored'; summary: BoardSummary; scores: [number, number] }
  | { type: 'game-over'; winner: PlayerId; scores: [number, number] };

export interface MatchShotResult {
  match: MatchState;
  returns: CoinColor[];
  ruleEvents: RuleEvent[];
  matchEvents: MatchEvent[];
}

export function createMatch(firstBreaker: PlayerId = 0): MatchState {
  return {
    scores: [0, 0],
    boards: [],
    boardNumber: 1,
    breaker: firstBreaker,
    board: createBoard(firstBreaker),
    phase: 'board',
    winner: null,
  };
}

/** Puntos de un tablero terminado, según el marcador previo de la partida. */
export function scoreBoard(
  board: BoardState,
  scoresBefore: readonly [number, number],
): { winner: PlayerId; points: number; queenCounted: boolean; reason: BoardEndReason } {
  if (board.winner === null || board.endReason === null) throw new Error('El tablero no ha terminado');
  const w = board.winner;
  const reason = board.endReason;
  const winnerScore = scoresBefore[w];

  if (reason !== 'cleared') {
    // Falta grave del rival: el ganador recibe una cantidad fija.
    const points = winnerScore >= MATCH_RULES.queenCutoff ? MATCH_RULES.penaltyPointsHigh : MATCH_RULES.penaltyPoints;
    return { winner: w, points, queenCounted: false, reason };
  }
  const oppColor = board.players[w].color === 'white' ? 'black' : 'white';
  let points = remainingCoins(board, oppColor);
  const queenCounted =
    board.queen === 'covered' && board.queenOwner === w && winnerScore < MATCH_RULES.queenCutoff;
  if (queenCounted) points += QUEEN_POINTS;
  return { winner: w, points, queenCounted, reason };
}

/** Aplica un tiro terminado. Si el tablero acaba, suma puntos y decide si la partida sigue. */
export function applyShot(prev: MatchState, pocketed: readonly PieceKind[]): MatchShotResult {
  if (prev.phase !== 'board') throw new Error('No hay un tablero en juego');
  const res = resolveShot(prev.board, pocketed);
  const m: MatchState = structuredClone(prev);
  m.board = res.state;
  const matchEvents: MatchEvent[] = [];

  if (res.state.phase === 'over') {
    const sc = scoreBoard(res.state, prev.scores);
    m.scores[sc.winner] += sc.points;
    const summary: BoardSummary = {
      number: m.boardNumber, winner: sc.winner, reason: sc.reason, points: sc.points, queenCounted: sc.queenCounted,
    };
    m.boards.push(summary);
    matchEvents.push({ type: 'board-scored', summary, scores: [...m.scores] as [number, number] });

    const [a, b] = m.scores;
    const reached = a >= MATCH_RULES.targetPoints || b >= MATCH_RULES.targetPoints;
    const lastBoard = m.boardNumber >= MATCH_RULES.maxBoards;
    if (reached || (lastBoard && a !== b)) {
      m.phase = 'over';
      m.winner = a === b ? sc.winner : a > b ? 0 : 1;
      matchEvents.push({ type: 'game-over', winner: m.winner, scores: [...m.scores] as [number, number] });
    } else {
      m.phase = 'between'; // empate tras el último tablero => tablero extra
    }
  }
  return { match: m, returns: res.returns, ruleEvents: res.events, matchEvents };
}

/** Pasa al siguiente tablero: el saque alterna entre jugadores. */
export function startNextBoard(prev: MatchState): MatchState {
  if (prev.phase !== 'between') throw new Error('El tablero actual no ha terminado');
  const m: MatchState = structuredClone(prev);
  m.boardNumber++;
  m.breaker = prev.breaker === 0 ? 1 : 0;
  m.board = createBoard(m.breaker);
  m.phase = 'board';
  return m;
}
