import Phaser from 'phaser';
import { PAL, u, type UIColor } from '../theme';
import { Panel, UIButton, addText } from './widgets';

export interface ModalButton { label: string; color?: UIColor; onClick: () => void }
export interface ModalOpts { title: string; lines?: string[]; buttons: ModalButton[] }

/** Diálogo central con atenuado de fondo; bloquea la entrada del juego mientras está abierto. */
export class Modal {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private last?: ModalOpts;
  onPress?: () => void;

  constructor(private scene: Phaser.Scene) {}

  get isOpen() { return this.objs.length > 0; }

  show(o: ModalOpts) {
    this.hide();
    this.last = o;
    const s = this.scene;
    const W = s.scale.width, H = s.scale.height;
    const pw = Math.min(W - u(32), u(460));
    const dim = s.add.rectangle(W / 2, H / 2, W, H, PAL.ink, 0.45).setDepth(900).setInteractive();
    const body = addText(s, 0, 0, (o.lines ?? []).join('\n'), 14, { wrap: pw - u(56), align: 'center' }).setDepth(902);
    const title = addText(s, 0, 0, o.title, 22, { wrap: pw - u(48), align: 'center' }).setDepth(902);
    const bh = u(54), gap = u(12);
    const ph = u(36) + title.height + u(14) + (o.lines?.length ? body.height + u(18) : 0) + o.buttons.length * (bh + gap) + u(10);
    const cx = W / 2, top = H / 2 - ph / 2;
    const panel = new Panel(s, cx, H / 2, pw, ph).setDepth(901);

    let y = top + u(22) + title.height / 2;
    title.setPosition(cx, y);
    y += title.height / 2 + u(14);
    if (o.lines?.length) { body.setPosition(cx, y + body.height / 2); y += body.height + u(18); } else body.destroy();
    const btns: UIButton[] = [];
    for (const b of o.buttons) {
      y += bh / 2;
      btns.push(new UIButton(s, cx, y, pw - u(64), bh, b.label, {
        color: b.color, fontSize: 16, onPress: () => this.onPress?.(),
        onClick: () => { this.hide(); b.onClick(); },
      }).setDepth(903));
      y += bh / 2 + gap;
    }
    this.objs = [dim, panel, title, ...(o.lines?.length ? [body] : []), ...btns];
    for (const ob of this.objs) (ob as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject).setAlpha?.(0);
    s.tweens.add({ targets: this.objs, alpha: 1, duration: 180 });
  }

  hide() {
    for (const ob of this.objs) ob.destroy();
    this.objs = [];
  }

  /** Reconstruye el diálogo abierto tras un cambio de tamaño. */
  relayout() {
    if (this.isOpen && this.last) this.show(this.last);
  }
}
