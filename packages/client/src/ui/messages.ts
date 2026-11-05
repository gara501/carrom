import type { BoardState, Difficulty, MatchState, PlayerId, RuleEvent } from '@carrom/core';

/** Nombres de los jugadores según el modo de juego. */
export type Avatar = 'person' | 'robot';

export interface Names {
  avatar: [Avatar, Avatar];
  /** En frases: "Falta de {full}". */
  full: [string, string];
  /** En las tarjetas del marcador. */
  card: [string, string];
  /** Versión corta (pantallas estrechas y marcador). */
  short: [string, string];
  /** Título del diálogo al ganar cada jugador. */
  win: [string, string];
}

export const LOCAL_NAMES: Names = {
  avatar: ['person', 'person'],
  full: ['Jugador 1', 'Jugador 2'],
  card: ['JUGADOR 1', 'JUGADOR 2'],
  short: ['J1', 'J2'],
  win: ['¡Gana el Jugador 1!', '¡Gana el Jugador 2!'],
};

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'FÁCIL', medium: 'MEDIA', hard: 'DIFÍCIL' };
export const difficultyLabel = (d: Difficulty) => DIFF_LABEL[d];

export function aiNames(d: Difficulty): Names {
  return {
    avatar: ['person', 'robot'],
    full: ['Jugador', 'la IA'],
    card: ['TÚ', `IA ${DIFF_LABEL[d]}`],
    short: ['TÚ', 'IA'],
    win: ['¡Ganaste!', '¡Gana la IA!'],
  };
}

const other = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Aviso corto (toast) para eventos de reglas; null si no merece aviso. */
export function describeRuleEvent(s: BoardState, e: RuleEvent, n: Names): string | null {
  switch (e.type) {
    case 'foul': return `¡Falta de ${n.full[e.player]}! Embolsó el striker.`;
    case 'penalty-returned': return 'Multa: una pieza suya vuelve al centro.';
    case 'penalty-owed': return 'Sin piezas embolsadas: queda en deuda de una pieza.';
    case 'debt-paid': return `${cap(n.full[s.current])} paga su deuda: la pieza vuelve al centro.`;
    case 'queen-pocketed': return 'Reina embolsada: hay que cubrirla en este tiro o en el siguiente.';
    case 'queen-covered': return 'Reina cubierta.';
    case 'queen-returned': return 'La reina vuelve al centro.';
    case 'extra-turn': return `${cap(n.full[e.player])} sigue tirando.`;
    case 'turn-change': return `Turno de ${n.full[e.to]}.`;
    case 'board-over': return null; // lo cuenta el diálogo de fin de tablero
  }
}

/** Líneas del diálogo al terminar un tablero. */
export function boardEndLines(m: MatchState, n: Names): string[] {
  if (m.resigned !== null) return [`${cap(n.full[m.resigned])} abandonó la partida.`, score(m, n)];
  const sm = m.boards[m.boards.length - 1];
  const w = sm.winner, l = other(w);
  const pts = `${sm.points} punto${sm.points === 1 ? '' : 's'}`;
  const queen = sm.queenCounted ? ' (3 son de la reina)' : '';
  const what =
    sm.reason === 'cleared' ? `${cap(n.full[w])} embolsó todas sus piezas.`
    : sm.reason === 'queen-left' ? `${cap(n.full[l])} embolsó todas sus piezas con la reina aún en el tablero y pierde el tablero.`
    : `${cap(n.full[l])} embolsó la última pieza del rival y pierde el tablero.`;
  return [what, `${cap(n.full[w])} suma ${pts}${queen}.`, score(m, n)];
}

export function gameOverLines(m: MatchState, n: Names): string[] {
  return [`Marcador final: ${score(m, n)}`, `Tableros jugados: ${m.boards.length}`];
}

const score = (m: MatchState, n: Names) => `${n.short[0]} ${m.scores[0]} - ${m.scores[1]} ${n.short[1]}`;

/** Nombres en una partida en línea: `seat` es el asiento de quien juega en este dispositivo. */
export function onlineNames(seat: PlayerId): Names {
  const me = seat, rival = other(seat);
  const pick = <T,>(mine: T, theirs: T): [T, T] => (me === 0 ? [mine, theirs] : [theirs, mine]);
  void rival;
  return {
    avatar: ['person', 'person'],
    full: [seat === 0 ? 'Jugador 1 (tú)' : 'Jugador 1', seat === 1 ? 'Jugador 2 (tú)' : 'Jugador 2'],
    card: pick('TÚ', 'RIVAL'),
    short: pick('TÚ', 'RIV'),
    win: pick('¡Ganaste!', '¡Gana tu rival!'),
  };
}
