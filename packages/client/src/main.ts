import './fonts.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { dpr } from './theme';

async function start() {
  // La fuente debe estar lista antes de crear textos en el canvas.
  try {
    await Promise.all([
      document.fonts.load('16px "Play"'),
      document.fonts.load('bold 16px "Play"'),
    ]);
  } catch { /* se usa la fuente de respaldo */ }

  // Canvas a resolución nativa: tamaño de ventana x devicePixelRatio, reducido con zoom.
  const d = dpr();
  const size = () => ({ w: Math.floor(window.innerWidth * d), h: Math.floor(window.innerHeight * d) });
  const { w, h } = size();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#f2eee6',
    antialias: true,
    scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / d },
    scene: [BootScene, MenuScene, GameScene],
  });

  // Útil para depurar desde la consola del navegador (p. ej. window.__carrom.scene.isActive('Game')).
  (window as unknown as { __carrom: Phaser.Game }).__carrom = game;

  window.addEventListener('resize', () => {
    const s = size();
    game.scale.resize(s.w, s.h);
  });
}
void start();
