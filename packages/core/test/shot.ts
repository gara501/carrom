import { CarromWorld, previewShot, shotFromPull, projectOnBaseline, baselinePosition, SHOT, BOARD } from '../src';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
  if (!ok) failed++;
};

// Mapeo potencia
check('arrastre corto cancela', shotFromPull({ x: 0, y: -10 }) === null);
const lo = shotFromPull({ x: 0, y: -SHOT.minDrag })!;
const hi = shotFromPull({ x: 0, y: -1000 })!;
check('potencia mínima/máxima', lo.power === 0 && hi.power === 1 && hi.speed === SHOT.maxSpeed && lo.speed === SHOT.minSpeed);
check('dirección unitaria', Math.abs(Math.hypot(hi.dir.x, hi.dir.y) - 1) < 1e-9 && hi.dir.y === -1);

// Línea base
const t = projectOnBaseline('bottom', { x: 5000, y: 0 });
check('proyección acotada', t === 1 && baselinePosition('bottom', t).x > 0);
check('centro de línea base', Math.abs(baselinePosition('bottom', 0.5).x) < 1e-9);

// Preview vs física: el contacto previsto coincide con el real
{
  const w = new CarromWorld();
  w.reset([{ x: 40, y: 0, color: 'white' }, { x: -200, y: -100, color: 'black' }]);
  const o = { x: 0, y: 270 };
  w.addStriker(o.x, o.y);
  const dir = { x: 0.1, y: -1 }; const n = Math.hypot(dir.x, dir.y); dir.x /= n; dir.y /= n;
  const r = w.getStriker()!.radius;
  const pv = previewShot(o, dir, r, w.pieces);
  w.shoot({ x: dir.x * 2000, y: dir.y * 2000 });
  let contact: { x: number; y: number } | undefined;
  for (let i = 0; i < 5000 && !contact; i++) {
    const ev = w.advance(1000 / 480);
    if (ev.hits.length) { const s = w.getStriker()!; contact = { x: s.x, y: s.y }; }
  }
  const err = contact ? Math.hypot(contact.x - pv.point.x, contact.y - pv.point.y) : Infinity;
  check('preview = primer contacto físico', pv.hit === 'white' && err < 4, `error=${err.toFixed(2)}mm`);
  check('preview da dirección de salida', !!pv.target && pv.target.kind === 'white');
}

// Preview contra la banda
{
  const pv = previewShot({ x: 0, y: 0 }, { x: 0, y: -1 }, BOARD.strikerDiameter / 2, []);
  check('preview contra banda', pv.hit === 'wall' && Math.abs(pv.point.y + (BOARD.size / 2 - BOARD.strikerDiameter / 2)) < 1e-6);
}

// Solape de colocación
{
  const w = new CarromWorld();
  w.reset([{ x: 0, y: 270, color: 'white' }]);
  check('detecta solape', w.isOverlapping({ x: 10, y: 270 }, BOARD.strikerDiameter / 2) && !w.isOverlapping({ x: 100, y: 270 }, BOARD.strikerDiameter / 2));
}

console.log(failed ? `\n${failed} test(s) fallaron` : '\nTodos los tests de tiro pasan');
process.exit(failed ? 1 : 0);
