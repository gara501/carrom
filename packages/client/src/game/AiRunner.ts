import { planShot, type CarromWorld, type BoardState, type Difficulty, type PlannedShot } from '@carrom/core';

/** Ejecuta la planificación de la IA repartida en frames para no congelar la pantalla. */
export class AiRunner {
  private it: Generator<void, PlannedShot>;
  result: PlannedShot | null = null;

  constructor(world: CarromWorld, board: BoardState, difficulty: Difficulty) {
    this.it = planShot(world, board, { difficulty });
  }

  /** Trabaja como máximo `budgetMs` milisegundos; devuelve el plan cuando termina. */
  tick(budgetMs: number): PlannedShot | null {
    const t0 = performance.now();
    while (!this.result && performance.now() - t0 < budgetMs) {
      const r = this.it.next();
      if (r.done) this.result = r.value;
    }
    return this.result;
  }
}
