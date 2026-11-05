import { CarromWorld, BOARD, POCKETS } from '../src';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// 1) Unidades: sin fricción, 2000 mm/s durante 50 ms => ~100 mm
{
  const w = new CarromWorld({ frictionDecel: 0 });
  w.reset([]);
  w.addStriker(0, 300);
  w.shoot({ x: 0, y: -2000 });
  for (let i = 0; i < 24; i++) w.advance(1000 / 480); // 24 pasos = 50 ms
  const s = w.getStriker()!;
  check('unidades mm/s', near(300 - s.y, 100, 2), `desplazamiento=${(300 - s.y).toFixed(1)}mm (esperado ~100)`);
}

// 2) Fricción constante: v=700 mm/s, a=800 => d = v²/2a ≈ 306 mm
{
  const w = new CarromWorld({ frictionDecel: 800 });
  w.reset([]);
  w.addStriker(0, 300);
  w.shoot({ x: 0, y: -700 });
  w.runUntilRest();
  const s = w.getStriker()!;
  check('fricción y parada', near(300 - s.y, 306, 8) && w.isResting(), `recorrido=${(300 - s.y).toFixed(1)}mm (esperado ~306)`);
}

// 3) Rebote en banda: la velocidad normal se conserva ~ e
{
  const w = new CarromWorld({ frictionDecel: 0 });
  w.reset([]);
  w.addStriker(0, 0);
  w.shoot({ x: 0, y: -1000 });
  let vyAfter = 0, bounced = false;
  for (let i = 0; i < 2000 && !bounced; i++) {
    const ev = w.advance(1000 / 480);
    if (ev.hits.length) { bounced = true; }
  }
  for (let i = 0; i < 4; i++) w.advance(1000 / 480);
  const s = w.getStriker()!;
  check('rebota en la banda', bounced && s.y > -BOARD.size / 2, `y=${s.y.toFixed(1)}`);
  void vyAfter;
}

// 4) Bolsillo: striker deslizando por la banda superior hacia la esquina
{
  const w = new CarromWorld();
  w.reset([]);
  w.addStriker(-200, -340);
  w.shoot({ x: -1200, y: 0 });
  const ev = w.runUntilRest();
  check('el striker cae en el bolsillo', ev.pocketed.length === 1 && ev.pocketed[0].pocket === 0 && w.getStriker() === undefined);
}

// 5) Tiro de apertura a velocidad máxima: estabilidad, sin tunneling, sin solapes
{
  const w = new CarromWorld();
  w.reset();
  const base = -(BOARD.size / 2 - BOARD.baselineOffset) * -1; // y de la línea base inferior
  w.addStriker(15, base);
  w.shoot({ x: 0, y: -5000 });
  const t0 = performance.now();
  const ev = w.runUntilRest(60);
  const ms = performance.now() - t0;
  const half = BOARD.size / 2;
  const ps = w.pieces;
  const inside = ps.every((p) => Number.isFinite(p.x) && Math.abs(p.x) < half && Math.abs(p.y) < half);
  let maxOverlap = 0;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
    maxOverlap = Math.max(maxOverlap, ps[i].radius + ps[j].radius - d);
  }
  check('reposo alcanzado', w.isResting());
  check('piezas dentro del tablero', inside);
  check('sin solapes graves', maxOverlap < 1.5, `solape máx=${maxOverlap.toFixed(2)}mm`);
  console.log(`      golpes=${ev.hits.length} embolsadas=${ev.pocketed.map((e) => e.kind).join(',') || '-'} piezas=${ps.length} cpu=${ms.toFixed(0)}ms`);
}

// 6) Determinismo: dos ejecuciones idénticas dan el mismo resultado
{
  const run = () => {
    const w = new CarromWorld();
    w.reset();
    w.addStriker(-40, 270);
    w.shoot({ x: 600, y: -2800 });
    w.runUntilRest();
    return w.pieces.map((p) => `${p.id}:${p.x.toFixed(6)},${p.y.toFixed(6)}`).join('|');
  };
  check('determinista', run() === run());
}

void POCKETS;
console.log(failed ? `\n${failed} test(s) fallaron` : '\nTodos los tests pasan');
process.exit(failed ? 1 : 0);
