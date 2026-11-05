/**
 * IA del Carrom. Genera tiros candidatos (bola fantasma hacia cada bolsillo), los simula en un
 * mundo aparte con la misma física del juego y puntúa el resultado con las reglas reales.
 * Es un generador: cede el control tras cada simulación para repartir el cálculo entre frames.
 */
import { BOARD, POCKETS, getBaseline, type Vec2 } from './board';
import { CarromWorld } from './physics';
import { baselinePosition, previewShot, shotFromSpeed, SHOT, type ShotParams } from './shot';
import { resolveShot, type BoardState, type PlayerColor } from './rules';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface Profile {
  /** Candidatos que se simulan de verdad (los mejores según la geometría). */
  topK: number;
  /** Multiplicadores sobre la velocidad estimada que se prueban. */
  speedMul: number[];
  /** Error aleatorio al ejecutar: desviación del ángulo (grados) y de la velocidad (fracción). */
  angleSigma: number;
  speedSigma: number;
  /** Elige al azar entre los N mejores (más humano y falible). */
  pickAmongTop: number;
  /** Posiciones de salida que se consideran sobre la pista. */
  positions: number;
}

export const AI_PROFILES: Record<Difficulty, Profile> = {
  easy: { topK: 6, speedMul: [1], angleSigma: 3.5, speedSigma: 0.18, pickAmongTop: 3, positions: 7 },
  medium: { topK: 12, speedMul: [1, 1.25], angleSigma: 1.2, speedSigma: 0.07, pickAmongTop: 1, positions: 11 },
  hard: { topK: 22, speedMul: [0.85, 1, 1.25, 1.6], angleSigma: 0.35, speedSigma: 0.03, pickAmongTop: 1, positions: 15 },
};

export interface PlannedShot {
  /** Posición del striker sobre la pista (0..1) y en el tablero. */
  t: number;
  position: Vec2;
  shot: ShotParams;
  /** Puntuación estimada por la simulación (sin ruido). */
  score: number;
  simulated: number;
}

export interface AiOptions {
  difficulty: Difficulty;
  /** Generador aleatorio en [0,1); inyectable para tests. */
  rng?: () => number;
  /** false = ejecuta el tiro exacto, sin error de apuntado (tests y análisis). */
  noise?: boolean;
}

const COIN_R = BOARD.coinDiameter / 2;
const STRIKER_R = BOARD.strikerDiameter / 2;
const POCKET_R = BOARD.pocketDiameter / 2;
const MASS_FACTOR = (1.8 * 15) / (15 + 5.5); // velocidad que gana la pieza en un choque frontal

const other = (c: PlayerColor): PlayerColor => (c === 'white' ? 'black' : 'white');

/** Puntúa el resultado de un tiro simulado para el jugador en turno. */
export function evaluateOutcome(board: BoardState, pocketed: readonly string[]): number {
  const me = board.current;
  const color = board.players[me].color;
  const res = resolveShot(board, pocketed as never);
  const a = res.state;
  let s = 0;
  s += 10 * (a.pocketed[color] - board.pocketed[color]);
  s -= 7 * (a.pocketed[other(color)] - board.pocketed[other(color)]);
  if (board.queen !== 'covered' && a.queen === 'covered' && a.queenOwner === me) s += 14;
  if (board.queen === 'board' && a.queen === 'pending') s += 6;
  if (board.queen === 'pending' && a.queen === 'board') s -= 8;
  if (res.events.some((e) => e.type === 'foul')) s -= 18;
  s -= 6 * (a.owed[me] - board.owed[me]);
  if (a.phase === 'over') s += a.winner === me ? 200 : -200;
  else if (a.current === me) s += 3;
  return s;
}

interface Candidate { t: number; pos: Vec2; dir: Vec2; speed: number; g: number }

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function gauss(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Planifica el tiro del jugador en turno. Úsalo con `for (...) {}` o paso a paso:
 *   const it = planShot(world, board, opts); let r = it.next(); while (!r.done) r = it.next();
 */
export function* planShot(world: CarromWorld, board: BoardState, opts: AiOptions): Generator<void, PlannedShot> {
  const rng = opts.rng ?? Math.random;
  const prof = AI_PROFILES[opts.difficulty];
  const me = board.current;
  const color = board.players[me].color;
  const side = board.players[me].side;
  const base = getBaseline(side);
  const decel = world.config.frictionDecel;

  const layout = world.snapshotLayout();
  const sim = new CarromWorld(world.config);
  sim.reset(layout);
  const pieces = sim.pieces;

  // Posiciones de salida legales (el striker no puede solapar piezas)
  const starts: { t: number; pos: Vec2 }[] = [];
  for (let i = 0; i < prof.positions; i++) {
    const t = prof.positions === 1 ? 0.5 : i / (prof.positions - 1);
    const pos = baselinePosition(side, t);
    if (!sim.isOverlapping(pos, STRIKER_R)) starts.push({ t, pos });
  }
  if (starts.length === 0) starts.push({ t: 0.5, pos: baselinePosition(side, 0.5) });

  // Objetivos: piezas propias y la reina (si sigue en el tablero)
  const targets = pieces.filter((p) => p.kind === color || (p.kind === 'queen' && board.queen === 'board'));

  const cands: Candidate[] = [];
  for (const c of targets) {
    for (const P of POCKETS) {
      const ux = P.x - c.x, uy = P.y - c.y;
      const dcp = Math.hypot(ux, uy);
      const u = { x: ux / dcp, y: uy / dcp };
      // ¿otra pieza estorba el camino de la pieza hacia el bolsillo?
      const blocked = pieces.some((q) => q.id !== c.id && distToSegment(q, c, P) < COIN_R + q.radius - 1);
      if (blocked) continue;
      const G = { x: c.x - u.x * (COIN_R + STRIKER_R), y: c.y - u.y * (COIN_R + STRIKER_R) };
      for (const s of starts) {
        const dx = G.x - s.pos.x, dy = G.y - s.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;
        const dir = { x: dx / dist, y: dy / dist };
        const cos = dir.x * u.x + dir.y * u.y;
        if (cos < 0.2) continue; // corte demasiado fino
        if (dir.x * base.inward.x + dir.y * base.inward.y < 0.05) continue; // hacia atrás
        const pv = previewShot(s.pos, dir, STRIKER_R, pieces);
        if (pv.target?.id !== c.id || Math.hypot(pv.point.x - G.x, pv.point.y - G.y) > 3) continue; // otra pieza se interpone
        const coinSpeed = Math.sqrt(2 * decel * Math.max(0, dcp - POCKET_R * 0.8)) * 1.25 + 160;
        const hit = coinSpeed / (MASS_FACTOR * cos);
        const v0 = Math.sqrt(hit * hit + 2 * decel * dist);
        const g = (cos * cos) / (1 + (dist + dcp) / 700) + (c.kind === 'queen' ? 0.15 : 0);
        cands.push({ t: s.t, pos: s.pos, dir, speed: v0, g });
      }
    }
  }
  cands.sort((a, b) => b.g - a.g);

  // Respaldo si no hay tiros directos: tocar el grupo de piezas propias con suavidad
  if (cands.length === 0) {
    const own = pieces.filter((p) => p.kind === color);
    const cx = own.reduce((a, p) => a + p.x, 0) / (own.length || 1), cy = own.reduce((a, p) => a + p.y, 0) / (own.length || 1);
    for (const s of starts) {
      const d = Math.hypot(cx - s.pos.x, cy - s.pos.y) || 1;
      cands.push({ t: s.t, pos: s.pos, dir: { x: (cx - s.pos.x) / d, y: (cy - s.pos.y) / d }, speed: 1100, g: 0 });
    }
  }

  const evals: { c: Candidate; speed: number; score: number }[] = [];
  let simulated = 0;
  for (const c of cands.slice(0, prof.topK)) {
    for (const mul of prof.speedMul) {
      const speed = Math.min(SHOT.maxSpeed, Math.max(SHOT.minSpeed, c.speed * mul));
      sim.reset(layout);
      sim.addStriker(c.pos.x, c.pos.y);
      sim.shoot({ x: c.dir.x * speed, y: c.dir.y * speed });
      const ev = sim.runUntilRest(40);
      const score = evaluateOutcome(board, ev.pocketed.map((e) => e.kind)) - 0.0005 * speed;
      evals.push({ c, speed, score });
      simulated++;
      yield;
    }
  }

  evals.sort((a, b) => b.score - a.score);
  const pick = evals[Math.min(evals.length - 1, Math.floor(rng() * prof.pickAmongTop))];

  // Imperfección al ejecutar: pequeño error de ángulo y de potencia
  const noisy = opts.noise !== false;
  const ang = Math.atan2(pick.c.dir.y, pick.c.dir.x) + (noisy ? (gauss(rng) * prof.angleSigma * Math.PI) / 180 : 0);
  const speed = pick.speed * (1 + (noisy ? gauss(rng) * prof.speedSigma : 0));
  const shot = shotFromSpeed({ x: Math.cos(ang), y: Math.sin(ang) }, speed);
  return { t: pick.c.t, position: pick.c.pos, shot, score: pick.score, simulated };
}

/** Versión síncrona (tests, herramientas). */
export function planShotSync(world: CarromWorld, board: BoardState, opts: AiOptions): PlannedShot {
  const it = planShot(world, board, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
