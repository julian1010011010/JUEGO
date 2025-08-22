// src/sprites/animation/Player/PlayerCat.js

/**
 * Preload de los frames del gato (idle).
 * Los PNG deben estar en public/assets/sprites/player/cat/idle/1.png ... 15.png
 * @param {Phaser.Scene} scene
 */
export function preloadPlayerCat(scene) {
  // Cargar el frame de la animación idle
  scene.load.image('cat_idle_1', 'assets/sprites/player/cat.png');
}

/**
 * Crea la animación idle del gato.
 * @param {Phaser.Scene} scene
 * @param {{ key?: string, frameRate?: number, repeat?: number }} [opts]
 */
export function createPlayerCatIdle(scene, { key = 'player_cat_idle', frameRate = 1, repeat = -1 } = {}) {
  if (scene.anims.exists(key)) return key;

  scene.anims.create({
    key,
    frames: [{ key: 'cat_idle_1' }],
    frameRate,
    repeat,
  });

  return key;
}

/**
 * Spawnea al gato con su animación idle.
 * @param {Phaser.Scene} scene
 * @param {{ x?: number, y?: number, animKey?: string }} [opts]
 */
export function spawnPlayerCat(scene, { x = 200, y = 300, animKey = 'player_cat_idle' } = {}) {
  // Usar el primer frame para crear el sprite y añadir física
  const sprite = scene.physics.add.sprite(x, y, 'cat_idle_1');
  const key = createPlayerCatIdle(scene, { key: animKey });
  sprite.play(key);
  return sprite;
}
  
