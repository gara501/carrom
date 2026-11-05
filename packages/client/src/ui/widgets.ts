import Phaser from 'phaser';
import { FONT, PAL, texScale, u, type UIColor } from '../theme';

export interface TextOpts {
  font?: string;
  color?: string;
  origin?: [number, number];
  align?: 'left' | 'center' | 'right';
  wrap?: number; // px de canvas
}

/** Texto con tamaño en px de CSS (se escala con la densidad de píxeles). */
export function addText(
  scene: Phaser.Scene, x: number, y: number, text: string, cssSize: number, o: TextOpts = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: o.font ?? FONT,
    fontSize: `${u(cssSize)}px`,
    color: o.color ?? PAL_INK,
    fontStyle: 'bold',
    align: o.align ?? 'left',
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
  });
  const [ox, oy] = o.origin ?? [0.5, 0.5];
  return t.setOrigin(ox, oy);
}
const PAL_INK = '#2b3a55';

/** Tarjeta blanca de 9-slice (sombras y bordes de Kenney). Posición = centro; tamaño en px de canvas. */
export class Panel extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.NineSlice;
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tint?: number) {
    super(scene, x, y);
    const ts = texScale();
    this.bg = scene.add.nineslice(0, 0, 'panel_white', undefined, w / ts, h / ts, 30, 30, 30, 30).setScale(ts);
    if (tint !== undefined) this.bg.setTint(tint);
    this.add(this.bg);
    this.setSize(w, h);
    scene.add.existing(this);
  }
}

export interface ButtonOpts {
  color?: UIColor;
  /** solid = botón sólido, gloss = brillante (principal), border = blanco con borde de color. */
  style?: 'solid' | 'gloss' | 'border';
  fontSize?: number; // px CSS
  onClick?: () => void;
  disabled?: boolean;
  onPress?: () => void; // sonido u otros efectos
}

/** Botón 9-slice de Kenney con estado pulsado. Posición = centro; tamaño en px de canvas. */
export class UIButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  private color: UIColor;
  private pressed = false;
  private disabled: boolean;
  private prefix: string;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, private opts: ButtonOpts = {}) {
    super(scene, x, y);
    const ts = texScale();
    this.disabled = !!opts.disabled;
    this.prefix = opts.style === 'gloss' ? 'gl' : opts.style === 'border' ? 'bd' : 'btn';
    this.color = this.disabled ? 'grey' : opts.color ?? 'blue';
    this.bg = scene.add.nineslice(0, 0, `${this.prefix}_${this.color}`, undefined, w / ts, h / ts, 26, 26, 26, 34).setScale(ts);
    const light = this.opts.style === 'border' || this.color === 'grey' || this.color === 'yellow'; // fondos claros: texto oscuro
    this.label = addText(scene, 0, -u(2), text, opts.fontSize ?? 15, {
      color: this.disabled ? '#4f5d78' : light ? '#2b3a55' : '#ffffff',
    });
    if (!this.disabled && !light) this.label.setShadow(0, u(2), '#0d4e72', 0, false, true);
    this.add([this.bg, this.label]);
    this.setSize(w, h);

    if (!this.disabled) {
      this.setInteractive({ useHandCursor: true });
      this.on('pointerdown', () => this.setPressed(true));
      this.on('pointerup', () => { if (this.pressed) { this.setPressed(false); this.opts.onPress?.(); this.opts.onClick?.(); } });
      this.on('pointerout', () => this.setPressed(false));
    }
    scene.add.existing(this);
  }

  setText(s: string) { this.label.setText(s); }

  /** Cambia el color del botón (p. ej. gris cuando una opción está desactivada). */
  setLook(color: UIColor) {
    this.color = color;
    const light = this.opts.style === 'border' || color === 'grey' || color === 'yellow';
    this.label.setColor(light ? '#2b3a55' : '#ffffff');
    if (light) this.label.setShadow(0, 0, '#000000', 0, false, false);
    else this.label.setShadow(0, u(2), '#0d4e72', 0, false, true);
    this.bg.setTexture(`${this.prefix}_${color}`);
  }

  private setPressed(p: boolean) {
    if (this.pressed === p) return;
    this.pressed = p;
    this.bg.setTexture(p ? `${this.prefix}_${this.color}_down` : `${this.prefix}_${this.color}`);
    this.label.y = p ? u(3) : -u(2);
  }
}
