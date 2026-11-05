import { createMatch, applyShot, startNextBoard, scoreBoard, MATCH_RULES, createBoard, type MatchState, type BoardState, type PieceKind } from '../src';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
};
const withBoard = (m: MatchState, b: Partial<BoardState>): MatchState => ({ ...m, board: { ...m.board, ...b } });
const shot = (m: MatchState, ...k: PieceKind[]) => applyShot(m, k);

// Puntos: piezas del rival + reina propia
{
  const m = createMatch();
  const b: BoardState = { ...m.board, pocketed: { white: 8, black: 5 }, queen: 'covered', queenOwner: 0 };
  const r = shot(withBoard(m, b), 'white');
  check('puntos = rivales restantes + 3 reina', r.match.scores[0] === 4 + 3 && r.match.boards[0].queenCounted, `scores=${r.match.scores}`);
  check('tras el tablero se espera el siguiente', r.match.phase === 'between');
  const n = startNextBoard(r.match);
  check('el saque alterna', n.breaker === 1 && n.board.current === 1 && n.boardNumber === 2 && n.board.players[1].color === 'white');
}

// Reina del rival o sin cubrir por el ganador: no cuenta
{
  const m = createMatch();
  const b: BoardState = { ...m.board, pocketed: { white: 8, black: 5 }, queen: 'covered', queenOwner: 1 };
  const r = shot(withBoard(m, b), 'white');
  check('reina cubierta por el perdedor: nadie la cobra', r.match.scores[0] === 4 && !r.match.boards[0].queenCounted);
}

// Límite de 22 puntos para cobrar la reina
{
  const m: MatchState = { ...createMatch(), scores: [22, 0] };
  const b: BoardState = { ...m.board, pocketed: { white: 8, black: 6 }, queen: 'covered', queenOwner: 0 };
  const r = shot(withBoard(m, b), 'white');
  check('con 22+ puntos la reina no suma', r.match.scores[0] === 22 + 3 && !r.match.boards[0].queenCounted, `scores=${r.match.scores}`);
  check('25 puntos termina la partida', r.match.phase === 'over' && r.match.winner === 0);
}

// Penalizaciones: 3 puntos para el rival (1 si ya tiene 22+)
{
  const m = createMatch();
  const b: BoardState = { ...m.board, pocketed: { white: 8, black: 0 } };
  const r = shot(withBoard(m, b), 'white'); // todas las suyas con reina en el tablero
  check('perder por reina en el tablero: rival +3', r.match.scores[1] === 3 && r.match.boards[0].reason === 'queen-left', `scores=${r.match.scores}`);

  const m2: MatchState = { ...createMatch(), scores: [0, 22] };
  const r2 = shot(withBoard(m2, b), 'white');
  check('rival con 22+: la falta vale 1', r2.match.scores[1] === 23, `scores=${r2.match.scores}`);

  const m3 = createMatch();
  const b3: BoardState = { ...m3.board, pocketed: { white: 0, black: 8 }, queen: 'covered', queenOwner: 1 };
  const r3 = shot(withBoard(m3, b3), 'black'); // J1 (blancas) embolsa la última negra
  check('embolsar la última del rival: él gana 3', r3.match.scores[1] === 3 && r3.match.boards[0].reason === 'opponent-last');
}

// Ocho tableros: gana el que lidera; empate => tablero extra
{
  const base = createMatch();
  const last = (scores: [number, number]): MatchState => ({
    ...base, scores, boardNumber: MATCH_RULES.maxBoards,
    board: { ...base.board, pocketed: { white: 8, black: 7 }, queen: 'covered', queenOwner: 0 },
  });
  let r = shot(last([10, 14]), 'white'); // J0 gana 2+3 = 5 -> 15 vs 14
  check('tras 8 tableros gana el que lidera', r.match.phase === 'over' && r.match.winner === 0, `scores=${r.match.scores}`);
  r = shot(last([10, 15]), 'white'); // 15 vs 15 -> empate
  check('empate tras 8: tablero extra', r.match.phase === 'between' && r.match.winner === null, `scores=${r.match.scores}`);
  const extra = startNextBoard(r.match);
  check('se juega el tablero 9', extra.boardNumber === 9);
  const ex: MatchState = { ...extra, board: { ...extra.board, pocketed: { white: 3, black: 8 }, queen: 'covered', queenOwner: 1 } };
  const r9 = shot({ ...ex, board: { ...ex.board, current: 0, players: [{ id: 0, color: 'black', side: 'bottom' }, { id: 1, color: 'white', side: 'top' }] } }, 'black');
  check('el tablero extra decide', r9.match.phase === 'over' && r9.match.winner !== null);
}

void scoreBoard; void createBoard;
console.log(failed ? `\n${failed} test(s) de partida fallaron` : '\nTodos los tests de partida pasan');
process.exit(failed ? 1 : 0);
