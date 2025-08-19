import Phaser from 'phaser'
import gameConfig from '../config/gameConfig'

/**
 * Fabrica de plataformas con rasgos especiales.
 * - Selección de tipo ponderada y centralizada.
 * - Meta y efectos por tipo encapsulados.
 * - Utilidades reutilizables (blink, ensurePxTexture, stayZone).
 * - JSDoc y limpieza de timers/eventos.
 */
export default class PlatformFactory {
  static PLATFORM_TYPES = {
  fragile: { name: 'Frágil', color: [255, 23, 68], typeChance: 0.10 },      // Rojo vivo (peligro/rompe)
  timed:   { name: 'Temporizada', color: [255, 196, 0], typeChance: 0.15 }, // Ámbar vivo (contador/tiempo)
  dodger:  { name: 'Escurridiza', color: [41, 121, 255], typeChance: 0.15 }, // Azul eléctrico (escapa)
  ice:     { name: 'Hielo', color: [0, 229, 255], typeChance: 0.15 },        // Cian brillante (hielo)
  bouncy:  { name: 'Elástica', color: [0, 230, 118], typeChance: 0.12 },     // Verde vivo (resorte)
  invertX: { name: 'Inversa X', color: [255, 64, 129], typeChance: 0.10 },   // Rosa fuerte vivo (controles invertidos)
  normal:  { name: 'Normal', color: [29, 233, 182], typeChance: 0.45 },      // Turquesa vivo (neutro)
  inversa: { name: 'Inversa', color: [124, 77, 255], typeChance: 0.10 },     // Violeta vivo (opuesto al jugador)
    // Eliminada la plataforma 'moving' por no tener poder
  }
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene

    // NUEVO: cleanup de ciclo de vida (una sola vez por escena)
    PlatformFactory._installSceneCleanup(this.scene)

    // NUEVO: sistema de estela (API Phaser 3.60+)
    PlatformFactory.ensureTrailSystem(this.scene)
    PlatformFactory.installTrailColorUpdater(this.scene)
  }

  // NUEVO: acepta colores en múltiples formatos y devuelve un número 0xRRGGBB
  // Soporta: número (0xRRGGBB), array [r,g,b], objeto {r,g,b}, string "#RRGGBB" o "rgb(r,g,b)"
  static resolveColor(input) {
    try {
      if (input == null) return null
      // Número ya válido
      if (typeof input === 'number' && isFinite(input)) return input >>> 0
      // Array [r,g,b]
      if (Array.isArray(input) && input.length >= 3) {
        const [r, g, b] = input
        return Phaser.Display.Color.GetColor(
          Math.max(0, Math.min(255, r|0)),
          Math.max(0, Math.min(255, g|0)),
          Math.max(0, Math.min(255, b|0))
        )
      }
      // Objeto {r,g,b} o {red,green,blue}
      if (typeof input === 'object') {
        const r = input.r ?? input.red
        const g = input.g ?? input.green
        const b = input.b ?? input.blue
        if ([r,g,b].every(v => typeof v === 'number')) {
          return Phaser.Display.Color.GetColor(
            Math.max(0, Math.min(255, r|0)),
            Math.max(0, Math.min(255, g|0)),
            Math.max(0, Math.min(255, b|0))
          )
        }
      }
      // String
      if (typeof input === 'string') {
        const s = input.trim()
        // rgb(r, g, b)
        const m = s.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
        if (m) {
          const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10)
          return Phaser.Display.Color.GetColor(
            Math.max(0, Math.min(255, r)),
            Math.max(0, Math.min(255, g)),
            Math.max(0, Math.min(255, b))
          )
        }
        // #RRGGBB o RRGGBB
        const h = s.replace(/^#/, '')
        if (/^[0-9a-fA-F]{6}$/.test(h)) {
          return parseInt(h, 16)
        }
      }
    } catch (_) { /* ignore */ }
    return null
  }

  // NUEVO: instala limpieza al reiniciar/destruir la escena para evitar fugas de estado
  static _installSceneCleanup(scene) {
    if (scene._pfCleanupInstalled) return
    scene._pfCleanupInstalled = true

    const cleanup = () => {
      // Limpia estado global de invertX
      const G = scene._invertXGlobal
      if (G) {
        if (G.handler) scene.events.off(Phaser.Scenes.Events.POST_UPDATE, G.handler)
        if (G.deactivateHandler) scene.events.off(Phaser.Scenes.Events.POST_UPDATE, G.deactivateHandler)
        G.footZone?.destroy()
        scene._invertXGlobal = null
      }

      // NUEVO: limpiar sistema de estela
      if (scene._trailHandler) {
        scene.events.off(Phaser.Scenes.Events.POST_UPDATE, scene._trailHandler)
        scene._trailHandler = null
      }
      scene._trailFootZone?.destroy()
      scene._trailFootZone = null
      if (scene.playerTrail?.emitter) {
        scene.playerTrail.emitter.stop?.()
        scene.playerTrail.emitter.destroy?.()
      }
      scene.playerTrail = null
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  // NUEVO: crea/recrea el sensor de estela bajo los pies si no existe o perdió el body
  static ensureTrailFoot(scene) {
    if (scene._trailFootZone && scene._trailFootZone.body) return scene._trailFootZone
    try { scene._trailFootZone?.destroy?.() } catch {}
    PlatformFactory.ensurePxTexture(scene)
    const foot = scene.physics.add.image(0, 0, 'px')
      .setVisible(false)
      .setAlpha(0)
      .setImmovable(true)
    if (foot.body) foot.body.allowGravity = false
    scene._trailFootZone = foot
    return foot
  }

  // NUEVO: crea el emisor de partículas (estela) con API compatible 3.60+
  static ensureTrailSystem(scene) {
    if (scene.playerTrail?.emitter) return
    PlatformFactory.ensurePxTexture(scene)
    const emitter = scene.add.particles(0, 0, 'px', {
  lifespan: 1600,
  // Emite más seguido y más partículas por tick para una estela más gruesa
  frequency: 10,
  quantity: 3,
      follow: scene.player ?? null,
  // Aumenta el tamaño inicial de cada partícula
  scale: { start: 3.0, end: 0 },
  alpha: { start: 0.8, end: 0 },
  // Menor velocidad para que se mantengan más cerca del jugador
  speed: { min: 0, max: 15 },
      angle: { min: -12, max: 12 },
      tint: 0xffffff,
      blendMode: 'ADD'
    })
    // Ajustar profundidad desde el manager si aplica
    emitter.manager?.setDepth?.((scene.player?.depth ?? 0) - 1)
    scene.playerTrail = { emitter, color: 0xffffff, following: !!scene.player }
    if (scene.playerTrail.following && emitter.startFollow) emitter.startFollow(scene.player)
  }

  // NUEVO: actualiza el color de la estela según la plataforma actual (con sensor robusto)
  static installTrailColorUpdater(scene) {
    if (scene._trailHandler) return
    PlatformFactory.ensurePxTexture(scene)
    PlatformFactory.ensureTrailFoot(scene)

    scene._trailHandler = () => {
      const player = scene.player
      const trail = scene.playerTrail
      const emitter = trail?.emitter
      if (!player || !emitter) return

      // Seguir al jugador una sola vez; mantener detrás
      if (!trail.following && emitter.startFollow) {
        emitter.startFollow(player)
        trail.following = true
      }
      emitter.manager?.setDepth?.((player.depth ?? 0) - 1)

      const pb = player.body
      if (!pb) return

      // Asegurar sensor y proteger llamadas a body
      const foot = PlatformFactory.ensureTrailFoot(scene)
      const fh = 6
      foot.setDisplaySize?.(player.displayWidth, fh)
      if (foot.body?.setSize) {
        foot.body.setSize(foot.displayWidth, fh, true)
      } else {
        foot.setSize?.(player.displayWidth, fh)
      }
      const cx = pb.center?.x ?? player.x
      const bottom = pb.bottom ?? (player.y + player.displayHeight / 2)
      if (foot.body?.reset) {
        foot.body.reset(cx, bottom + fh / 2 + 1)
      } else {
        foot.setPosition?.(cx, bottom + fh / 2 + 1)
      }

      // Buscar la plataforma bajo el jugador
      let tint = null
      scene.physics.overlap(foot, scene.platforms, (z, other) => {
        if (tint !== null) return
        const c = other?.typeColor
        tint = (typeof c === 'number' && c >= 0) ? c : 0xffffff
      })

      const newTint = tint ?? 0xffffff
      if (newTint !== trail.color) {
        // REEMPLAZO: usar API de ParticleEmitter (3.60+) y fallback seguro
        try {
          if (emitter.setParticleTint) {
            emitter.setParticleTint(newTint)
          } else if (emitter.setConfig) {
            emitter.setConfig({ tint: newTint })
          }
        } catch (_) {
          // ignorar si la plataforma/phaser no soporta cambio dinámico de tint
        }
        trail.color = newTint
      }
    }

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, scene._trailHandler)
  }

  // NUEVO: utilidades y lógica común -----------------------------------------

  /**
   * Selecciona un tipo en base a typeChance (normaliza automáticamente).
   * @returns {keyof typeof PlatformFactory.PLATFORM_TYPES}
   */
  static chooseType() {
    const entries = Object.entries(PlatformFactory.PLATFORM_TYPES)
    const weights = entries.map(([, v]) => Math.max(0, v.typeChance ?? 0))
    const sum = weights.reduce((a, b) => a + b, 0) || 1
    let r = Math.random() * sum
    for (let i = 0; i < entries.length; i++) {
      r -= weights[i]
      if (r <= 0) return /** @type {any} */ (entries[i][0])
    }
    return 'normal'
  }

  /**
   * Aplica banderas booleanas al objeto plataforma según el tipo.
   * @param {Phaser.Types.Physics.Arcade.GameObjectWithStaticBody & any} plat
   * @param {string} typeKey
   */
  static setTypeFlags(plat, typeKey) {
    plat.isFragile = typeKey === 'fragile'
    plat.isTimed = typeKey === 'timed'
    plat.isDodger = typeKey === 'dodger'
    plat.isIce = typeKey === 'ice'
    plat.isInversa = typeKey === 'inversa' 
    plat.isBouncy = typeKey === 'bouncy' 
    plat.isInvertX = typeKey === 'invertX'
  }

  /**
   * Aplica metadatos del tipo (name, color, chance) y devuelve el descriptor.
   * No pinta ni limpia tint por sí solo.
   * @param {Phaser.Types.Physics.Arcade.GameObjectWithStaticBody & any} plat
   * @param {string} typeKey
   */
  static applyTypeMeta(plat, typeKey) {
    const t = PlatformFactory.PLATFORM_TYPES[typeKey] || PlatformFactory.PLATFORM_TYPES.normal
    plat.typeName = t.name
  plat.typeColorRaw = t.color
  plat.typeColor = PlatformFactory.resolveColor(t.color)
    plat.typeChance = t.typeChance
    return t
  }

  /**
   * Parpadeo controlado que garantiza restaurar alpha.
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject & { setAlpha?: Function }} target
   * @param {number} ms
   */
  static blinkFor(scene, target, ms = 1000) {
    return new Promise((resolve) => {
      const tween = scene.tweens.add({
        targets: target,
        alpha: { from: 1, to: 0.25 },
        duration: 90,
        yoyo: true,
        repeat: Math.max(0, Math.floor(ms / 90) - 1),
        onComplete: () => target.setAlpha?.(1)
      })
      scene.time.delayedCall(ms, () => {
        if (tween?.isPlaying()) tween.stop()
        target.setAlpha?.(1)
        resolve()
      })
    })
  }

  /**
   * Asegura la textura de 1x1 necesaria para sensores/zonas.
   * @param {Phaser.Scene} scene
   */
  static ensurePxTexture(scene) {
    if (scene.textures.exists('px')) return
    const g = scene.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1); g.destroy()
  }

  /**
   * Crea una zona estática estrecha sobre la plataforma para medir permanencia.
   * @param {Phaser.Scene} scene
   * @param {Phaser.Types.Physics.Arcade.GameObjectWithStaticBody & any} plat
   * @param {number} zoneH
   */
  static createStayZone(scene, plat, zoneH = 6) {
    const zone = scene.physics.add.staticImage(plat.x, plat.y, 'px')
      .setOrigin(0.5, 0.5)
      .setVisible(false)
      .setAlpha(0)
    zone.setDisplaySize(plat.displayWidth, zoneH)
    zone.refreshBody()
    zone.y = plat.y - plat.displayHeight / 2 - zoneH / 2
    zone.refreshBody()
    return zone
  }

  /**
   * Aplica nombre/color/chance y efectos del tipo seleccionado.
   * Encapsula la lógica previa de cada tipo.
   * @param {Phaser.Scene} scene
   * @param {Phaser.Types.Physics.Arcade.GameObjectWithStaticBody & any} plat
   * @param {string} typeKey
   */
  applyTypeBehavior(scene, plat, typeKey) {
    switch (typeKey) {
      case 'fragile': {
        this.applyFragileBehavior(scene, plat)
        break
      }
      case 'timed': {
        this.applyTimedBehavior(scene, plat)
        break
      }
      case 'dodger': {
        PlatformFactory.applyTypeMeta(plat, 'dodger')
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()
        break
      }
      case 'ice': {
        PlatformFactory.applyTypeMeta(plat, 'ice')
  // Usar color resuelto de tipo
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()
        break
      }
      // NUEVO: Elástica (rebota al jugador y es semitransparente)
      case 'bouncy': {
        this.applyBouncyBehavior(scene, plat)
        break
      }
      // NUEVO: Inversa X (invierte controles horizontales mientras estás encima)
      case 'invertX': {
        this.applyInvertXBehavior(scene, plat)
        break
      }
      case 'inversa': {
        this.applyInversaBehavior(scene, plat)
        break
      }
      default: {
        const meta = PlatformFactory.applyTypeMeta(plat, 'normal')
  const resolved = PlatformFactory.resolveColor(meta.color)
  if (typeof resolved === 'number') plat.setTint(resolved); else plat.clearTint()
      }
    }
  }

  /**
   * Aplica comportamiento para plataforma 'fragile' (frágil).
   * - Meta/tinte.
   * - Limpieza de tweens y normalización de alpha.
   * - Se rompe 0.5s después de que el jugador se apoye encima.
   */
  applyFragileBehavior(scene, plat) {
  PlatformFactory.applyTypeMeta(plat, 'fragile')
    scene.tweens.killTweensOf(plat)
    plat.setAlpha(1)
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()

    // Sensor superior y rotura tras 0.5s de contacto
    PlatformFactory.ensurePxTexture(scene)
    const zone = PlatformFactory.createStayZone(scene, plat, 6)
    // Guardar como stayZone para que el tween de movimiento la mantenga alineada
    plat.stayZone = zone
    plat._fragileTriggered = false

    const triggerBreak = () => {
      if (plat._fragileTriggered || !plat.active) return
      plat._fragileTriggered = true
      // Parpadea 0.5s y luego destruye
      PlatformFactory.blinkFor(scene, plat, 500).then(() => {
        if (plat.active) plat.destroy()
      })
    }

    // Comprobación ligera de solape con el jugador
    plat._fragileEv = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!plat.active || !scene.player || !zone.body) return
        const overlapping = scene.physics.world.overlap(scene.player, zone)
        if (overlapping) triggerBreak()
      }
    })

    // Limpieza
    plat.once('destroy', () => {
      plat._fragileEv?.remove(false)
      zone.destroy()
    })
  }

  /**
   * Aplica comportamiento para plataforma 'timed' (temporizada).
   * - Meta/tinte.
   * - Parpadeo inicial.
   * - Sensor de permanencia y destrucción tras 2s sobre la plataforma.
   * - Respawn en la misma posición tras 500ms.
   */
  applyTimedBehavior(scene, plat) {
    PlatformFactory.applyTypeMeta(plat, 'timed')
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()

    // Parpadeo inicial (1s)
    PlatformFactory.blinkFor(scene, plat, 500)

    // Sensor y control de permanencia/desaparición-reaparición
    PlatformFactory.ensurePxTexture(scene)
    const stayZone = PlatformFactory.createStayZone(scene, plat, 6)
    plat.stayZone = stayZone
    plat._stayAccumMs = 0
    plat._breaking = false

    const tickMs = 100
    plat._stayCheckEv = scene.time.addEvent({
      delay: tickMs,
      loop: true,
      callback: () => {
        if (!plat.active || !scene.player || !stayZone.body) return
        const onTop = scene.physics.world.overlap(scene.player, stayZone)
        if (onTop) {
          plat._stayAccumMs += tickMs
          if (!plat._breaking && plat._stayAccumMs >= 1000) {
            plat._breaking = true
            PlatformFactory.blinkFor(scene, plat, 1000).then(() => { if (plat.active) plat.destroy() })
          }
        } else {
          plat._stayAccumMs = 0
        }
      }
    })

    // Respawn en misma X/Y al destruir + limpieza (espera 500 ms)
    const spawnX = plat.x
    const spawnY = plat.y
    plat.once('destroy', () => {
      plat._stayCheckEv?.remove(false)
      stayZone.destroy()
      scene.time.delayedCall(500, () => this.spawn(spawnX, spawnY))
    })
  }

  /**
   * Aplica comportamiento para plataforma 'inversa'.
   * - Meta/tinte.
   * - Evento que mueve la plataforma en sentido opuesto a la velocidad del jugador.
   * - Tintado del jugador mientras solapa con la plataforma.
   */  
  applyInversaBehavior(scene, plat) {
    PlatformFactory.applyTypeMeta(plat, 'inversa')
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()

    // Movimiento opuesto al del jugador (solo mientras se mueve) + WRAP horizontal
    plat._inversaTween = scene.time.addEvent({ 
      delay: 16,
      loop: true,
      callback: () => {
        if (!scene.player || !plat.active) return
        const body = scene.player.body
        if (body && Math.abs(body.velocity.x) > 0.1) {
          const speed = 4
          plat.x -= Math.sign(body.velocity.x) * speed
        }

        // NUEVO: screen wrap horizontal (como el personaje)
        const bounds = scene.physics?.world?.bounds
        const cam = scene.cameras?.main
        const left = bounds?.left ?? cam?.worldView?.x ?? 0
        const right = bounds ? bounds.right : (left + (cam?.worldView?.width ?? scene.scale?.width ?? 800))
        const halfW = (plat.displayWidth ?? plat.width ?? 0) * 0.5

        if (plat.x < left - halfW) {
          plat.x = right + halfW
        } else if (plat.x > right + halfW) {
          plat.x = left - halfW
        }

  plat.refreshBody()
  // Mantener fantasmas de borde sincronizados
  try { this.updateEdgeGhosts(plat) } catch {}
      }
    })
    plat.once('destroy', () => plat._inversaTween?.remove(false))

  // El tintado del jugador lo maneja centralmente PlayerColorManager en GameScene
  }

  /**
   * NUEVO: Aplica comportamiento para plataforma 'bouncy' (elástica).
   * - Semitransparente.
   * - Zona superior que detecta caída del jugador y lo hace rebotar. 
   * - Cooldown corto para evitar rebotes múltiples.
   * - Limpieza de timers y zona al destruirse.
   */
  applyBouncyBehavior(scene, plat) {
    PlatformFactory.applyTypeMeta(plat, 'bouncy')
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()
    plat.setAlpha(0.6)

    PlatformFactory.ensurePxTexture(scene)
    const bounceZone = PlatformFactory.createStayZone(scene, plat, 8)
    plat.bounceZone = bounceZone
    plat._bounceCooldown = false

    plat._bounceEv = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const player = scene.player
        if (!plat.active || !player || !bounceZone.body) return
        const overlapping = scene.physics.world.overlap(player, bounceZone)
        if (!overlapping) return

        const body = player.body
        if (!body) return 

        // Solo rebota si el jugador está cayendo sobre la zona
        if (body.velocity.y > 50 && !plat._bounceCooldown) {
          // NUEVO: impulso = 2x el salto normal del jugador (con fallback)
          const baseJump = Math.abs(
            player.jumpVelocity ?? player.jumpSpeed ?? player.jumpForce ?? player._jumpVelocity ?? 300
          )
          const boost = baseJump * 3
          player.setVelocityY?.(-boost)
          // Pequeño destello al rebotar
          plat.setAlpha(0.8)
          scene.tweens.add({ targets: plat, alpha: 0.6, duration: 120 })

          plat._bounceCooldown = true
          scene.time.delayedCall(220, () => { if (plat.active) plat._bounceCooldown = false })
        }
      }
    })

    plat.once('destroy', () => {
      plat._bounceEv?.remove(false)
      bounceZone.destroy()
    })
  }

  /**
   * NUEVO: Aplica comportamiento para plataforma 'invertX' (invierte controles en el eje X).
   * - Zona superior estrecha para detectar que el jugador está ENCIMA.
   * - Mientras haya solape con la zona, derecha=izquierda e izquierda=derecha.
   * - Tinte al jugador para feedback.
   * - Limpieza de eventos/zona en destroy.
   */
  applyInvertXBehavior(scene, plat) {
    PlatformFactory.applyTypeMeta(plat, 'invertX')
  if (typeof plat.typeColor === 'number') plat.setTint(plat.typeColor); else plat.clearTint()
 
    PlatformFactory.ensurePxTexture(scene)
    const invZone = PlatformFactory.createStayZone(scene, plat, 8)
    plat.invertZone = invZone

  
    // Estado global del efecto inverso (una sola vez por escena)
    const G = (scene._invertXGlobal = scene._invertXGlobal || {
      active: false, owner: null, keys: null, handler: null,
      footZone: null, deactivateHandler: null
    })

    // Teclas globales observadas (se crean una sola vez)
    if (!G.keys && scene.input?.keyboard?.addKeys) {
      G.keys = scene.input.keyboard.addKeys({
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        D: Phaser.Input.Keyboard.KeyCodes.D
      })
    }

    // Handler global: aplica inversión si el efecto está activo
    if (!G.handler) {
      G.handler = () => {
        if (!G.active || !scene.player) return
        const player = scene.player
        const body = player.body
        if (!body) return
        const leftDown = !!(G.keys?.LEFT?.isDown || G.keys?.A?.isDown)
        const rightDown = !!(G.keys?.RIGHT?.isDown || G.keys?.D?.isDown)
        if (leftDown === rightDown) return
        const dir = rightDown ? 1 : -1
        const base = 240
        player.setVelocityX?.(-dir * base)
      }
      scene.events.on(Phaser.Scenes.Events.POST_UPDATE, G.handler)
    }

    // Activador local: si el jugador está sobre ESTA plataforma, activa el efecto y marca dueño
    plat._invertXActivator = () => {
      const player = scene.player
      if (!plat.active || !player || !plat.invertZone?.body) return
      if (scene.physics.world.overlap(player, plat.invertZone)) {
        G.active = true
        G.owner = plat
      }
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, plat._invertXActivator)

    // NUEVO: desactivación fiable usando un sensor bajo los pies
    if (!G.deactivateHandler) {
      // Asegura que el sensor exista
      const ensureFootZone = () => {
        if (G.footZone && G.footZone.body) return
        PlatformFactory.ensurePxTexture(scene)
        G.footZone = scene.physics.add.image(0, 0, 'px')
          .setVisible(false)
          .setAlpha(0)
          .setImmovable(true)
        if (G.footZone.body) G.footZone.body.allowGravity = false
      }
      ensureFootZone()

      G.deactivateHandler = () => {
        if (!G.active || !scene.player) return
        const player = scene.player
        const pb = player.body
        if (!pb) return

        // Revalidar sensor si algo lo limpió
        ensureFootZone()
        if (!G.footZone || !G.footZone.body) return

        // Solo cuando el jugador está apoyado
        if (!(pb.blocked?.down || pb.touching?.down || player.body.onFloor?.())) return

        // Posicionar y dimensionar el sensor bajo los pies
        const fh = 4
        // Ajuste de display y body (con fallback seguro)
        G.footZone.setDisplaySize?.(player.displayWidth, fh)
        if (G.footZone.body?.setSize) {
          G.footZone.body.setSize(G.footZone.displayWidth, fh, true)
        } else {
          G.footZone.setSize?.(player.displayWidth, fh)
        }

        const cx = pb.center?.x ?? player.x
        const bottom = pb.bottom ?? (player.y + player.displayHeight / 2)
        if (G.footZone.body?.reset) {
          G.footZone.body.reset(cx, bottom + fh / 2 + 1)
        } else {
          G.footZone.setPosition?.(cx, bottom + fh / 2 + 1)
        }

        // ¿Toca una plataforma distinta al owner?
        let touchedDifferent = false
        scene.physics.overlap(G.footZone, scene.platforms, (zone, other) => {
          if (!other) return
          if (G.owner && other === G.owner) return
          touchedDifferent = true
        })

        if (touchedDifferent) {
          G.active = false
          G.owner = null
        }
      }

      scene.events.on(Phaser.Scenes.Events.POST_UPDATE, G.deactivateHandler)
    }

    // Limpieza del activador y zona al destruir esta plataforma
    plat.once('destroy', () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, plat._invertXActivator)
      plat.invertZone?.destroy()
      // El handler y el footZone global permanecen para otras plataformas invertX
    })
  }

  /**
   * Crea una plataforma en (x,y) con posibles rasgos especiales.
   * Devuelve el GameObject de plataforma (Static Physics Sprite).
   * @param {number} x
   * @param {number} y
   * @param {keyof typeof PlatformFactory.PLATFORM_TYPES | null} [forcedType=null]
   */
  spawn(x, y, forcedType = null, options = null) {
    const { scene } = this
    // Clamp Y para evitar spawns por debajo de la base (si la escena define el límite)
    const clampY = Number(scene.platformSpawnMaxY)
    const spawnY = isFinite(clampY) ? Math.min(y, clampY) : y
    // Evitar eje X de la base si la escena lo define y hay radio de evitación
    let spawnX = x
    const allowBaseX = !!(options && (options.allowBaseX || options.isBase || options.noAvoidBaseX))
  const avoidBaseX = scene.platformBaseX
  const r = Number(gameConfig?.platforms?.avoidBaseXRadius) || 0
    if (!allowBaseX && isFinite(avoidBaseX) && r > 0) {
  const minX = 12, maxX = scene.scale?.width ? (scene.scale.width - 12) : (x)
      let attempts = 0
      while (Math.abs(spawnX - avoidBaseX) < r && attempts < 16) {
        spawnX = Phaser.Math.Between(minX, maxX)
        attempts++
      }
    }
    const plat = scene.platforms.create(spawnX, spawnY, 'platform')
    plat.refreshBody()

    // REEMPLAZO: selección/aplicación del tipo (con flags y comportamiento)
    const typeKey = (forcedType && PlatformFactory.PLATFORM_TYPES[forcedType])
      ? forcedType
      : PlatformFactory.chooseType()

    PlatformFactory.setTypeFlags(plat, typeKey)
    this.applyTypeBehavior(scene, plat, typeKey)

  // Intentar spawnear un poder encima según config
  try { scene.powerManager?.maybeSpawnAbovePlatform?.(plat) } catch {}

  // 15% móviles si no son dodger, hielo, elástica ni inversa X, salvo que se fuerce no mover
  const noMove = !!(options && options.noMove)
  plat.isMoving = !noMove && !plat.isDodger && !plat.isIce && !plat.isBouncy && !plat.isInvertX && Math.random() < 0.15
    if (plat.isMoving) {
      const amplitude = Phaser.Math.Between(30, 90)
      const baseX = x
      const moveTween = scene.tweens.add({
        targets: plat,
        x: { from: baseX - amplitude, to: baseX + amplitude },
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(1500, 2800),
        ease: 'Sine.inOut',
        onUpdate: (tween, target) => {
          // Proteger contra objetos destruidos en mitad del tween
          if (!target || !target.active) return
          const body = target.body
          if (body && typeof body.updateFromGameObject === 'function') {
            body.updateFromGameObject()
          }
          // Mantener la stayZone alineada si existe y su body sigue válido
          const zone = target.stayZone
          if (zone && zone.body) {
            zone.x = target.x
            zone.y = target.y - target.displayHeight / 2 - zone.displayHeight / 2
            zone.refreshBody()
          }
          // Mantener pickup de poder alineado si existe
          const pickup = target.powerPickup
          if (pickup && pickup.body) {
            pickup.x = target.x
            pickup.y = target.y - target.displayHeight / 2 - 22
            pickup.refreshBody?.()
          }
          // Mantener fantasmas de borde sincronizados
          try { this.updateEdgeGhosts(target) } catch {}
        }
      })
      // Guardar referencia y limpiar al destruir la plataforma
      plat._moveTween = moveTween
      plat.once('destroy', () => {
        try { scene.tweens.killTweensOf(plat) } catch {}
        try { moveTween?.stop?.() } catch {}
      })
    }

    // Crear/actualizar fantasmas de borde al crear
    try { this.updateEdgeGhosts(plat) } catch {}

    return plat
  }
}

// --- Fantasmas de borde (wrap visual/colisión) ---------------------------------
/**
 * Crea/elimina y sincroniza copias "fantasma" a ±ancho de pantalla para que,
 * al envolver horizontalmente, las plataformas existan inmediatamente al otro lado.
 * Los fantasmas no cuentan para puntaje ni spawns y se marcan con isGhost=true.
 * @param {Phaser.Types.Physics.Arcade.GameObjectWithStaticBody & any} plat
 */
PlatformFactory.prototype.updateEdgeGhosts = function(plat) {
  const scene = this.scene
  if (!scene || !plat || !plat.active) return
  const width = scene.scale?.width || 800
  const edge = 60
  const halfW = (plat.displayWidth ?? plat.width ?? 0) * 0.5

  // Helper para crear un fantasma si no existe
  const ensureGhost = (side) => {
    const key = side === 'left' ? '_ghostLeft' : '_ghostRight'
    if (plat[key] && plat[key].active) return plat[key]
    const offset = side === 'left' ? -width : width
    const ghost = scene.physics.add.staticImage(plat.x + offset, plat.y, 'platform')
      .setDepth(plat.depth ?? 0)
      .setAlpha(plat.alpha ?? 1)
    // Tamaño/escala como la original
    if (ghost.setDisplaySize && plat.displayWidth && plat.displayHeight) {
      ghost.setDisplaySize(plat.displayWidth, plat.displayHeight)
    }
    ghost.refreshBody?.()
    ghost.isGhost = true
    // Copiar tinte del tipo si aplica
    const tint = plat.typeColor
    if (typeof tint === 'number') ghost.setTint(tint)
    // Añadir al mismo grupo para colisiones
    try { scene.platforms?.add?.(ghost) } catch {}
    plat[key] = ghost
    // Destruir junto con la original
    plat.once('destroy', () => { try { ghost.destroy() } catch {} })
    return ghost
  }

  const nearLeft = (plat.x - halfW) <= edge
  const nearRight = (width - (plat.x + halfW)) <= edge

  // Fantasma a la izquierda (aparece a la derecha)
  if (nearLeft) {
    const g = ensureGhost('right')
    if (g && g.active) {
      g.x = plat.x + width
      g.y = plat.y
      g.refreshBody?.()
    }
  } else if (plat._ghostRight) {
    try { plat._ghostRight.destroy() } catch {}
    plat._ghostRight = null
  }

  // Fantasma a la derecha (aparece a la izquierda)
  if (nearRight) {
    const g = ensureGhost('left')
    if (g && g.active) {
      g.x = plat.x - width
      g.y = plat.y
      g.refreshBody?.()
    }
  } else if (plat._ghostLeft) {
    try { plat._ghostLeft.destroy() } catch {}
    plat._ghostLeft = null
  }
}