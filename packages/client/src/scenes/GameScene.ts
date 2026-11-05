import Phaser from 'phaser';
import { BOARD, SHOT, baselinePosition, shotFromSpeed, type Difficulty, type PlannedShot, type ShotOutcome, type ShotParams } from '@carrom/core';
import { AiRunner } from '../game/AiRunner';
import { StrikerInput } from '../input/StrikerInput';
import { MatchController, type AdvanceResult } from '../game/MatchController';
import { Sfx } from '../audio/sfx';
import { Music } from '../audio/music';
import { PAL, u } from '../theme';
import { InfoOverlay } from '../ui/InfoOverlay';
import { endSummaryContent } from '../ui/EndSummary';
import { fadeIn, fadeTo } from '../ui/transition';
import { Panel, addText } from '../ui/widgets';
import { drawPiece } from '../render/PieceRenderer';
import { POCKETS } from '@carrom/core';
import { drawBoard, trackRect } from '../render/BoardRenderer';
import { PieceRenderer } from '../render/PieceRenderer';
import { drawAim } from '../render/AimRenderer';
import { Fx } from '../render/Fx';
import { Particles } from '../render/Particles';
import { Scoreboard } from '../ui/Scoreboard';
import { BottomBar } from '../ui/BottomBar';
import { Toasts } from '../ui/Toasts';
import { Modal } from '../ui/Modal';
import { net, type ShotMsg, type Snapshot } from '../net/OnlineClient';
import { LOCAL_NAMES, aiNames, onlineNames, boardEndLines, describeRuleEvent, gameOverLines, type Names } from '../ui/messages';

export interface GameData { mode?: 'ai' | 'local' | 'online'; difficulty?: Difficulty; blitz?: boolean; snapshot?: Snapshot }

type AiPhase = 'idle' | 'think' | 'move' | 'aim';

/** Escena de juego: la lógica vive en MatchController/core; aquí se dibuja y se captura la entrada. */
export class GameScene extends Phaser.Scene {
  private ctl = new MatchController();
  private root!: Phaser.GameObjects.Container;
  private boardG!: Phaser.GameObjects.Graphics;
  private piecesG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private aimG!: Phaser.GameObjects.Graphics;
  private strikerInput!: StrikerInput;
  private pieces = new PieceRenderer();
  private fx = new Fx();
  private parts!: Particles;
  private sfx!: Sfx;
  private music!: Music;
  private scoreboard!: Scoreboard;
  private bar!: BottomBar;
  private toasts!: Toasts;
  private modal!: Modal;
  private endOverlay!: InfoOverlay;
  private bgG!: Phaser.GameObjects.Graphics;
  private bannerObj?: Phaser.GameObjects.Container;
  private lastTurnKey = '';
  private paused = false;
  private k = 1;
  private hinted = false;
  private names: Names = LOCAL_NAMES;
  private opts: GameData = {};
  private ai: AiRunner | null = null;
  private aiPhase: AiPhase = 'idle';
  private aiPlan: PlannedShot | null = null;
  private aiClock = 0;
  private thinkToast = false;
  // En línea: el servidor decide el resultado de cada tiro; aquí solo se anima.
  private online = false;
  private mySeat: 0 | 1 = 0;
  private shotDone = false;
  private pending: ShotOutcome | null = null;
  private linkUp = true;

  constructor() { super('Game'); }

  init(data: GameData) {
    this.opts = data ?? {};
    const diff = this.opts.difficulty ?? 'medium';
    this.ctl = new MatchController();
    this.ctl.aiPlayer = this.opts.mode === 'ai' ? 1 : null;
    this.ctl.difficulty = diff;
    this.ctl.blitz = !!this.opts.blitz;
    this.online = this.opts.mode === 'online';
    this.mySeat = this.online ? net.seat : 0;
    this.shotDone = false; this.pending = null; this.linkUp = true;
    this.names = this.online ? onlineNames(this.mySeat) : this.opts.mode === 'ai' ? aiNames(diff) : LOCAL_NAMES;
    this.aiPhase = 'idle'; this.ai = null; this.aiPlan = null;
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.paperCss);
    fadeIn(this);
    this.bgG = this.add.graphics().setDepth(-10);
    this.sfx = new Sfx(this);
    this.music = new Music(this);
    this.music.start();
    this.boardG = this.add.graphics();
    this.piecesG = this.add.graphics();
    this.fxG = this.add.graphics();
    this.aimG = this.add.graphics();
    this.root = this.add.container(0, 0, [this.boardG, this.piecesG, this.fxG, this.aimG]);

    this.scoreboard = new Scoreboard(this, this.names);
    this.toasts = new Toasts(this);
    this.modal = new Modal(this);
    this.modal.onPress = () => this.sfx.play('click-a');
    this.endOverlay = new InfoOverlay(this);
    this.endOverlay.onPress = () => this.sfx.play('click-a');
    this.bar = new BottomBar(this, {
      onPause: () => this.togglePause(),
      onRestart: () => this.startGame(),
      onAbandon: () => this.confirmAbandon(),
      online: this.online,
      onMusic: () => this.music.toggle(),
      onSfx: () => this.sfx.toggle(),
      onPress: () => this.sfx.play('click-a'),
    });
    this.strikerInput = new StrikerInput(this, {
      world: this.ctl.world,
      toWorld: (p) => ({ x: (p.x - this.root.x) / this.k, y: (p.y - this.root.y) / this.k }),
      side: () => this.ctl.currentSide(),
      onShoot: (shot) => this.fire(shot),
    });

    this.parts = new Particles(this, this.root);
    drawBoard(this.boardG);
    this.bar.setStates(this.music.enabled, this.sfx.enabled);
    this.startGame();
    this.layout();
    this.scale.on('resize', this.layout, this);
    if (this.online) this.bindNet();
    this.events.once('shutdown', () => { if (this.online) net.h = {}; this.music.stop(0); this.scale.off('resize', this.layout, this); this.toasts.clear(); });
    this.input.keyboard?.on('keydown-R', () => { if (!this.online) this.startGame(); });
    this.input.keyboard?.on('keydown-M', () => this.bar.setStates(this.music.toggle(), this.sfx.enabled));
    this.input.keyboard?.on('keydown-N', () => this.bar.setStates(this.music.enabled, this.sfx.toggle()));
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
  }

  private startGame() {
    this.modal.hide();
    this.toasts.clear();
    this.fx.clear();
    this.endOverlay.hide();
    this.lastTurnKey = '';
    if (this.online) { this.applySnapshot(this.opts.snapshot!); this.hint(); return; }
    this.ctl.newGame();
    this.beginTurn();
    this.hint();
  }

  // ------------------------------------------------------------ en línea

  private get myTurn() { return !this.online || this.ctl.current === this.mySeat; }

  /** Adopta el estado oficial del servidor (inicio, reconexión o corrección) y reanuda el turno. */
  private applySnapshot(s: { match: ShotOutcome['match']; layout: ShotOutcome['layout'] }) {
    this.modal.hide(); this.endOverlay.hide();
    this.shotDone = false; this.pending = null;
    this.ctl.applyOutcome({ match: s.match, layout: s.layout, ruleEvents: [], matchEvents: [] });
    this.fx.clear();
    this.lastTurnKey = '';
    if (this.ctl.phase === 'board') this.beginTurn();
    else { this.strikerInput.enabled = false; this.time.delayedCall(300, () => this.showEnd()); }
  }

  private bindNet() {
    net.h = {
      sync: (s) => { this.toasts.show('Conexión recuperada.', 1500); this.applySnapshot(s); },
      board: (m) => this.applySnapshot(m),
      shot: (m) => this.onNetShot(m),
      reject: () => net.requestSync(),
      peer: (up) => this.toasts.show(up ? 'Tu rival volvió.' : 'Tu rival perdió la conexión. Esperando…', up ? 2000 : 4000),
      link: (up) => { this.linkUp = up; if (!up) this.toasts.show('Conexión perdida. Reconectando…', 4000); },
      closed: (reason) => {
        this.modal.show({ title: 'Partida terminada', lines: [reason], buttons: [{ label: 'MENÚ', color: 'green', onClick: () => this.leaveOnline() }] });
      },
    };
  }

  private leaveOnline() { net.leave(); net.close(); fadeTo(this, 'Menu'); }

  private onNetShot(m: ShotMsg) {
    this.pending = m.outcome;
    if (m.seat === this.mySeat) { this.tryFinalize(); return; } // mi propio tiro: ya lo estoy animando
    if (!this.ctl.canAim() || this.ctl.current !== m.seat) { // desfasado: salto directo al resultado
      this.applySnapshot(m.outcome); this.pending = null; return;
    }
    const p = baselinePosition(this.ctl.currentSide(), m.t);
    this.ctl.world.moveStriker(p.x, p.y);
    this.ctl.fire(shotFromSpeed(m.v, Math.hypot(m.v.x, m.v.y)));
    this.sfx.play('switch-b', 0.5, 1.1);
  }

  /** El tiro se anima en local; al terminar (y llegar el resultado) se adopta el estado del servidor. */
  private tryFinalize() {
    if (!this.shotDone || !this.pending) return;
    const o = this.pending;
    this.pending = null; this.shotDone = false;
    this.ctl.applyOutcome(o);
    this.onShotFinished();
  }

  private nextBoard() {
    this.ctl.nextBoard();
    this.fx.clear();
    this.beginTurn();
  }

  /** Coloca el striker y, si le toca a la IA, arranca su planificación. */
  private beginTurn() {
    this.aiPhase = 'idle'; this.ai = null; this.aiPlan = null;
    this.strikerInput.placeAtCenter(); // en la pista del jugador en turno
    this.announceTurn();
    if (this.ctl.isAiTurn()) {
      this.strikerInput.enabled = false;
      this.ai = new AiRunner(this.ctl.world, this.ctl.board, this.ctl.difficulty);
      this.aiPhase = 'think';
      this.aiClock = 0;
      this.thinkToast = false;
    } else {
      this.strikerInput.enabled = this.myTurn;
    }
  }

  /** Banner breve al cambiar de jugador. */
  private announceTurn() {
    const b = this.ctl.board;
    if (this.ctl.phase !== 'board') return;
    const key = `${this.ctl.match.boardNumber}:${b.current}`;
    if (key === this.lastTurnKey) return;
    this.lastTurnKey = key;
    const text = this.online ? (b.current === this.mySeat ? 'TU TURNO' : 'TURNO DE TU RIVAL')
      : this.ctl.aiPlayer !== null
      ? (b.current === this.ctl.aiPlayer ? 'TURNO DE LA IA' : 'TU TURNO')
      : `TURNO DE ${this.names.full[b.current].toUpperCase()}`;
    this.time.delayedCall(280, () => this.showBanner(text)); // tras el fundido y el primer layout
  }

  private showBanner(text: string) {
    this.bannerObj?.destroy();
    const t = addText(this, 0, 0, text, 16, { color: PAL.inkCss });
    const w = t.width + u(52), h = t.height + u(20);
    const panel = new Panel(this, 0, 0, w, h);
    const y0 = this.scoreboard.height + u(30);
    const c = this.add.container(this.scale.width / 2, y0 - u(8), [panel, t]).setDepth(450).setAlpha(0);
    this.bannerObj = c;
    this.tweens.add({ targets: c, alpha: 1, y: y0, duration: 220, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1300, duration: 350, onComplete: () => { c.destroy(); if (this.bannerObj === c) this.bannerObj = undefined; } });
  }

  /** Posición de pantalla (px) de un punto del tablero (mm). */
  private toScreen(x: number, y: number) {
    return { x: this.root.x + x * this.k, y: this.root.y + y * this.k };
  }

  /** "+1", "+3" o "¡FALTA!" que sube desde el bolsillo, y la ficha que vuela hasta el marcador. */
  private pocketFeedback(pocket: number, kind: 'white' | 'black' | 'queen' | 'striker') {
    const p = POCKETS[pocket];
    const sc = this.toScreen(p.x, p.y);
    const label = kind === 'striker' ? '¡FALTA!' : kind === 'queen' ? '+3' : '+1';
    const color = kind === 'striker' ? '#e5484d' : kind === 'queen' ? '#e0a020' : '#1e9fd8';
    const tx = addText(this, sc.x, sc.y - u(14), label, kind === 'striker' ? 18 : 24, { color });
    tx.setStroke('#ffffff', u(5)).setDepth(600).setScale(0.4);
    this.tweens.add({ targets: tx, scale: 1.15, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: tx, y: sc.y - u(78), alpha: 0, delay: 350, duration: 650, ease: 'Sine.easeOut', onComplete: () => tx.destroy() });
    if (kind === 'striker') return;
    const b = this.ctl.board;
    const owner = kind === 'queen' ? b.current : b.players.findIndex((pl) => pl.color === kind);
    const dest = this.scoreboard.cardCenter(owner === 0 ? 0 : 1);
    const g = this.add.graphics({ x: sc.x, y: sc.y }).setDepth(590);
    drawPiece(g, kind, 0, 0, (BOARD.coinDiameter / 2) * this.k, 1, 1);
    this.tweens.add({ targets: g, x: dest.x, y: dest.y, scale: 0.45, alpha: 0.2, delay: 450, duration: 700, ease: 'Cubic.easeInOut', onComplete: () => { g.destroy(); this.scoreboard.flash(owner === 0 ? 0 : 1); } });
  }

  /** Pausa: congela la física y la IA y abre un menú con Continuar, Reiniciar y Menú. */
  private togglePause() {
    if (this.online) { this.onlinePauseMenu(); return; }
    if (this.paused) { this.modal.hide(); this.paused = false; return; }
    if (this.endOverlay.isOpen || this.modal.isOpen) return;
    this.paused = true;
    const resume = () => { this.paused = false; };
    this.modal.show({
      title: 'Pausa', lines: ['La partida está detenida.'],
      buttons: [
        { label: 'CONTINUAR', color: 'green', onClick: resume },
        { label: 'REINICIAR', color: 'yellow', onClick: () => { resume(); this.startGame(); } },
        { label: 'MENÚ', color: 'grey', onClick: () => { resume(); fadeTo(this, 'Menu'); } },
      ],
    });
  }

  /** Botón rojo: pide confirmación y, si se acepta, el jugador pierde la partida. */
  private confirmAbandon() {
    if (this.endOverlay.isOpen || this.ctl.phase === 'over') return;
    if (this.modal.isOpen) return;
    const wasPaused = this.paused;
    if (!this.online) this.paused = true; // la partida se congela mientras se decide
    const cancel = () => { if (!this.online) this.paused = wasPaused; };
    const who = this.online ? 'Perderás la partida y tu rival será el ganador.'
      : this.ctl.aiPlayer !== null ? 'Perderás la partida contra la IA.'
      : `${this.names.full[this.ctl.current]} perderá la partida.`;
    this.modal.show({
      title: '¿Abandonar la partida?', lines: [who],
      buttons: [
        { label: 'ABANDONAR PARTIDA', color: 'red', onClick: () => this.abandon() },
        { label: 'SEGUIR JUGANDO', color: 'green', onClick: cancel },
      ],
    });
  }

  private abandon() {
    if (this.online) { net.resign(); return; } // el servidor responde con el final de la partida
    this.paused = false;
    const loser = this.ctl.aiPlayer !== null ? (this.ctl.aiPlayer === 0 ? 1 : 0) : this.ctl.current;
    this.ctl.resign(loser);
    this.strikerInput.enabled = false;
    this.strikerInput.cancel();
    this.aiPhase = 'idle'; this.ai = null; this.aiPlan = null;
    this.time.delayedCall(200, () => this.showEnd());
  }

  /** En línea la partida no se detiene: el menú solo permite salir. */
  private onlinePauseMenu() {
    if (this.modal.isOpen) { this.modal.hide(); return; }
    if (this.endOverlay.isOpen) return;
    this.modal.show({
      title: 'Menú', lines: [`Sala ${net.code}`, 'Si sales, la partida termina para tu rival. Para rendirte usa ABANDONAR.'],
      buttons: [
        { label: 'CONTINUAR', color: 'green', onClick: () => {} },
        { label: 'SALIR DE LA PARTIDA', color: 'grey', onClick: () => this.leaveOnline() },
      ],
    });
  }

  private updateAi(delta: number) {
    this.aiClock += delta;
    if (this.aiPhase === 'think' && this.ai) {
      if (!this.thinkToast && this.aiClock > 250) { this.thinkToast = true; this.toasts.show('La IA está pensando…', 1500); }
      const plan = this.ai.tick(8);
      if (plan && this.aiClock > 600) { this.aiPlan = plan; this.aiPhase = 'move'; this.aiClock = 0; }
    } else if (this.aiPhase === 'move' && this.aiPlan) {
      const k = Math.min(1, this.aiClock / 500);
      const e = k * k * (3 - 2 * k);
      const p = baselinePosition(this.ctl.currentSide(), 0.5 + (this.aiPlan.t - 0.5) * e);
      this.ctl.world.moveStriker(p.x, p.y);
      if (k >= 1) { this.ctl.world.moveStriker(this.aiPlan.position.x, this.aiPlan.position.y); this.aiPhase = 'aim'; this.aiClock = 0; }
    } else if (this.aiPhase === 'aim' && this.aiPlan) {
      if (this.aiClock > 650) {
        const shot = this.aiPlan.shot;
        this.aiPhase = 'idle'; this.ai = null; this.aiPlan = null;
        this.fire(shot);
      }
    }
  }

  /** Vector de arrastre equivalente al tiro de la IA (para dibujar su apuntado). */
  private aiPull(plan: PlannedShot, grow: number): { x: number; y: number } {
    const v = plan.shot.velocity;
    const sp = Math.hypot(v.x, v.y) || 1;
    const frac = Math.max(0, Math.min(1, (sp - SHOT.minSpeed) / (SHOT.maxSpeed - SHOT.minSpeed)));
    const drag = (SHOT.minDrag + frac * (SHOT.maxDrag - SHOT.minDrag)) * grow;
    return { x: (-v.x / sp) * drag, y: (-v.y / sp) * drag };
  }

  private hint() {
    if (this.hinted) return;
    this.hinted = true;
    this.toasts.show('Arrastra desde el striker hacia atrás para apuntar. Arrastra sobre tu pista para colocarlo.', 6000);
  }

  private fire(shot: ShotParams) {
    if (this.ctl.fire(shot)) {
      if (this.online) net.shoot(this.strikerInput.t, shot.velocity);
      this.strikerInput.enabled = false;
      this.sfx.play('switch-b', 0.5, 1.1);
    }
  }

  private onTick(r: AdvanceResult, now: number) {
    r.hits.sort((a, b) => b.speed - a.speed).slice(0, 3).forEach((h) => { const wall = h.a === 'wall' || h.b === 'wall'; this.sfx.hit(h.speed, wall); this.parts.hit(h.x, h.y, h.speed, wall); });
    for (const e of r.pocketed) {
      this.fx.addPocket(e.pocket, e.kind, now);
      this.parts.pocket(e.pocket, e.kind);
      this.pocketFeedback(e.pocket, e.kind);
      this.sfx.play('switch-a', 0.6, e.kind === 'striker' ? 0.7 : 1);
    }
    if (r.finished) { if (this.online) { this.shotDone = true; this.tryFinalize(); } else this.onShotFinished(); }
  }

  private onShotFinished() {
    const board = this.ctl.board;
    for (const e of this.ctl.lastRuleEvents) {
      const msg = describeRuleEvent(board, e, this.names);
      if (msg && e.type !== 'turn-change') this.toasts.show(msg);
      if (e.type === 'foul') this.sfx.play('click-b', 0.7, 0.8);
    }
    if (this.ctl.phase === 'board') {
      this.beginTurn();
    } else {
      this.strikerInput.enabled = false;
      this.time.delayedCall(900, () => this.showEnd());
    }
  }

  private showEnd() {
    const m = this.ctl.match;
    const humanWon = (w: number) => this.online ? w === this.mySeat : this.ctl.aiPlayer === null || w !== this.ctl.aiPlayer;
    if (m.phase === 'between') {
      const w = m.boards[m.boards.length - 1].winner;
      if (humanWon(w)) this.parts.celebrate(false); else this.parts.sad();
      this.modal.show({
        title: `Tablero ${m.boardNumber} terminado`, lines: boardEndLines(m, this.names),
        buttons: [{ label: 'SIGUIENTE TABLERO', color: 'green', onClick: () => (this.online ? net.continueMatch() : this.nextBoard()) }],
      });
    } else if (m.phase === 'over') {
      const w = m.winner ?? 0;
      const won = humanWon(w);
      if (won) this.parts.celebrate(true); else this.parts.sad();
      const reason = boardEndLines(m, this.names)[0];
      this.endOverlay.open(this.names.win[w], () => endSummaryContent(m, this.names, won, reason), [
        { label: 'NUEVA PARTIDA', color: 'green', primary: true, onClick: () => (this.online ? net.continueMatch() : this.startGame()) },
        { label: 'MENÚ', color: 'grey', onClick: () => (this.online ? this.leaveOnline() : fadeTo(this, 'Menu')) },
      ]);
    }
  }

  update(_t: number, delta: number) {
    const now = this.time.now;
    if (this.paused) { /* congelado: solo se redibuja */ }
    else if (this.ctl.shotInFlight) this.onTick(this.ctl.advance(delta), now);
    else if (this.ctl.canAim()) {
      if (this.ctl.isAiTurn()) this.updateAi(delta);
      else this.strikerInput.update(delta);
    }

    this.scoreboard.update(this.ctl.match);
    this.piecesG.clear();
    this.fxG.clear();
    this.aimG.clear();
    const striker = this.ctl.world.getStriker();
    const valid = this.ctl.shotInFlight || this.strikerInput.isPlacementValid();
    this.pieces.draw(this.piecesG, this.ctl.world.pieces, now, valid);
    this.fx.draw(this.fxG, now);

    if (this.ctl.canAim() && this.aiPhase === 'aim' && this.aiPlan && striker) {
      const grow = Math.min(1, this.aiClock / 450);
      drawAim(this.aimG, striker, this.aiPull(this.aiPlan, grow), this.aiPlan.shot, this.ctl.world.pieces, true);
    }
    if (this.ctl.canAim() && !this.ctl.isAiTurn() && this.myTurn) {
      const r = trackRect(this.ctl.currentSide());
      const a = 0.45 + 0.25 * Math.sin(now / 280);
      this.aimG.lineStyle(5, PAL.blue, a).strokeRoundedRect(r.rx, r.ry, r.rw, r.rh, r.pad);
    }
    const pull = this.strikerInput.pull;
    if (striker && this.strikerInput.mode === 'aim' && pull) {
      drawAim(this.aimG, striker, pull, this.strikerInput.currentShot(), this.ctl.world.pieces, valid);
    }
  }

  private layout() {
    const { width: W, height: H } = this.scale;
    this.scoreboard.refresh(this.ctl.match);
    this.bar.layout();
    const top = this.scoreboard.height, bottom = this.bar.height;
    const avail = H - top - bottom;
    const total = BOARD.size + BOARD.frameThickness * 2;
    this.k = Math.min(W - u(16), avail - u(8)) / (total * 1.02);
    this.root.setPosition(W / 2, top + avail / 2).setScale(this.k);
    this.toasts.anchorY = H - bottom - u(6);
    this.toasts.layout();
    this.modal.relayout();
    this.endOverlay.relayout();
    this.drawBackground();
  }

  /** Fondo con degradado suave y manchas de color translúcidas. */
  private drawBackground() {
    const { width: W, height: H } = this.scale;
    const g = this.bgG.clear();
    const n = 28;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(0xf8, 0xf4, 0xeb), new Phaser.Display.Color(0xe9, 0xe3, 0xd5), 100, f * 100);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, (H * i) / n, W, H / n + 1);
    }
    g.fillStyle(PAL.blue, 0.05).fillCircle(W * 0.05, H * 0.8, Math.max(W, H) * 0.28);
    g.fillStyle(PAL.queen, 0.045).fillCircle(W * 0.98, H * 0.28, Math.max(W, H) * 0.22);
    g.fillStyle(PAL.gold, 0.05).fillCircle(W * 0.9, H * 0.92, Math.max(W, H) * 0.18);
  }
}

