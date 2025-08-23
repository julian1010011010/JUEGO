// src/sprites/animation/Player/PlayerCat.js

/**
 * Carga el spritesheet del gato en idle.
 * Archivo esperado: public/assets/sprites/player/cat/idle.png
 * con N frames del mismo tamaño en una fila.
 * @param {Phaser.Scene} scene
 * @param {{ path?: string, key?: string, frameWidth?: number, frameHeight?: number, endFrame?: number }} [opts]
 */
export function preloadPlayerCat(scene, {
  path = 'assets/sprites/player/cat.png',
  key = 'player_cat_idle_sheet',
  frameWidth = 64,
  frameHeight = 64,
  endFrame = 14 // 0..14 => 15 frames
} = {}) {
  scene.load.spritesheet(key, path, { frameWidth, frameHeight, endFrame });
}

/**
 * Crea la animación idle del gato.
 * @param {Phaser.Scene} scene
 * @param {{ sheetKey?: string, animKey?: string, frameRate?: number, repeat?: number }} [opts]
 * @returns {string} animKey
 */
export function createPlayerCatIdle(scene, {
  sheetKey = 'player_cat_idle_sheet',
  animKey = 'player_cat_idle',
  frameRate = 12,
  repeat = -1
} = {}) {
  if (!scene.textures.exists(sheetKey)) {
    throw new Error(`[PlayerCat] Falta textura ${sheetKey}. ¿Ejecutaste preloadPlayerCat()?`);
  }
  if (scene.anims.exists(animKey)) return animKey;

  const total = scene.textures.get(sheetKey).frameTotal; // total de frames del sheet
  const frames = scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: total - 1 });

  scene.anims.create({ key: animKey, frames, frameRate, repeat });
  return animKey;
}

/**
 * Ajusta el tamaño visual y sincroniza el cuerpo físico.
 * - Si {width,height}: mantiene proporción del frame base.
 * - Si {scale}: aplica escala directa.
 */
function applySizeAndBody(sprite, { width, height, scale, bodyShrinkPx = 6 } = {}) {
  const fw = sprite.frame.width;
  const fh = sprite.frame.height;

  if (width && height) {
    const ratio = Math.min(width / fw, height / fh);
    sprite.setScale(ratio);
    // displaySize queda coherente con la escala aplicada
    sprite.setDisplaySize(fw * ratio, fh * ratio);
  } else if (scale) {
    sprite.setScale(scale);
  }

  // Actualizar hitbox (ligeramente más pequeño para evitar colisiones por “pelaje”)
  const bodyW = Math.max(2, sprite.displayWidth - bodyShrinkPx);
  const bodyH = Math.max(2, sprite.displayHeight - bodyShrinkPx);
  sprite.body.setSize(bodyW, bodyH, true);
  sprite.body.setOffset((sprite.displayWidth - bodyW) / 2, (sprite.displayHeight - bodyH) / 2);
  sprite.body.updateFromGameObject();
}

/**
 * Spawnea al gato con su animación idle.
 * @param {Phaser.Scene} scene
 * @param {{
 *  x?:number, y?:number,
 *  sheetKey?:string, animKey?:string,
 *  frameRate?:number, repeat?:number,
 *  origin?:{x:number,y:number},
 *  scale?:number, width?:number, height?:number,
 *  gravityY?:number, immovable?:boolean,
 *  bodyShrinkPx?:number
 * }} [opts]
 */
export function spawnPlayerCat(scene, {
  x = 100, y = 300,
  sheetKey = 'player_cat_idle_sheet',
  animKey = 'player_cat_idle',
  frameRate = 12, repeat = -1,
  origin = { x: 0.5, y: 1 },  // ancla en “pies”
  scale,
  width, height,
  gravityY,
  immovable = false,
  bodyShrinkPx = 6
} = {}) {
  const key = createPlayerCatIdle(scene, { sheetKey, animKey, frameRate, repeat });

  const sprite = scene.physics.add.sprite(x, y, sheetKey, 0);
  sprite.setOrigin(origin.x, origin.y);

  if (gravityY !== undefined) {
    sprite.body.setAllowGravity(true);
    sprite.body.gravity.y = gravityY;
  }
  if (immovable) sprite.body.immovable = true;

  applySizeAndBody(sprite, { width, height, scale, bodyShrinkPx });
  sprite.play(key);
  return sprite;
}
