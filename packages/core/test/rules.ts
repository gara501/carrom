import { createBoard, resolveShot, CarromWorld, BOARD, type BoardState, type PieceKind } from '../src';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
};
const has = (r: ReturnType<typeof resolveShot>, t: string) => r.events.some((e) => e.type === t);
const shot = (s: BoardState, ...k: PieceKind[]) => resolveShot(s, k);

// --- tiros normales
{
  const s0 = createBoard();
  let r = shot(s0, 'white');
  check('pieza propia: sigue el turno', r.state.current === 0 && r.state.pocketed.white === 1 && has(r, 'extra-turn'));
  r = shot(s0);
  check('sin embolsar: cambia el turno', r.state.current === 1 && has(r, 'turn-change'));
  r = shot(s0, 'black');
  check('pieza del rival: pierde el turno y cuenta para el rival', r.state.current === 1 && r.state.pocketed.black === 1);
  r = shot(s0, 'white', 'black');
  check('propia + rival: conserva el turno', r.state.current === 0 && r.state.pocketed.white === 1 && r.state.pocketed.black === 1);
}

// --- faltas
{
  const s0 = createBoard();
  let r = shot(s0, 'striker');
  check('falta sin piezas: queda en deuda', r.state.owed[0] === 1 && r.returns.length === 0 && r.state.current === 1);
  const s1: BoardState = { ...s0, pocketed: { white: 2, black: 0 } };
  r = shot(s1, 'striker');
  check('falta con piezas: devuelve una al centro', r.state.pocketed.white === 1 && r.returns.join() === 'white' && r.state.current === 1);
  r = shot(s1, 'striker', 'white', 'black');
  check('falta: lo embolsado en ese tiro también vuelve', r.state.pocketed.white === 1 && r.state.pocketed.black === 0 && r.returns.length === 3, `returns=${r.returns.join(',')}`);
  // pagar deuda
  const debt: BoardState = { ...s0, owed: [1, 0] };
  r = shot(debt, 'white');
  check('deuda: la primera pieza se devuelve y no da turno', r.state.owed[0] === 0 && r.state.pocketed.white === 0 && r.returns.join() === 'white' && r.state.current === 1);
  r = shot(debt, 'white', 'white');
  check('deuda: la segunda pieza sí cuenta', r.state.pocketed.white === 1 && r.state.current === 0);
}

// --- reina
{
  const s0 = createBoard();
  let r = shot(s0, 'queen');
  check('reina sola: pendiente y tiro extra', r.state.queen === 'pending' && r.state.current === 0);
  const pend = r.state;
  r = shot(pend, 'white');
  check('cover con pieza propia', r.state.queen === 'covered' && r.state.queenOwner === 0 && r.state.current === 0);
  r = shot(pend);
  check('cover fallido: la reina vuelve', r.state.queen === 'board' && r.returns.join() === 'queen' && r.state.current === 1);
  r = shot(pend, 'striker');
  check('falta con reina pendiente: reina + multa', r.state.queen === 'board' && r.returns.includes('queen') && r.state.owed[0] === 1 && r.state.current === 1);
  r = shot(s0, 'queen', 'white');
  check('reina + propia en el mismo tiro: cubierta', r.state.queen === 'covered' && r.state.pocketed.white === 1 && r.state.current === 0);
  r = shot(pend, 'black');
  check('cover con pieza del rival no cubre', r.state.queen === 'board' && r.state.current === 1);
}

// --- fin de tablero (ICF)
{
  const s0 = createBoard();
  const almost: BoardState = { ...s0, pocketed: { white: 8, black: 0 } };
  let r = shot(almost, 'white');
  check('todas las propias con la reina en el tablero: pierde el tablero', r.state.phase === 'over' && r.state.winner === 1 && r.state.endReason === 'queen-left');

  const covered: BoardState = { ...s0, pocketed: { white: 8, black: 5 }, queen: 'covered', queenOwner: 0 };
  r = shot(covered, 'white');
  check('todas las propias con la reina resuelta: gana', r.state.phase === 'over' && r.state.winner === 0 && r.state.endReason === 'cleared');

  const pendLast: BoardState = { ...s0, pocketed: { white: 8, black: 0 }, queen: 'pending', queenOwner: 0 };
  r = shot(pendLast, 'white');
  check('cubrir la reina con la última pieza gana', r.state.winner === 0 && r.state.endReason === 'cleared' && r.state.queen === 'covered');

  const oppLast: BoardState = { ...s0, pocketed: { white: 3, black: 8 }, queen: 'covered', queenOwner: 0 };
  r = shot(oppLast, 'black');
  check('embolsar la última pieza del rival: pierde el tablero', r.state.winner === 1 && r.state.endReason === 'opponent-last');

  const sep: BoardState = { ...s0, pocketed: { white: 0, black: 8 }, queen: 'covered', queenOwner: 1 };
  r = shot(sep, 'black');
  check('el rival embolsa mi última pieza: gano', r.state.winner === 1 && r.state.phase === 'over');
}

// --- saque alterno: colores
{
  const b1 = createBoard(1);
  check('el que saca juega con blancas', b1.current === 1 && b1.players[1].color === 'white' && b1.players[0].color === 'black');
}

// --- mundo: devolver al centro
{
  const w = new CarromWorld();
  w.reset([{ x: 0, y: 0, color: 'black' }]);
  const a = w.placeNearCenter('white');
  const b = w.placeNearCenter('white');
  const ok = Math.hypot(a.x, a.y) > BOARD.coinDiameter - 0.1 && Math.hypot(a.x - b.x, a.y - b.y) > BOARD.coinDiameter - 0.1;
  check('placeNearCenter evita solapes', ok, `a=(${a.x.toFixed(1)},${a.y.toFixed(1)}) b=(${b.x.toFixed(1)},${b.y.toFixed(1)})`);
  const w2 = new CarromWorld(); w2.reset([]);
  const c = w2.placeNearCenter('queen');
  check('placeNearCenter usa el centro si está libre', c.x === 0 && c.y === 0);
}

console.log(failed ? `\n${failed} test(s) de reglas fallaron` : '\nTodos los tests de reglas pasan');
process.exit(failed ? 1 : 0);
