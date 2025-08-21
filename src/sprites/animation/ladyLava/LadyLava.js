// src/sprites/animation/LadyLava/LadyLava.js

export function preloadLadyLava(scene) {
  // Usa rutas relativas estáticas compatibles con Phaser
  scene.load.image('ladyLava_1', 'assets/sprites/Boss/LadyLava/1.png');
  scene.load.image('ladyLava_2', 'assets/sprites/Boss/LadyLava/2.png');
  scene.load.image('ladyLava_3', 'assets/sprites/Boss/LadyLava/3.png');
  scene.load.image('ladyLava_4', 'assets/sprites/Boss/LadyLava/4.png');
  scene.load.image('ladyLava_5', 'assets/sprites/Boss/LadyLava/5.png');
  scene.load.image('ladyLava_6', 'assets/sprites/Boss/LadyLava/6.png');
}

export function createLadyLavaAnimation(scene, { key = 'ladyLava_walk', frameRate = 4 } = {}) {
  if (scene.anims.exists(key)) return key;
  scene.anims.create({
    key,
    frames: [
      { key: 'ladyLava_1' },
      { key: 'ladyLava_2' },
      { key: 'ladyLava_3' },
      { key: 'ladyLava_4' },
      { key: 'ladyLava_5' },
      { key: 'ladyLava_6' },
    ],
    frameRate,
    repeat: -1,
  });
  return key;
}
