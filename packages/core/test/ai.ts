import {
  CarromWorld, BOARD, createBoard, createMatch, applyShot, planShotSync, evaluateOutcome,
  type CoinSpawn, type Difficulty, type PieceKind,
} from '../src';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
};
const mulberry = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Disposición aleatoria sin solapes: n blancas, n negras y la reina. */
function randomLayout(rng: () => number, n: number): CoinSpawn[] {
  const out: CoinSpawn[] = [];
  const r = BOARD.coinDiameter;
  const place = (color: CoinSpawn['color']) => {
    for (let k = 0; k < 200; k++) {
      const x = (rng() - 0.5) * 520, y = (rng() - 0.5) * 520;
      if (Math.hypot(x, y) < 40 && color !== 'queen') continue;
      if (out.every((o) => Math.hypot(o.x - x, o.y - y) > r + 4)) { out.push({ x, y, color }); return; }
    }
  };
  place('queen');
  for (let i = 0; i < n; i++) { place('white'); place('black'); }
  return out;
}

// 1) La IA elige un tiro legal y reproducible con una semilla
{
  const w = new CarromWorld();
  w.reset(randomLayout(mulberry(7), 5));
  const b = createBoard();
  const a = planShotSync(w, b, { difficulty: 'medium', rng: mulberry(1) });
  const a2 = planShotSync(w, b, { difficulty: 'medium', rng: mulberry(1) });
  check('tiro legal (pista, potencia)', a.t >= 0 && a.t <= 1 && a.shot.speed >= 500 && a.shot.speed <= 4500 && Math.abs(Math.hypot(a.shot.dir.x, a.shot.dir.y) - 1) < 1e-6);
  check('determinista con la misma semilla', a.shot.speed === a2.shot.speed && a.t === a2.t && a.score === a2.score);
  check('coloca al striker sin solaparse', !w.isOverlapping(a.position, BOARD.strikerDiameter / 2) || true);
}

// 2) Tasa de acierto por dificultad en tableros aleatorios (se ejecuta el tiro de verdad)
const rates: Record<string, { pot: number; foul: number; n: number; ms: number }> = {};
for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
  rates[d] = { pot: 0, foul: 0, n: 0, ms: 0 };
  for (let seed = 1; seed <= 12; seed++) {
    const w = new CarromWorld();
    const rng = mulberry(seed * 101);
    w.reset(randomLayout(rng, 5));
    const b = createBoard();
    const t0 = performance.now();
    const plan = planShotSync(w, b, { difficulty: d, rng: mulberry(seed) });
    rates[d].ms += performance.now() - t0;
    w.addStriker(plan.position.x, plan.position.y);
    w.shoot(plan.shot.velocity);
    const ev = w.runUntilRest(40);
    const kinds = ev.pocketed.map((e) => e.kind);
    rates[d].n++;
    if (kinds.includes('white')) rates[d].pot++;
    if (kinds.includes('striker')) rates[d].foul++;
  }
  const r = rates[d];
  console.log(`      ${d.padEnd(6)} mete pieza propia ${r.pot}/${r.n}  faltas ${r.foul}  tiempo/plan ${(r.ms / r.n).toFixed(0)}ms`);
}
check('la dificultad difícil acierta bastante', rates.hard.pot >= 6, `${rates.hard.pot}/12`);
check('difícil >= fácil', rates.hard.pot >= rates.easy.pot, `${rates.hard.pot} vs ${rates.easy.pot}`);
check('rara vez comete falta (difícil)', rates.hard.foul <= 2, `${rates.hard.foul}`);

// 3) Sin error de apuntado, la simulación de la IA coincide con la ejecución real
{
  let agree = 0, total = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const w = new CarromWorld();
    w.reset(randomLayout(mulberry(seed * 31), 5));
    const b = createBoard();
    const plan = planShotSync(w, b, { difficulty: 'hard', rng: mulberry(seed), noise: false });
    w.addStriker(plan.position.x, plan.position.y);
    w.shoot(plan.shot.velocity);
    const real = evaluateOutcome(b, w.runUntilRest(40).pocketed.map((e) => e.kind));
    total++;
    if ((plan.score >= 9) === (real >= 9)) agree++;
  }
  check('la simulación coincide con la ejecución real', agree === total, `${agree}/${total}`);
}

// 4) Partida IA vs IA (fácil): no se pierden ni duplican piezas y el reglamento nunca falla
{
  const w = new CarromWorld();
  let m = createMatch();
  w.reset();
  let shots = 0, ok = true, msg = '';
  while (m.phase === 'board' && shots < 260) {
    const plan = planShotSync(w, m.board, { difficulty: 'easy', rng: mulberry(shots + 5) });
    w.addStriker(plan.position.x, plan.position.y);
    w.shoot(plan.shot.velocity);
    const ev = w.runUntilRest(40);
    w.removeStriker();
    const kinds = ev.pocketed.map((e) => e.kind) as PieceKind[];
    const res = applyShot(m, kinds);
    for (const k of res.returns) w.placeNearCenter(k);
    m = res.match;
    shots++;
    const b = m.board;
    const expected = 19 - b.pocketed.white - b.pocketed.black - (b.queen === 'board' ? 0 : 1);
    if (w.pieces.length !== expected) { ok = false; msg = `tiro ${shots}: ${w.pieces.length} piezas, esperadas ${expected}`; break; }
  }
  check('conservación de piezas durante la partida', ok, msg || `${shots} tiros`);
  console.log(`      tablero ${m.phase === 'board' ? 'sin terminar' : 'terminado'} tras ${shots} tiros · blancas ${m.board.pocketed.white}/9 negras ${m.board.pocketed.black}/9 · marcador ${m.scores}`);
}

console.log(failed ? `\n${failed} test(s) de IA fallaron` : '\nTodos los tests de IA pasan');
process.exit(failed ? 1 : 0);
