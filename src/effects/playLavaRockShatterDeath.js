// src/effects/lavaRockShatterDeath.js
import Phaser from "phaser";

/**
 * Muerte por impacto con "piedra de lava":
 *  choque -> aturdimiento -> petrificación -> grietas -> desmorone en astillas incandescentes.
 * Robusta a scroll/zoom; toda la geometría en coordenadas de MUNDO.
 *
 * Uso:
 *   await playLavaRockShatterDeath(this, player, rock, { ...opciones });
 *   // Emite: "rock-death-finished"
 */
export function playLavaRockShatterDeath(scene, player, rock, opts = {}) {
  const s = scene;
  const o = {
    // tiempos (ms)
    stunMs: 220,
    petrifyMs: 260,
    crackPulseMs: 360,
    crumbleMs: 900,

    // cámara
    camShake: { duration: 120, intensity: 0.008 },

    // partículas
    embers: { count: 26, speed: { min: 90, max: 220 }, life: { min: 600, max: 1200 } },
    shards: { count: 14, spin: { min: 220, max: 520 }, gravityY: 500, bounce: 0.35, fadeOutMs: 480 },

    // tintes
    hitTint: 0xff6a3a,
    petrifyTint: 0x4a4a4a, // “piedra”
    crackAlpha: 0.85,

    // hooks opcionales
    sfx: {
      impact: null,   // () => void
      crack: null,    // () => void
      shatter: null,  // () => void
    },

    // …override desde opts
    ...opts,
  };

  if (!s || !player || !s.tweens) return Promise.resolve();
  if (player._rockDeathPlaying) return Promise.resolve();
  player._rockDeathPlaying = true;

  // ──────────────────────────────────────────────
  // Helpers de texturas autogeneradas (pixel/shard/cracks)
  // ──────────────────────────────────────────────
  const ensurePx = (key = "px", color = 0xffffff) => {
    if (s.textures.exists(key)) return key;
    const g = s.make.graphics({ add: false });
    g.fillStyle(color, 1).fillRect(0, 0, 1, 1);
    g.generateTexture(key, 1, 1);
    g.destroy();
    try { s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return key;
  };

  const ensureShardTexture = () => {
    const key = "lava_shard";
    if (s.textures.exists(key)) return key;
    const sz = 16;
    const g = s.make.graphics({ add: false });
    // triángulo irregular tipo “astilla”
    g.fillStyle(0xffc68a, 1);
    g.beginPath();
    g.moveTo(2, sz - 2);
    g.lineTo(sz - 6, 2);
    g.lineTo(sz - 2, sz - 6);
    g.closePath();
    g.fillPath();
    // borde caliente
    g.lineStyle(2, 0xff7a42, 1);
    g.strokePath();
    g.generateTexture(key, sz, sz);
    g.destroy();
    try { s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return key;
  };

  const ensureCrackTexture = (w = 64, h = 64) => {
    const key = `rock_cracks_${w}x${h}`;
    if (s.textures.exists(key)) return key;
    const g = s.make.graphics({ add: false });
    g.clear();
    g.lineStyle(2, 0xffffff, 1);
    // grietas radiales simples
    const cx = w / 2, cy = h / 2;
    const rays = 7;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
      const len = Phaser.Math.Between(h * 0.28, h * 0.48);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.strokePath();
    }
    // ramificaciones pequeñas
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
      const base = Phaser.Math.Between(h * 0.15, h * 0.3);
      const a2 = a + Phaser.Math.FloatBetween(-0.6, 0.6);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * base, cy + Math.sin(a) * base);
      g.lineTo(cx + Math.cos(a2) * (base + Phaser.Math.Between(8, 20)),
               cy + Math.sin(a2) * (base + Phaser.Math.Between(8, 20)));
      g.strokePath();
    }
    g.generateTexture(key, w, h);
    g.destroy();
    try { s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return key;
  };

  // ──────────────────────────────────────────────
  // Estado previo y “congelar” actor
  // ──────────────────────────────────────────────
  const prev = {
    input: s.input?.enabled,
    depth: player.depth,
    angle: player.angle,
    tint: player.tintTopLeft ?? null,
  };

  try {
    const b = player.body;
    if (b) { b.setAllowGravity?.(false); b.setVelocity?.(0, 0); b.moves = false; b.enable = false; }
    s.input && (s.input.enabled = false);
  } catch {}

  // Orientación del golpe para un “knockback” mínimo
  const dir = rock && rock.x != null ? Math.sign(player.x - rock.x) || 1 : (Math.random() < 0.5 ? -1 : 1);

  // Shake de cámara corto (impacto)
  try {
    const cam = s.cameras?.main;
    cam?.shake(o.camShake.duration, o.camShake.intensity);
  } catch {}

  // SFX impacto
  try { o.sfx?.impact?.(); } catch {}

  // ──────────────────────────────────────────────
  // Etapa 1: flash + micro-knockback (stun)
  // ──────────────────────────────────────────────
  const impactTween = new Promise((resolve) => {
    s.tweens.add({
      targets: player,
      angle: Phaser.Math.Clamp(prev.angle + dir * -10, -25, 25),
      x: player.x + dir * 8,
      tint: o.hitTint,
      duration: o.stunMs,
      ease: "Sine.out",
      yoyo: true,
      onComplete: resolve,
    });
  });

  // ──────────────────────────────────────────────
  // Partículas de ascuas (embers)
  // ──────────────────────────────────────────────
  const pxKey = ensurePx("px", 0xffffff);
  let emberEmitter = null;
  try {
    const part = s.add.particles(0, 0, pxKey, {
      x: player.x,
      y: player.y,
      quantity: o.embers.count,
      lifespan: o.embers.life,
      speed: o.embers.speed,
      angle: { min: -130, max: -50 }, // abanico superior
      gravityY: 220,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffdd99, 0xffb566, 0xff8642, 0xffe1bb],
      blendMode: Phaser.BlendModes.ADD,
    });
    emberEmitter = part;
    part.explode?.(o.embers.count, player.x, player.y);
    // autodestruir unos ms después
    s.time.delayedCall(1300, () => { try { part.destroy(); } catch {} });
  } catch {}

  // ──────────────────────────────────────────────
  // Etapa 2: Petrificación (desaturar ➜ gris piedra)
  // ──────────────────────────────────────────────
  const petrifyTween = () => new Promise((resolve) => {
    s.tweens.add({
      targets: player,
      tint: o.petrifyTint,
      duration: o.petrifyMs,
      ease: "Sine.inOut",
      onComplete: resolve,
    });
  });

  // Overlay de grietas alineado al sprite
  let cracks = null;
  const spawnCracks = () => {
    try {
      const w = Math.ceil(player.displayWidth || player.width || 48);
      const h = Math.ceil(player.displayHeight || player.height || 48);
      const crackKey = ensureCrackTexture(w, h);
      cracks = s.add.image(player.x, player.y, crackKey)
        .setDepth((prev.depth ?? player.depth) + 5)
        .setOrigin(player.originX ?? 0.5, player.originY ?? 0.5)
        .setAlpha(0);
      s.tweens.add({
        targets: cracks,
        alpha: o.crackAlpha,
        duration: o.crackPulseMs * 0.5,
        yoyo: true,
        repeat: 1,
        ease: "Sine.inOut",
        onStart: () => { try { o.sfx?.crack?.(); } catch {} },
      });
    } catch {}
  };

  // ──────────────────────────────────────────────
  // Etapa 3: Desmoronamiento (shatter + astillas)
  // ──────────────────────────────────────────────
  const shardKey = ensureShardTexture();
  const shatter = () => new Promise((resolve) => {
    try { o.sfx?.shatter?.(); } catch {}

    // esconder sprite base y soltar astillas
    try { player.setVisible(false); } catch {}

    const group = s.add.group();
    for (let i = 0; i < o.shards.count; i++) {
      const sh = s.physics ? s.physics.add.image(player.x, player.y, shardKey) : s.add.image(player.x, player.y, shardKey);
      sh.setDepth((prev.depth ?? 0) + 6);
      // dispersión
      const ang = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const spd = Phaser.Math.Between(60, 220);
      const vx = Math.cos(ang) * spd;
      const vy = Math.sin(ang) * spd - 40;

      if (sh.body) {
        sh.body.setVelocity(vx, vy);
        sh.body.setAllowGravity?.(true);
        sh.body.setBounce?.(o.shards.bounce);
        sh.body.setGravityY?.(o.shards.gravityY);
      } else {
        // fallback sin physics
        s.tweens.add({
          targets: sh,
          x: sh.x + vx * 0.8,
          y: sh.y + vy * 0.8,
          duration: o.crumbleMs,
          ease: "Quad.in",
        });
      }

      s.tweens.add({
        targets: sh,
        angle: Phaser.Math.Between(o.shards.spin.min, o.shards.spin.max) * (Math.random() < 0.5 ? -1 : 1),
        duration: o.crumbleMs,
        ease: "Linear",
      });

      s.tweens.add({
        targets: sh,
        alpha: 0,
        duration: o.shards.fadeOutMs,
        delay: Phaser.Math.Between(280, 680),
        onComplete: () => { try { sh.destroy(); } catch {} },
      });

      group.add(sh);
    }

    s.time.delayedCall(Math.max(o.crumbleMs, o.shards.fadeOutMs) + 50, resolve);
  });

  // ──────────────────────────────────────────────
  // Cadena
  // ──────────────────────────────────────────────
  return impactTween
    .then(() => { spawnCracks(); return petrifyTween(); })
    .then(() => shatter())
    .then(() => {
      // Limpieza
      try { cracks?.destroy(); } catch {}
      try { emberEmitter?.destroy?.(); } catch {}
      // restaurar flags mínimas (no reactivar visibilidad ni physics aquí)
      try { s.input && (s.input.enabled = prev.input); } catch {}
      try { s.events.emit("rock-death-finished"); } catch {}
      player._rockDeathPlaying = false;
    })
    .catch(() => { player._rockDeathPlaying = false; });
}
