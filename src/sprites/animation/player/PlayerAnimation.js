// src/sprites/animation/Player/PlayerCat.js

/**
 * Carga un spritesheet en Phaser 3 a partir de un archivo de imagen.
 * 
 * @param {Phaser.Scene} scene - Escena actual de Phaser. 
 *   Debe llamarse dentro del método `preload()` para que los recursos estén listos antes de crear la escena.
 * 
 * @param {Object} [opts] - Objeto de configuración opcional para el spritesheet.
 * 
 * @param {string} [opts.path="assets/sprites/player/player.png"] 
 *   Ruta relativa al archivo de imagen que contiene el spritesheet.
 *   Ejemplo: `"assets/sprites/player/cat/idle.png"`.
 * 
 * @param {string} [opts.key="player_sheet"] 
 *   Clave única que identifica el recurso en la caché de Phaser.
 *   Esta clave es la que luego usarás para crear animaciones o añadir sprites (`this.add.sprite(x, y, key)`).
 * 
 * @param {number} [opts.frameWidth=50] 
 *   Ancho (en píxeles) de cada frame dentro del spritesheet. 
 *   Todos los frames deben tener el mismo ancho.
 * 
 * @param {number} [opts.frameHeight=50] 
 *   Alto (en píxeles) de cada frame dentro del spritesheet. 
 *   Todos los frames deben tener la misma altura.
 * 
 * @param {number} [opts.margin=0] 
 *   Espacio (en píxeles) desde el borde de la imagen hasta donde comienza el primer frame. 
 *   Útil si tu spritesheet tiene un borde transparente o márgenes de seguridad.
 * 
 * @param {number} [opts.spacing=60] 
 *   Espacio (en píxeles) entre cada frame dentro del spritesheet.
 *   Se usa cuando los frames no están pegados unos a otros y hay separación horizontal/vertical.
 *   Si los frames están consecutivos sin espacio, este valor debería ser `0`.
 * 
 * @throws {Error} Si la función no se llama dentro de `scene.preload()`, 
 *   porque el cargador de Phaser (`scene.load`) aún no está disponible.
 */
export function preloadPlayerSheet(
  scene,
  {
    path = "assets/sprites/player/player.png",
    key = "player_sheet",
    frameWidth = 240,      // <-- Ajusta al tamaño real de cada frame
    frameHeight = 240,     // <-- Ajusta al tamaño real de cada frame
    margin = 0,           // <-- Usualmente 0 si no hay borde
    spacing = 0,          // <-- Usualmente 0 si los frames están pegados
  } = {}
) {
  if (!scene?.load) {
    throw new Error(
      "[preloadPlayerSheet] Llama esta función dentro de scene.preload()."
    );
  }
  scene.load.spritesheet(key, path, {
    frameWidth,
    frameHeight,
    margin,
    spacing,
  });
} 
/**
 * Crea animaciones por fila de un spritesheet.
 * rows: [{ name, row, from, to, frameRate=12, repeat=-1 }]
 */
export function createRowAnimations(
  scene,
  { sheetKey = "player_sheet", rows = [], frameRate = 12, repeat = -1 } = {}
) {
  if (!scene.textures.exists(sheetKey)) {
    throw new Error(
      `[AnimRows] No existe textura "${sheetKey}". Llama preloadPlayerSheet() en preload().`
    );
  }

  const tex = scene.textures.get(sheetKey);
  const img = tex.getSourceImage();
  const base = tex.frames.__BASE;
  const fw = base?.width ?? 64;
  const cols = Math.max(1, Math.floor(img.width / fw));

  for (const r of rows) {
    if (!r?.name) continue;
    if (scene.anims.exists(r.name)) continue;

    const start = r.row * cols + r.from;
    const end = r.row * cols + r.to;

    const frames = scene.anims.generateFrameNumbers(sheetKey, { start, end });
    scene.anims.create({
      key: r.name,
      frames,
      frameRate: r.frameRate ?? frameRate,
      repeat: r.repeat ?? repeat,
    });
  }
}
/**
 * Crea el sprite desde el sheet y reproduce una anim de inicio.
 */
export function spawnPlayerFromSheet(
  scene,
  {
    x = 100,
    y = 300,
    sheetKey = "player_sheet",
    animKey = "idle",
    origin = { x: 0.5, y: 1 }, // <-- centrado horizontal, abajo vertical
    width,
    height,
    scale,
    bodyShrinkPx = 6,
  } = {}
) {
  if (!scene.textures.exists(sheetKey)) {
    throw new Error(`[spawnPlayerFromSheet] Falta textura "${sheetKey}".`);
  }
  const s = scene.physics.add
    .sprite(x, y, sheetKey, 0)
    .setOrigin(origin.x, origin.y);

  // Escalado visual
  const fw = s.frame.width;
  const fh = s.frame.height;
  if (Number.isFinite(width) && Number.isFinite(height)) {
    const ratio = Math.min(width / fw, height / fh);
    s.setScale(ratio);
    // s.setDisplaySize(fw * ratio, fh * ratio); // <-- Eliminar esta línea
  } else if (Number.isFinite(scale)) {
    s.setScale(scale);
  }

  // Hitbox compacto
  const bodyW = Math.max(2, s.displayWidth - bodyShrinkPx);
  const bodyH = Math.max(2, s.displayHeight - bodyShrinkPx);
  s.body.setSize(bodyW, bodyH, true);
  s.body.setOffset((s.displayWidth - bodyW) / 2, (s.displayHeight - bodyH) / 2);
  s.body.updateFromGameObject();

  if (scene.anims.exists(animKey)) {
    s.play({ key: animKey, ignoreIfPlaying: true });
  } else {
    console.warn(`[spawnPlayerFromSheet] Anim "${animKey}" no existe todavía.`);
  }
  return s;
}
/**
 * Crea la animación idle del gato.
 * @param {Phaser.Scene} scene
 * @param {{ sheetKey?: string, animKey?: string, frameRate?: number, repeat?: number }} [opts]
 * @returns {string} animKey
 */
export function createPlayerCatIdle(
  scene,
  {
    sheetKey = "player_cat_idle_sheet",
    animKey = "player_cat_idle",
    frameRate = 12,
    repeat = -1,
  } = {}
) {
  if (!scene.textures.exists(sheetKey)) {
  }
  if (scene.anims.exists(animKey)) return animKey;

  const total = scene.textures.get(sheetKey).frameTotal;
  const frames = scene.anims.generateFrameNumbers(sheetKey, {
    start: 0,
    end: total - 1,
  });

  scene.anims.create({ key: animKey, frames, frameRate, repeat });
  return animKey;
}

/**
 * Ajusta el tamaño visual y sincroniza el cuerpo físico.
 */
function applySizeAndBody(
  sprite,
  { width, height, scale, bodyShrinkPx = 6 } = {}
) {
  const fw = sprite.frame.width;
  const fh = sprite.frame.height;

  if (width && height) {
    const ratio = Math.min(width / fw, height / fh);
    sprite.setScale(ratio);
    // sprite.setDisplaySize(fw * ratio, fh * ratio); // <-- Eliminar esta línea
  } else if (scale) {
    sprite.setScale(scale);
  }

  const bodyW = Math.max(2, sprite.displayWidth - bodyShrinkPx);
  const bodyH = Math.max(2, sprite.displayHeight - bodyShrinkPx);
  sprite.body.setSize(bodyW, bodyH, true);
  sprite.body.setOffset(
    (sprite.displayWidth - bodyW) / 2,
    (sprite.displayHeight - bodyH) / 2
  );
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
export function spawnPlayerCat(
  scene,
  {
    x = 100,
    y = 300,
    sheetKey = "player_cat_idle_sheet",
    animKey = "player_cat_idle",
    frameRate = 12,
    repeat = -1,
    origin = { x: 0.5, y: 1 }, // <-- centrado horizontal, abajo vertical
    scale,
    width,
    height,
    gravityY,
    immovable = false,
    bodyShrinkPx = 6,
  } = {}
) {
  const key = createPlayerCatIdle(scene, {
    sheetKey,
    animKey,
    frameRate,
    repeat,
  });

  const sprite = scene.physics.add.sprite(x, y, sheetKey, 0);
  sprite.setOrigin(origin.x, origin.y);

  if (gravityY !== undefined) {
    sprite.body.setAllowGravity(true);
    sprite.body.gravity.y = gravityY;
  }
  if (immovable) sprite.body.immovable = true;
}
