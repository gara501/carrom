import type Phaser from 'phaser';

/** Cambia de escena con un fundido corto (color papel). */
export function fadeTo(scene: Phaser.Scene, key: string, data?: object) {
  const cam = scene.cameras.main;
  if (cam.fadeEffect.isRunning) return;
  cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
  cam.fadeOut(220, 242, 238, 230);
}

/** Fundido de entrada al crear la escena. */
export function fadeIn(scene: Phaser.Scene) {
  scene.cameras.main.fadeIn(260, 242, 238, 230);
}
