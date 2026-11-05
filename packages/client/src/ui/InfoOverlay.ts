import Phaser from 'phaser';
import { PAL, u } from '../theme';
import { Panel, UIButton, addText } from './widgets';

/** Contenido de un panel informativo. Todo se dibuja en px de canvas con el origen arriba a la izquierda. */
export interface InfoContent {
  w: number;
  h: number;
  build(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void;
}

export interface InfoButton { label: string; color?: 'green' | 'blue' | 'grey' | 'yellow' | 'red'; primary?: boolean; onClick: () => void }

export type InfoBuilder = (wide: boolean) => InfoContent;

/** Panel centrado con título, contenido ilustrado (se escala para caber) y botón de cierre. */
export class InfoOverlay {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private last?: { title: string; make: InfoBuilder; close: string | InfoButton[] };
  onPress?: () => void;

  constructor(private scene: Phaser.Scene) {}

  get isOpen() { return this.objs.length > 0; }

  open(title: string, make: InfoBuilder, close: string | InfoButton[] = 'ENTENDIDO') {
    this.hide();
    this.last = { title, make, close };
    const s = this.scene, W = s.scale.width, H = s.scale.height;
    const wide = W >= u(720);
    const content = make(wide);
    const pw = Math.min(W - u(20), content.w + u(48));
    const dim = s.add.rectangle(W / 2, H / 2, W, H, PAL.ink, 0.5).setDepth(900).setInteractive();
    const titleT = addText(s, 0, 0, title, 22, { color: PAL.inkCss }).setDepth(902);
    const bh = u(50), bgap = u(10);
    const buttons: InfoButton[] = typeof close === 'string' ? [{ label: close, color: 'green', primary: true, onClick: () => {} }] : close;
    const btnH = buttons.length * bh + (buttons.length - 1) * bgap;
    const chrome = u(20) + titleT.height + u(12) + u(14) + btnH + u(18);
    const fit = Math.min(1, (pw - u(32)) / content.w, (H - u(16) - chrome) / content.h);
    const ph = chrome + content.h * fit;
    const cx = W / 2, top = H / 2 - ph / 2;
    const panel = new Panel(s, cx, H / 2, pw, ph).setDepth(901);
    titleT.setPosition(cx, top + u(20) + titleT.height / 2);
    const cy = top + u(20) + titleT.height + u(12);
    const box = s.add.container(cx - (content.w * fit) / 2, cy).setScale(fit).setDepth(902);
    content.build(s, box);
    const btns = buttons.map((b, i) => new UIButton(s, cx, cy + content.h * fit + u(14) + bh / 2 + i * (bh + bgap), Math.min(pw - u(64), u(300)), bh, b.label, {
      color: b.color ?? 'green', style: b.primary ? 'gloss' : 'border', fontSize: 16, onPress: () => this.onPress?.(), onClick: () => { this.hide(); b.onClick(); },
    }).setDepth(903));
    this.objs = [dim, panel, titleT, box, ...btns];
    for (const o of this.objs) (o as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject).setAlpha?.(0);
    s.tweens.add({ targets: this.objs, alpha: 1, duration: 180 });
  }

  hide() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
  }

  relayout() {
    if (this.isOpen && this.last) this.open(this.last.title, this.last.make, this.last.close);
  }
}
