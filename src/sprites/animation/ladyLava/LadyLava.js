// src/sprites/animation/LadyLava/LadyLava.js

export function preloadLadyLava(scene) {
  const url = (rel) => new URL(rel, import.meta.url).href; // resuelve relativo al archivo

  scene.load.image('ladyLava_1', url('../../Boss/LadyLava/1.png'));
  scene.load.image('ladyLava_2', url('../../Boss/LadyLava/2.png'));
  scene.load.image('ladyLava_3', url('../../Boss/LadyLava/3.png'));
  scene.load.image('ladyLava_4', url('../../Boss/LadyLava/4.png'));
  scene.load.image('ladyLava_5', url('../../Boss/LadyLava/5.png'));
  scene.load.image('ladyLava_6', url('../../Boss/LadyLava/6.png'));
}

export function createLadyLavaAnimation(scene, { key = 'ladyLava_walk', frameRate = 3 } = {}) {
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
