import Phaser from 'phaser';
import { u } from '../theme';
import { UIButton } from './widgets';

export interface BarHandlers {
  onPause: () => void;
  onRestart: () => void;
  /** Devuelven true si la música / los efectos quedan activos. */
  onMusic: () => boolean;
  onSfx: () => boolean;
  onPress: () => void;
}

/** Barra inferior: Pausa, Música, Efectos y Reiniciar. */
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
    const base = small ? [70, 92, 96, 100] : [92, 120, 124, 132];
    const avail = W - m * 2 - gap * 3;
    const k = Math.min(1, avail / u(base.reduce((a, b) => a + b, 0)));
    const [wP, wM, wF, wR] = base.map((v) => u(v) * k);
    const common = { fontSize: (small ? 12 : 13) * Math.max(0.85, k), onPress: this.h.onPress };
    let x = m;
    const place = (w: number, text: string, color: 'blue' | 'grey' | 'yellow', onClick: () => void) => {
      const b = new UIButton(s, x + w / 2, y, w, bh, text, { ...common, color, onClick });
      b.setDepth(100);
      this.btns.push(b);
      x += w + gap;
      return b;
    };
    place(wP, 'PAUSA', 'grey', this.h.onPause);
    this.music = place(wM, 'MÚSICA', 'blue', () => this.setStates(this.h.onMusic(), this.sfxOn));
    this.sfx = place(wF, 'EFECTOS', 'blue', () => this.setStates(this.musicOn, this.h.onSfx()));
    place(wR, 'REINICIAR', 'yellow', this.h.onRestart);
    this.setStates(this.musicOn, this.sfxOn);
  }
}
