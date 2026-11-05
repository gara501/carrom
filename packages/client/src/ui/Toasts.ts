import Phaser from 'phaser';
import { FONT, u } from '../theme';
import { Panel } from './widgets';

interface Toast { c: Phaser.GameObjects.Container; h: number }

/** Mensajes breves apilados en la parte inferior de la pantalla. */
export class Toasts {
  private items: Toast[] = [];
  /** Línea base (borde inferior del primer mensaje) en px de canvas. */
  anchorY = 0;

  constructor(private scene: Phaser.Scene) {}

  show(msg: string, ms = 3200) {
    const s = this.scene;
    const maxW = s.scale.width * 0.9;
    const text = s.add.text(0, 0, msg, {
      fontFamily: FONT, fontSize: `${u(13)}px`, color: '#2b3a55', align: 'center',
      wordWrap: { width: Math.min(maxW - u(40), u(560)) },
    }).setOrigin(0.5);
    const w = text.width + u(44), h = text.height + u(24);
    const panel = new Panel(s, 0, 0, w, h);
    const c = s.add.container(s.scale.width / 2, this.anchorY, [panel, text]).setDepth(500).setAlpha(0);
    const item: Toast = { c, h };
    this.items.push(item);
    while (this.items.length > 3) this.remove(this.items[0], true);
    this.layout();
    s.tweens.add({ targets: c, alpha: 1, duration: 160 });
    s.tweens.add({
      targets: c, alpha: 0, delay: ms, duration: 350,
      onComplete: () => this.remove(item, false),
    });
  }

  private remove(item: Toast, immediate: boolean) {
    const i = this.items.indexOf(item);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.scene.tweens.killTweensOf(item.c);
    item.c.destroy();
    if (!immediate) this.layout();
  }

  /** Recoloca los mensajes (llamar al cambiar el tamaño de la ventana). */
  layout() {
    let y = this.anchorY;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.c.x = this.scene.scale.width / 2;
      it.c.y = y - it.h / 2;
      y -= it.h + u(8);
    }
  }

  clear() {
    for (const it of [...this.items]) this.remove(it, true);
  }
}
