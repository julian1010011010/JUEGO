// src/effects/lavaSoulDeath.js
import Phaser from "phaser";

/**
 * Animación de muerte en lava con “alma -> estrella que hace twinkle”.
 * Robusta a cámaras con scroll/zoom y mundos altos: TODA la geometría se calcula en coordenadas de MUNDO.
 *
 * Uso:
 *   await playLavaDeathSoulStar(this, player, lava, { ...opciones });
 */
export function playLavaDeathSoulStar(scene, player, lava, opts = {}) {
  const s = scene;
  const o = {
    hopDuration: 280,
    sinkDuration: 1200,
    useMask: true,
    bubbleFX: true,
    // alma sube en ligera curva
    soulRise: { dy: 120, duration: 1200, arc: 40 },
    // estrella grande que “late” (sin explosión)
    twinkle: { repeats: 5, pulseMs: 220, bigScale: 1.6, rotateDeg: 25, fadeOutMs: 420 },
    // actualizar la máscara cuando la cámara se mueve/zoomea
    autoUpdateMask: true,
    ...opts,
  };

  // Guardas y precondiciones
  if (!s || !player || !s.tweens) return Promise.resolve();
  if (player._lavaDeathPlaying) return Promise.resolve();
  player._lavaDeathPlaying = true;

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  // Línea Y de la lava en MUNDO. Si no hay lava, usa el bottom visible del viewport de MUNDO - 60.
  const getLavaLineY = () => {
    if (lava && Number.isFinite(lava.y)) return lava.y; // y de mundo (tileSprite/sprite/graphics)
    const cam = s.cameras?.main;
    if (!cam) return s.scale.height - 60; // fallback extremo
    const worldBottom = cam.worldView.y + cam.worldView.height;
    return worldBottom - 60;
  };

  // Asegura una textura 1x1 para partículas estilo “pixel”
  const ensurePx = (key = "px", color = 0xffffff) => {
    if (s.textures.exists(key)) return key;
    const g = s.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1).fillRect(0, 0, 1, 1);
    g.generateTexture(key, 1, 1);
    g.destroy();
    try { s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return key;
  };

  // Orbe (alma) como un halo de anillos blancos (compatible con cualquier filtro)
  const ensureSoulTexture = () => {
    const key = "soul_orb";
    if (s.textures.exists(key)) return key;
    const size = 32, cx = size/2, cy = size/2;
    const rings = [
      { r: 12, a: 0.10 }, { r: 10, a: 0.16 }, { r: 8, a: 0.22 },
      { r: 6, a: 0.32 },  { r: 4, a: 0.45 },  { r: 3, a: 0.70 },
    ];
    const g = s.make.graphics({ x: 0, y: 0, add: false });
    for (const { r, a } of rings) { g.fillStyle(0xffffff, a); g.fillCircle(cx, cy, r); }
    g.generateTexture(key, size, size);
    g.destroy();
    try { s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return key;
  };

  // Estrella (5 puntas)
  const ensureStarTexture = () => {
    const key = "soul_star";
    if (s.textures.exists(key)) return key;
    const sz = 20;
    const cx = sz / 2;
    const cy = sz / 2;
    const outerR = sz * 0.45; // radio exterior
    const innerR = outerR * 0.45; // radio interior (ajustable para "puntiagudo")
    const points = [];
    const startAng = -Math.PI / 2; // punta hacia arriba
    for (let i = 0; i < 5; i++) {
      const angOuter = startAng + i * (2 * Math.PI / 5);
      const angInner = angOuter + (Math.PI / 5);
      points.push({ x: cx + Math.cos(angOuter) * outerR, y: cy + Math.sin(angOuter) * outerR });
      points.push({ x: cx + Math.cos(angInner) * innerR, y: cy + Math.sin(angInner) * innerR });
    }

    const g = s.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.closePath();
    g.fillPath();
    // añadir un pequeño brillo/centro (opcional, similar al diseño anterior)
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, sz * 0.06);

    g.generateTexture(key, sz, sz);
    g.destroy();
    try { s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return key;
  };

  // Cadena secuencial de tweens para entornos sin timeline
  const runChain = (steps) => new Promise((done) => {
    const next = (i) => {
      if (i >= steps.length) return done();
      const cfg = steps[i], os = cfg.onStart, oc = cfg.onComplete;
      s.tweens.add({
        ...cfg,
        onStart: () => { try { os?.(); } catch {} },
        onComplete: () => { try { oc?.(); } catch {}; next(i+1); }
      });
    };
    next(0);
  });

  // Clamp a márgenes del viewport de MUNDO (evita “saltos” a fuera de vista cuando estás altísimo)
  const cam = s.cameras?.main;
  const clampYToView = (yy) => {
    if (!cam) return yy;
    // 200px de margen extra para no ver cortes bruscos
    return Phaser.Math.Clamp(yy, cam.worldView.y - 200, cam.worldView.y + cam.worldView.height + 200);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Setup inicial y estados previos
  // ────────────────────────────────────────────────────────────────────────────
  const prev = {
    input: s.input?.enabled,
    depth: player.depth,
    lavaDepth: lava?.depth,
    lavaY: lava?.y,
    angle: player.angle,
  };

  const lineY = getLavaLineY();
  const ph = player.displayHeight || player.height || 28;
  const oy = (player.originY ?? 0.5);
  const yAtSurface = lineY - ph * (1 - oy);

  try {
    player.setTint?.(0xff4444);
    player.setAngle?.(-15);
    const b = player.body;
    if (b) { b.setAllowGravity?.(false); b.setVelocity?.(0,0); b.moves = false; b.enable = false; }
    if (s.input) s.input.enabled = false;
    if (lava?.setDepth && player.setDepth) {
      const high = Math.max(prev.lavaDepth ?? 0, (prev.depth ?? 0) + 10);
      lava.setDepth(high); player.setDepth(high - 1);
    }
  } catch {}

  // ────────────────────────────────────────────────────────────────────────────
  // Burbujas (opcional)
  // ────────────────────────────────────────────────────────────────────────────
  let puffMgr = null;
  if (o.bubbleFX) {
    try {
      ensurePx("px", 0xffffff);
      puffMgr = s.add.particles(0, 0, "px", {
        x: player.x,
        y: lineY,
        frequency: 80,
        quantity: 2,
        lifespan: { min: 600, max: 1200 },
        speedY: { min: -60, max: -120 },
        speedX: { min: -30, max: 30 },
        scale: { start: 1.2, end: 0.2 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x9ad5ff, 0xc7eeff],
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth((lava?.depth ?? (player.depth + 2)) + 1);
    } catch {}
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Máscara en coordenadas de MUNDO, alineada al viewport
  // ────────────────────────────────────────────────────────────────────────────
  let maskG = null, mask = null, offCamUpdate = null;
  if (o.useMask && cam) {
    const drawMask = () => {
      const lv = getLavaLineY();
      const wv = cam.worldView;
      maskG.clear();
      maskG.fillStyle(0x000000, 1);
      maskG.fillRect(wv.x, wv.y, wv.width, Math.max(0, lv - wv.y));
    };

    maskG = s.add.graphics();
    drawMask(); // primer dibujo

    mask = new Phaser.Display.Masks.GeometryMask(s, maskG);
    player.setMask(mask);

    // Actualizar máscara cuando la cámara cambie (si quieres que siga el paneo/zoom)
    if (o.autoUpdateMask) {
      // Phaser no emite "cameraupdate" por defecto; si paneas/zoomeas, llama tú a s.events.emit('cameraupdate')
      const onUpdate = () => { try { drawMask(); } catch {} };
      s.events.on('cameraupdate', onUpdate);
      // para poder quitar el listener al final:
      offCamUpdate = () => { try { s.events.off('cameraupdate', onUpdate); } catch {} };
      // y al menos una actualización en el siguiente tick por seguridad
      s.events.once('preupdate', onUpdate);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Secuencia: hop -> contacto -> hundimiento
  // ────────────────────────────────────────────────────────────────────────────
  const hopUpY = clampYToView(yAtSurface - Math.max(8, Math.min(24, ph * 0.25)));
  const chain = [
    { targets: player, y: hopUpY,                duration: o.hopDuration,                         ease: "Sine.out" },
    { targets: player, y: clampYToView(yAtSurface), duration: Math.max(120, (o.hopDuration*0.6)|0), ease: "Sine.in"  },
    { targets: player, y: clampYToView(yAtSurface + ph), duration: o.sinkDuration,                 ease: "Sine.in"  },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  // Alma -> Estrella twinkle (sin explosión)
  // ────────────────────────────────────────────────────────────────────────────
  const spawnStarTwinkle = () => new Promise((resolve) => {
    const soulKey = ensureSoulTexture();
    const starKey = ensureStarTexture();

    const dynLineY = getLavaLineY(); // recalcula por si la cámara se movió
    const soul = s.add.sprite(player.x, dynLineY - 6, soulKey)
      .setOrigin(0.5).setDepth((lava?.depth ?? (player.depth + 5)) + 2)
      .setAlpha(0).setScale(0.6);

    const { dy, duration, arc } = o.soulRise;
    const topY = soul.y - dy;
    const midX = soul.x + Phaser.Math.Between(-arc, arc);

    s.tweens.add({ targets: soul, alpha: 1, duration: 220, ease: "Sine.out" });

    // tramo 1: subida con pequeña curva
    s.tweens.add({
      targets: soul,
      x: midX,
      y: soul.y - dy * 0.55,
      scale: 0.75,
      duration: duration * 0.6,
      ease: "Sine.inOut",
      onComplete: () => {
        // tramo 2: a top y desvanecer
        s.tweens.add({
          targets: soul,
          x: soul.x + (soul.x - player.x) * 0.2,
          y: topY,
          alpha: 0,
          duration: duration * 0.4,
          ease: "Sine.in",
          onComplete: () => {
            // Estrella grande que parpadea
            const star = s.add.sprite(soul.x, soul.y, starKey)
              .setOrigin(0.5)
              .setDepth(soul.depth + 1)
              .setScale(0.9)
              .setAlpha(0);

            try { soul.destroy(); } catch {}

            // Entrada rápida
            s.tweens.add({
              targets: star,
              alpha: 1,
              scale: o.twinkle.bigScale,
              angle: o.twinkle.rotateDeg,
              duration: 100,
              ease: "Sine.out",
              onComplete: () => {
                // Twinkle (yoyo)
                s.tweens.add({
                  targets: star,
                  alpha: { from: 1, to: 0.6 },
                  scale: { from: o.twinkle.bigScale, to: o.twinkle.bigScale * 0.86 },
                  angle: `+=${o.twinkle.rotateDeg}`,
                  duration: o.twinkle.pulseMs,
                  yoyo: true,
                  repeat: Math.max(0, (o.twinkle.repeats | 0) - 1),
                  ease: "Sine.inOut",
                  onComplete: () => {
                    // Salida
                    s.tweens.add({
                      targets: star,
                      alpha: 0,
                      scale: o.twinkle.bigScale * 0.7,
                      duration: o.twinkle.fadeOutMs,
                      ease: "Sine.in",
                      onComplete: () => { try { star.destroy(); } catch {}; resolve(); }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Ejecutar y limpiar
  // ────────────────────────────────────────────────────────────────────────────
  return runChain(chain)
    .then(() => { try { player.setVisible(false); } catch {}; return spawnStarTwinkle(); })
    .then(() => {
      try { puffMgr?.destroy(); } catch {}
      try { player.clearMask?.(true); } catch {}
      try { mask?.destroy(); } catch {}
      try { maskG?.destroy(); } catch {}
      try { offCamUpdate?.(); } catch {}                 // quitar listener de cámara si se registró
      try { s.cameras?.main?.zoomTo?.(1, 300); } catch {}
      try { if (lava && Number.isFinite(prev.lavaY)) lava.y = prev.lavaY; } catch {}
      try { player.clearTint?.(); } catch {}
      try { player.setAngle?.(prev.angle || 0); } catch {}
      try { s.input && (s.input.enabled = prev.input); } catch {}
      try { s.events.emit("lava-death-finished"); } catch {}
      player._lavaDeathPlaying = false;
    })
    .catch(() => {
      // En caso de excepción, liberar el flag para no “bloquear” futuras muertes
      player._lavaDeathPlaying = false;
    });
}
