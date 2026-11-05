import Phaser from 'phaser';
import { u } from '../theme';
import { UIButton } from './widgets';

export interface BarHandlers {
  onPause: () => void;
  onRestart: () => void;
  /** Rendirse (botón rojo). */
  onAbandon: () => void;
  /** En línea no hay botón de reiniciar. */
  online?: boolean;
  /** Devuelven true si la música / los efectos quedan activos. */
  onMusic: () => boolean;
  onSfx: () => boolean;
  onPress: () => void;
}

/** Barra inferior: Pausa, Música, Efectos, Reiniciar y Abandonar partida. */
export class BottomBar {
  private btns: UIButton[] = [];
  private music?: UIButton;
  private sfx?: UIButton;
  private musicOn = true;
  private sfxOn = true;
  height = u(66);

  constructor(private scene: Phaser.Scene, private h: BarHandlers) {}

  /** Refleja el estado de música y efectos en los botones. */
  setStates(music: boolean, sfx: boolean) {
    this.musicOn = music;
    this.sfxOn = sfx;
    this.music?.setText(music ? 'MÚSICA' : 'SIN MÚSICA');
    this.music?.setLook(music ? 'blue' : 'grey');
    this.sfx?.setText(sfx ? 'EFECTOS' : 'SIN EFECTOS');
    this.sfx?.setLook(sfx ? 'blue' : 'grey');
  }

  layout() {
    for (const b of this.btns) b.destroy();
    this.btns = [];
    const s = this.scene, W = s.scale.width, H = s.scale.height;
    const bh = u(44), m = u(10), gap = u(8), y = H - this.height / 2;
    const small = W < u(520);
    const online = !!this.h.online;
    const long = W >= u(800);
    const base = small ? [58, 74, 78, 86, 92] : long ? [92, 120, 124, 132, 190] : [80, 100, 104, 112, 130];
    if (online) base.splice(3, 1); // sin REINICIAR
    const avail = W - m * 2 - gap * (base.length - 1);
    const k = Math.min(1, avail / u(base.reduce((a, b) => a + b, 0)));
    const ws = base.map((v) => u(v) * k);
    const common = { fontSize: (small ? 12 : 13) * Math.max(0.85, k), onPress: this.h.onPress };
    let x = m;
    const place = (w: number, text: string, color: 'blue' | 'grey' | 'yellow' | 'red', onClick: () => void) => {
      const b = new UIButton(s, x + w / 2, y, w, bh, text, { ...common, color, onClick });
      b.setDepth(100);
      this.btns.push(b);
      x += w + gap;
      return b;
    };
    let i = 0;
    place(ws[i++], online ? 'MENÚ' : 'PAUSA', 'grey', this.h.onPause);
    this.music = place(ws[i++], 'MÚSICA', 'blue', () => this.setStates(this.h.onMusic(), this.sfxOn));
    this.sfx = place(ws[i++], 'EFECTOS', 'blue', () => this.setStates(this.musicOn, this.h.onSfx()));
    if (!online) place(ws[i++], 'REINICIAR', 'yellow', this.h.onRestart);
    place(ws[i++], small || !long ? 'ABANDONAR' : 'ABANDONAR PARTIDA', 'red', this.h.onAbandon);
    this.setStates(this.musicOn, this.sfxOn);
  }
}
