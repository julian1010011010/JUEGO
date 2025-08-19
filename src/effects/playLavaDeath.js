import Phaser from 'phaser'

/**
 * Secuencia de “muerte por lava” tipo Terminator.
 * Reutilizable y robusta a diferencias de versión (usa timeline si existe, o una cadena manual de tweens).
 *
 * @param {Phaser.Scene} scene        Escena actual
 * @param {Phaser.GameObjects.Sprite} player       Sprite del jugador (Arcade Physics)
 * @param {Phaser.GameObjects.GameObject} lava     Objeto que representa la lava (tileSprite/graphics). Su y es la superficie.
 * @param {Object} opts                Opciones (todas opcionales)
 *  - jumpVelocity:   impulso vertical inicial (default -380)
 *  - hopDuration:    duración del mini-hop si se usa tween (default 300)
 *  - sinkDuration:   duración del hundimiento (default 1200)
 *  - thumbShowDelay: delay entre hundirse y mostrar brazo (default 250)
 *  - thumbRise:      píxeles que asoma el brazo (default 24)
 *  - thumbDuration:  tiempo visible del pulgar (default 900)
 *  - cameraZoom:     zoom de cámara durante el pulgar (default 1.1)
 *  - useMask:        usar máscara para “consumo” en vez de mover la lava (default true)
 *  - bubbleFX:       activar partículas de burbuja (default true)
 * @returns {Promise<void>}           Resuelve al terminar toda la cinemática
 */
export function playLavaDeath(scene, player, lava, opts = {}) {
  const s = scene
  const o = {
    jumpVelocity: -380,
    hopDuration: 300,
    sinkDuration: 1200,
    thumbShowDelay: 250,
    thumbRise: 24,
    thumbDuration: 900,
    cameraZoom: 1.1,
    useMask: true,
    bubbleFX: true,
    ...opts
  }

  // Protección básica de entradas
  if (!s || !player || !s.tweens) return Promise.resolve()
  if (player._lavaDeathPlaying) return Promise.resolve()
  player._lavaDeathPlaying = true

  // Helper: obtener línea de superficie de la lava (y superior)
  const getLavaLineY = () => {
    if (!lava) return s.cameras?.main?.scrollY + s.scale.height - 60
    // Si lava es un tileSprite o graphics, su y suele ser el top
    return Number(lava.y) || 0
  }

  // Helper: ejecutar cadena secuencial si no hay timeline
  const runChain = (steps) => new Promise((done) => {
    const next = (i) => {
      if (i >= steps.length) return done()
      const cfg = steps[i]
      const userOnStart = cfg.onStart
      const userOnComplete = cfg.onComplete
      s.tweens.add({
        ...cfg,
        onStart: () => { try { userOnStart?.() } catch {} },
        onComplete: () => { try { userOnComplete?.() } catch {}; next(i + 1) }
      })
    }
    next(0)
  })

  // Helper: crear timeline si existe, si no, adapter a runChain
  const makeTimeline = () => {
    if (typeof s.tweens.createTimeline === 'function') return s.tweens.createTimeline()
    if (typeof s.tweens.timeline === 'function') return s.tweens.timeline()
    return null
  }

  // Asegurar algunos assets de apoyo
  const ensurePx = () => {
    if (!s.textures.exists('px')) {
      const g = s.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 1, 1)
      g.generateTexture('px', 1, 1)
      g.destroy()
    }
  }
  const ensureBubble = () => {
    if (!s.textures.exists('bubble')) {
      const g = s.make.graphics({ x: 0, y: 0, add: false })
      // sencilla burbuja circular con borde
      g.fillStyle(0xffffff, 0)
      g.fillCircle(8, 8, 7)
      g.lineStyle(2, 0x9ad5ff, 0.95)
      g.strokeCircle(8, 8, 7)
      g.fillStyle(0x9ad5ff, 0.35)
      g.fillCircle(11, 6, 2)
      g.generateTexture('bubble', 16, 16)
      g.destroy()
    }
  }
  const ensureThumbArm = () => {
    if (!s.textures.exists('thumb_up_arm')) {
      const g = s.make.graphics({ x: 0, y: 0, add: false })
      // Antebrazo
      g.fillStyle(0xffe0b2, 1)
      g.fillRoundedRect(6, 10, 12, 22, 6)
      // Mano + pulgar
      g.save()
      g.translateCanvas(12, 10)
      g.rotateCanvas(-0.55)
      g.fillRoundedRect(0, -10, 10, 12, 5)
      g.restore()
      // Delineado ligero
      g.lineStyle(2, 0x8c6239, 0.4)
      g.strokeRoundedRect(6, 10, 12, 22, 6)
      g.generateTexture('thumb_up_arm', 32, 36)
      g.destroy()
    }
  }

  ensurePx()
  if (o.bubbleFX) ensureBubble()
  ensureThumbArm()

  // Deshabilitar input y físicas del player durante la secuencia
  const prevInput = s.input?.enabled
  if (s.input) s.input.enabled = false
  const body = player.body
  const prevEnable = body?.enable
  const prevGravityY = body?.gravity?.y
  const prevDepth = player.depth
  const prevLavaDepth = lava?.depth
  const prevLavaY = lava?.y

  try {
    if (body) {
      body.setAllowGravity?.(false)
      body.setVelocity?.(0, 0)
      body.setAcceleration?.(0)
      body.setDrag?.(0)
      body.moves = false
      body.enable = false
    }
  } catch {}

  // Asegurar que la lava tape al jugador visualmente
  try {
    if (lava?.setDepth && player.setDepth) {
      const high = Math.max(prevLavaDepth ?? 0, (prevDepth ?? 0) + 10)
      lava.setDepth(high)
      player.setDepth(high - 1)
    }
  } catch {}

  // Posición superficial objetivo del jugador (que su “base” toque la lava)
  const lineY = getLavaLineY()
  const ph = player.displayHeight || player.height || 28
  const oy = player.originY ?? 0.5
  const yAtSurface = lineY - ph * (1 - oy)

  // FX: Burbujas cerca de la superficie
  let bubbleManager = null
  let bubbles = null
  if (o.bubbleFX) {
    try {
      bubbleManager = s.add.particles('bubble')
      bubbles = bubbleManager.createEmitter({
        x: player.x,
        y: lineY,
        quantity: 2,
        frequency: 80,
        lifespan: { min: 600, max: 1200 },
        speedY: { min: -50, max: -120 },
        speedX: { min: -30, max: 30 },
        scale: { start: 0.65, end: 0.2 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x9ad5ff, 0xc7eeff],
        blendMode: Phaser.BlendModes.ADD
      })
    } catch {}
  }

  // Máscara para consumo por lava (opcional)
  let maskG = null
  let mask = null
  if (o.useMask) {
    maskG = s.add.graphics()
    const w = s.scale.width
    // Rect que cubre TODO lo por encima de la lava (visible). Lo de abajo queda oculto.
    maskG.fillStyle(0xffffff, 1)
    maskG.fillRect(0, 0, w, Math.max(0, lineY))
    mask = new Phaser.Display.Masks.GeometryMask(s, maskG)
    player.setMask(mask)
  }

  // Timeline si existe; si no, cadena manual
  const tl = makeTimeline()

  // 1) Mini-hop (o impulso) hasta volver a la superficie
  const hopUpY = yAtSurface - Math.max(8, Math.min(24, ph * 0.25))
  const hopCfg = {
    targets: player,
    y: hopUpY,
    duration: o.hopDuration,
    ease: 'Sine.out'
  }

  // 2) Caer hasta superficie exacta
  const contactCfg = {
    targets: player,
    y: yAtSurface,
    duration: Math.max(120, Math.floor(o.hopDuration * 0.6)),
    ease: 'Sine.in'
  }

  // 3) Hundimiento del jugador dentro de la lava
  const sinkCfg = {
    targets: player,
    y: yAtSurface + ph, // baja aprox. 1 altura de sprite
    duration: o.sinkDuration,
    ease: 'Sine.in'
  }

  // Alternativa: si no usamos máscara, mover un poco la lava hacia arriba para “tapar”
  const lavaCoverCfg = (!o.useMask && lava && typeof lava.y === 'number') ? {
    targets: lava,
    y: lineY - Math.min(10, ph * 0.3),
    duration: Math.max(300, Math.floor(o.sinkDuration * 0.4)),
    ease: 'Sine.inOut',
    yoyo: true
  } : null

  // 4) Espera breve y mostrar brazo con pulgar
  const spawnThumb = () => {
    // Crear el emisor de partículas de lava con MUCHAS más partículas y frecuencia
    const lavaParticles = s.add.particles(player.x, lineY, 'px', {
      quantity: 32, // MUCHAS más partículas
      frequency: 10, // más seguido
      lifespan: { min: 400, max: 900 },
      speedY: { min: -120, max: -220 },
      speedX: { min: -30, max: 30 },
      scale: { start: 3, end: 1, ease: 'Linear' },
      tint: [0xf59e0b, 0xfbbf24, 0xf97316, 0xef4444],
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      follow: null
    });
    lavaParticles.setDepth((lava?.depth ?? 10) - 2); // detrás de la lava
    // Piedritas oscuras como la lava principal, también muchas más
    const rockParticles = s.add.particles(player.x, lineY, 'px', {
      quantity: 16,
      frequency: 20,
      lifespan: { min: 700, max: 1400 },
      speedY: { min: -180, max: -260 },
      speedX: { min: -80, max: 80 },
      gravityY: 600,
      scale: { start: 2, end: 2 },
      tint: [0x1f2937, 0x4b5563, 0x111827],
      alpha: { start: 1, end: 0.9 },
      rotate: 0,
      emitting: true
    });
    rockParticles.setDepth((lava?.depth ?? 10) - 2);
    // Mostrar el sprite terminator.png como pulgar
    const thumb = scene.add.sprite(player.x, lineY, 'terminator').setOrigin(0.5, 1);
    // Escalar al ancho del jugador
  const pw = player.displayWidth || player.width || 28;
  const ratio = 2 * (pw / (thumb.width || pw)); // doble de grande
  thumb.setScale(ratio);
  thumb.setDepth((lava?.depth ?? 10) - 1); // por detrás de la lava

    // Centrar la cámara en la posición de muerte del personaje, sin mover fuera de los límites
    try {
      const cam = s.cameras.main;
      // Limita el paneo para que no se salga del mundo
      const worldW = cam?.scene?.scale?.width || cam.width;
      const worldH = cam?.scene?.scale?.height || cam.height;
      let targetX = Phaser.Math.Clamp(player.x, cam.width / 2, worldW - cam.width / 2);
      let targetY = Phaser.Math.Clamp(yAtSurface, cam.height / 2, worldH - cam.height / 2);
      cam.pan(targetX, targetY, 500, 'Sine.easeInOut', false);
    } catch {}

    // Animación: aparecer lentamente desde debajo de la lava
    thumb.y = lineY + 40; // inicia oculto bajo la lava
    const chain = [
  { targets: thumb, y: lineY + 18, duration: 1200, ease: 'Sine.out' }, // sube más despacio y queda parcialmente sumergido
  { targets: thumb, duration: 1000 }, // se mantiene visible 1 segundo
  { targets: thumb, alpha: 0, duration: 400, ease: 'Sine.in' } // se desvanece
    ];

    if (tl) {
      chain.forEach(c => tl.add(c))
      // Al terminar el brazo, limpiamos
      tl.add({ targets: arm, duration: 1, onComplete: () => arm.destroy() })
    } else {
      // cadena manual
      return runChain(chain).then(() => { try { arm.destroy() } catch {} })
    }
  }

  // Armar timeline/cadena
  if (tl) {
    tl.add(hopCfg)
    tl.add(contactCfg)
    if (lavaCoverCfg) tl.add(lavaCoverCfg)
    tl.add(sinkCfg)
    // Delay antes del brazo
    tl.add({ targets: player, duration: o.thumbShowDelay, onComplete: () => {} })
    spawnThumb()
  }

  const playAndWait = () => new Promise(resolve => {
    if (tl) {
      tl.setCallback?.('onComplete', () => resolve())
      tl.play()
    } else {
      const steps = [hopCfg, contactCfg]
      if (lavaCoverCfg) steps.push(lavaCoverCfg)
      steps.push(sinkCfg)
      steps.push({ targets: player, duration: o.thumbShowDelay })
      runChain(steps)
        .then(() => spawnThumb())
        .then(() => resolve())
    }
  })

  // Lanzar animación y limpiar al terminar
  return playAndWait().then(() => {
    // Limpiar partículas
    try { bubbles?.stop() } catch {}
    try { bubbleManager?.destroy() } catch {}
    // Limpiar máscara
    try { player.clearMask?.(true) } catch {}
    try { mask?.destroy() } catch {}
    try { maskG?.destroy() } catch {}
    // Restaurar cámara
    try { s.cameras.main.zoomTo?.(1, 300) } catch {}
    // Restaurar lava
    try { if (lava && typeof prevLavaY === 'number') lava.y = prevLavaY } catch {}
    // Ocultar / desactivar player
    try { player.setVisible?.(false) } catch {}
    try {
      const body = player.body
      if (body) {
        body.moves = false
        body.enable = false
        body.setAllowGravity?.(false)
      }
    } catch {}
    // Restaurar input
    if (s.input) s.input.enabled = !!prevInput
    // Evento para integrarse con UI/flow del juego
    try { s.events.emit('lava-death-finished') } catch {}
    player._lavaDeathPlaying = false
  })
}

// Ejemplo de uso:
// async function onHitLava() {
//   await playLavaDeath(this, this.player, this.lava, {
//     jumpVelocity: -380,
//     hopDuration: 300,
//     sinkDuration: 1200,
//     thumbShowDelay: 250,
//     thumbRise: 24,
//     thumbDuration: 900,
//     cameraZoom: 1.1,
//     useMask: true,
//     bubbleFX: true,
//   })
//   // this.scene.start('GameOverScene')
// }
