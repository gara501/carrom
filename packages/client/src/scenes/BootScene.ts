import Phaser from 'phaser';
import { SFX_FILES } from '../audio/sfx';
import { UI_COLORS } from '../theme';
import { makeParticleTextures } from '../render/Particles';

// Vite resuelve las URLs (dev y build); no dependemos de la carpeta pública.
const FILES = import.meta.glob('../../static/assets/kenney/**/*.{png,ogg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const INTRO = import.meta.glob('../../public/assets/ui/intro.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const LOGO = import.meta.glob('../../public/assets/ui/logo.{png,webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (rel: string): string => {
  const u = FILES[`../../static/assets/kenney/${rel}`];
  if (!u) console.error('[carrom] asset no encontrado:', rel);
  return u;
};

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.error('[carrom] no se pudo cargar', f.url));
    for (const c of UI_COLORS) {
      for (const p of ['btn', 'sq', 'rd', 'gl', 'bd']) {
        this.load.image(`${p}_${c}`, url(`${p}_${c}.png`));
        this.load.image(`${p}_${c}_down`, url(`${p}_${c}_down.png`));
      }
      this.load.image(`card_${c}`, url(`card_${c}.png`));
      this.load.image(`star_${c}`, url(`star_${c}.png`));
    }
    for (const i of ['check', 'cross']) this.load.image(`icon_${i}`, url(`icon_${i}.png`));
    for (const n of ['repeat', 'play', 'arrow_up', 'arrow_down']) {
      this.load.image(`icon_${n}_light`, url(`icon_${n}_light.png`));
      this.load.image(`icon_${n}_dark`, url(`icon_${n}_dark.png`));
    }
    const logo = Object.values(LOGO)[0];
    if (logo) this.load.image('logo', logo);
    this.load.image('intro', Object.values(INTRO)[0]);
    this.load.image('divider', url(`divider.png`));
    this.load.image('panel_white', url(`panel_white.png`));
    for (const [key, file] of Object.entries(SFX_FILES)) this.load.audio(key, url(`sfx/${file}`));
  }

  create() { makeParticleTextures(this); this.scene.start('Menu'); }
}
