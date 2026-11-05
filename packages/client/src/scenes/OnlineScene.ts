import Phaser from 'phaser';
import { PAL, u } from '../theme';
import { Sfx } from '../audio/sfx';
import { fadeIn, fadeTo } from '../ui/transition';
import { Panel, UIButton, addText } from '../ui/widgets';
import { net, type Snapshot } from '../net/OnlineClient';
import { settings } from '../audio/settings';

type View = 'connecting' | 'menu' | 'waiting' | 'join' | 'error';

/** Lobby en línea: crear una sala (código de 4 letras) o unirse a la de un amigo. */
export class OnlineScene extends Phaser.Scene {
  private view: View = 'connecting';
  private ui: Phaser.GameObjects.GameObject[] = [];
  private sfx!: Sfx;
  private message = '';
  private code = '';
  private codeEl?: HTMLInputElement;
  private dots = 0;
  private statusText?: Phaser.GameObjects.Text;
  private gone = false;

  constructor() { super('Online'); }

  create() {
    this.gone = false;
    this.view = 'connecting';
    this.cameras.main.setBackgroundColor('#fef6eb');
    fadeIn(this);
    this.sfx = new Sfx(this);
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => { this.gone = true; this.removeInput(); this.scale.off('resize', this.layout, this); });
    net.h = {
      start: (s) => this.begin(s),
      closed: (r) => { this.message = r; this.setView('menu'); },
    };
    this.time.addEvent({ delay: 400, loop: true, callback: () => { this.dots = (this.dots + 1) % 4; this.statusText?.setText(this.statusLabel()); } });
    this.connect();
  }

  private async connect() {
    this.setView('connecting');
    try {
      await net.connect();
      if (!this.gone) { this.message = ''; this.setView('menu'); }
    } catch (e) {
      if (!this.gone) { this.message = (e as Error).message; this.setView('error'); }
    }
  }

  private begin(snapshot: Snapshot) {
    if (this.gone) return;
    this.gone = true;
    fadeTo(this, 'Game', { mode: 'online', snapshot });
  }

  private setView(v: View) {
    this.view = v;
    this.removeInput();
    this.layout();
  }

  private statusLabel() {
    const d = '.'.repeat(this.dots);
    if (this.view === 'connecting') return `Conectando con el servidor${d}\n(la primera vez puede tardar unos segundos)`;
    if (this.view === 'waiting') return `Esperando a tu rival${d}`;
    return this.message;
  }

  private removeInput() { this.codeEl?.remove(); this.codeEl = undefined; }

  private async run(job: () => Promise<string>, next: View) {
    try { this.message = ''; await job(); if (!this.gone) { this.code = net.code; this.setView(next); } }
    catch (e) { this.message = (e as Error).message; this.setView(this.view === 'join' ? 'join' : 'menu'); }
  }

  private leave() { net.leave(); this.message = ''; this.setView('menu'); }

  private layout() {
    for (const o of this.ui) o.destroy();
    this.ui = [];
    this.statusText = undefined;
    const { width: W, height: H } = this.scale;
    const cx = W / 2;
    const pw = Math.min(W - u(32), u(440));
    const press = () => this.sfx.play('click-a');
    const bw = pw - u(64), bh = u(54);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.ui.push(o); return o; };
    const btn = (y: number, label: string, onClick: () => void, color: 'blue' | 'green' | 'grey' = 'blue', style: 'gloss' | 'border' = 'border') =>
      add(new UIButton(this, cx, y, bw, bh, label, { color, style, fontSize: 16, onClick, onPress: press }));

    const rows: number = this.view === 'menu' ? 3 : this.view === 'join' ? 3 : 1;
    const ph = Math.min(H - u(24), u(210) + rows * (bh + u(12)) + (this.view === 'waiting' ? u(80) : 0));
    const top = H / 2 - ph / 2;
    add(new Panel(this, cx, H / 2, pw, ph));
    add(addText(this, cx, top + u(34), 'JUGAR EN LÍNEA', 22));
    let y = top + u(76);

    const status = () => {
      this.statusText = add(addText(this, cx, y + u(20), this.statusLabel(), 13, { wrap: pw - u(56), align: 'center', color: this.view === 'error' || this.message ? '#c0392b' : PAL.inkCss })) as Phaser.GameObjects.Text;
      y += this.statusText.height + u(30);
    };

    switch (this.view) {
      case 'connecting':
        status();
        btn(y + bh / 2, 'VOLVER', () => { net.close(); fadeTo(this, 'Menu'); }, 'grey');
        break;
      case 'error':
        status();
        btn(y + bh / 2, 'REINTENTAR', () => { net.close(); void this.connect(); }, 'blue', 'gloss');
        btn(y + bh * 1.5 + u(12), 'VOLVER', () => { net.close(); fadeTo(this, 'Menu'); }, 'grey');
        break;
      case 'menu':
        if (this.message) status();
        btn(y + bh / 2, 'CREAR SALA', () => void this.run(() => net.create(settings.blitz), 'waiting'), 'blue', 'gloss');
        y += bh + u(12);
        btn(y + bh / 2, 'UNIRSE A UNA SALA', () => this.setView('join'));
        y += bh + u(12);
        btn(y + bh / 2, 'VOLVER', () => { net.close(); fadeTo(this, 'Menu'); }, 'grey');
        break;
      case 'waiting': {
        add(addText(this, cx, y, settings.blitz ? 'Modo relámpago · comparte este código' : 'Comparte este código con tu rival', 13));
        y += u(52);
        add(addText(this, cx, y, this.code.split('').join(' '), 44, { color: PAL.blueCss }));
        y += u(50);
        status();
        btn(y + bh / 2, 'CANCELAR', () => this.leave(), 'grey');
        break;
      }
      case 'join': {
        add(addText(this, cx, y, 'Escribe el código de la sala', 13));
        y += u(30);
        if (this.message) { add(addText(this, cx, y + u(4), this.message, 12, { color: '#c0392b' })); y += u(24); }
        this.placeInput(cx, y + u(24), bw);
        y += u(66);
        btn(y + bh / 2, 'UNIRSE', () => this.submit(), 'blue', 'gloss');
        y += bh + u(12);
        btn(y + bh / 2, 'VOLVER', () => { this.message = ''; this.setView('menu'); }, 'grey');
        break;
      }
    }
  }

  /** Campo de texto HTML sobre el canvas (así funciona el teclado del móvil). */
  private placeInput(cx: number, cy: number, w: number) {
    const el = document.createElement('input');
    const canvas = this.game.canvas.getBoundingClientRect();
    const k = canvas.width / this.scale.width;
    el.type = 'text'; el.maxLength = 4; el.autocapitalize = 'characters'; el.autocomplete = 'off'; el.spellcheck = false;
    el.placeholder = 'ABCD';
    el.value = this.codeEl?.value ?? '';
    Object.assign(el.style, {
      position: 'fixed', left: `${canvas.left + (cx - w / 2) * k}px`, top: `${canvas.top + (cy - u(24)) * k}px`,
      width: `${w * k}px`, height: `${u(48) * k}px`, textAlign: 'center', fontSize: `${u(28) * k}px`, letterSpacing: '0.35em',
      fontFamily: 'Play, sans-serif', fontWeight: 'bold', textTransform: 'uppercase', color: PAL.inkCss,
      border: `2px solid ${PAL.blueCss}`, borderRadius: '10px', background: '#fff', outline: 'none', zIndex: '10', boxSizing: 'border-box',
    } as Partial<CSSStyleDeclaration>);
    el.addEventListener('input', () => { el.value = el.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submit(); e.stopPropagation(); });
    document.body.appendChild(el);
    this.codeEl = el;
    setTimeout(() => el.focus(), 50);
  }

  private submit() {
    const code = (this.codeEl?.value ?? '').trim().toUpperCase();
    if (code.length !== 4) { this.message = 'El código tiene 4 letras.'; this.setViewKeep(); return; }
    this.removeInput();
    void this.run(() => net.join(code), 'waiting');
  }

  private setViewKeep() { const v = this.codeEl?.value; this.removeInput(); this.layout(); if (this.codeEl && v) this.codeEl.value = v; }
}
