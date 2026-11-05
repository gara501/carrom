import type Phaser from 'phaser';
import { saveSettings, settings } from './settings';

/** Sonidos del pack de Kenney reutilizados para el juego. */
export const SFX_FILES: Record<string, string> = {
  'click-a': 'click-a.ogg',
  'click-b': 'click-b.ogg',
  'switch-a': 'switch-a.ogg',
  'switch-b': 'switch-b.ogg',
  'tap-a': 'tap-a.ogg',
  'tap-b': 'tap-b.ogg',
};

/** Efectos de sonido; se activan o silencian con la preferencia `sfx` (la música es independiente). */
export class Sfx {
  constructor(private scene: Phaser.Scene) {}

  get enabled() { return settings.sfx; }

  /** Alterna los efectos y devuelve el nuevo estado (true = activos). */
  toggle(): boolean {
    saveSettings({ sfx: !settings.sfx });
    return settings.sfx;
  }

  play(key: keyof typeof SFX_FILES, volume = 0.6, rate = 1) {
    if (!settings.sfx) return;
    this.scene.sound.play(key, { volume: Math.min(1, Math.max(0, volume)), rate });
  }

  /** Choque pieza-pieza o pieza-banda; el volumen depende de la velocidad del impacto (mm/s). */
  hit(speed: number, wall: boolean) {
    if (speed < 60) return;
    const v = Math.min(1, speed / 2600) * 0.7;
    this.play(wall ? 'tap-b' : 'tap-a', v, 0.9 + Math.random() * 0.2);
  }
}
