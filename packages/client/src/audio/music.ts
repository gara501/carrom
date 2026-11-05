import type Phaser from 'phaser';
import { saveSettings, settings } from './settings';

// Las pistas viven en public/assets/music; Vite las resuelve (dev y build) sin depender de la carpeta pública.
const TRACKS = Object.entries(
  import.meta.glob('../../public/assets/music/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
).map(([path, url]) => ({ key: `music:${path.split('/').pop()}`, url }));

const VOLUME = 0.3;

/**
 * Música de fondo de los tableros: lista aleatoria que se reproduce en bucle.
 * Cada pista se descarga al llegar su turno (pesan varios MB). Se activa o silencia
 * con la preferencia `music`, independiente de los efectos.
 */
export class Music {
  private order: number[] = [];
  private pos = 0;
  private current?: Phaser.Sound.BaseSound;
  private active = false;
  private loading = false;
  /** Una pista quedó pendiente porque la música estaba desactivada. */
  private waiting = false;

  constructor(private scene: Phaser.Scene) {}

  start() {
    if (this.active || TRACKS.length === 0) return;
    this.active = true;
    this.order = TRACKS.map((_, i) => i).sort(() => Math.random() - 0.5);
    this.pos = 0;
    this.playNext();
  }

  get enabled() { return settings.music; }

  /** Alterna la música y devuelve el nuevo estado (true = suena). */
  toggle(): boolean {
    saveSettings({ music: !settings.music });
    if (!settings.music) this.current?.pause();
    else if (this.current?.isPaused) this.current.resume();
    else if (this.active && !this.current && !this.loading) this.playNext();
    return settings.music;
  }

  stop(fadeMs = 600) {
    this.active = false;
    const s = this.current;
    this.current = undefined;
    if (!s) return;
    if (fadeMs <= 0) { s.stop(); s.destroy(); return; }
    this.scene.tweens.add({ targets: s, volume: 0, duration: fadeMs, onComplete: () => { s.stop(); s.destroy(); } });
  }

  private playNext() {
    if (!this.active || this.loading) return;
    this.waiting = false;
    const t = TRACKS[this.order[this.pos % this.order.length]];
    this.pos++;
    const play = () => {
      if (!this.active) return;
      if (!settings.music) { this.waiting = true; return; }
      const s = this.scene.sound.add(t.key, { volume: VOLUME });
      s.once('complete', () => { s.destroy(); this.playNext(); });
      s.play();
      this.current = s;
    };
    if (this.scene.cache.audio.exists(t.key)) return play();
    this.loading = true;
    this.scene.load.audio(t.key, t.url);
    this.scene.load.once(`filecomplete-audio-${t.key}`, () => { this.loading = false; play(); });
    this.scene.load.once('loaderror', () => { this.loading = false; });
    this.scene.load.start();
  }
}
