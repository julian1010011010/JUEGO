import Phaser from 'phaser'
import PlayerColorManager from '../effects/PlayerColorManager'

/**
 * Fabrica de plataformas con rasgos especiales.
 * - Selección de tipo ponderada y centralizada.
 * - Meta y efectos por tipo encapsulados.
 * - Utilidades reutilizables (blink, ensurePxTexture, stayZone).
 * - JSDoc y limpieza de timers/eventos.
 */
export default class PlatformFactory {
  static PLATFORM_TYPES = {
    fragile: { name: 'Frágil', color: 0xff1744, typeChance: 0.10 },
    timed: { name: 'Temporizada', color: 0xffea00, typeChance: 0.15 },
    dodger: { name: 'Escurridiza', color: 0x651fff, typeChance: 0.15 },
    ice: { name: 'Hielo', color: 0xff69b4, typeChance: 0.15 },
    normal: { name: 'Normal', color: null, typeChance: 0.45 },
    inversa: { name: 'Inversa', color: 0x000000, typeChance: 0.10 }, // negro
    // Eliminada la plataforma 'moving' por no tener poder
  }
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene
    // NUEVO: inicializa el gestor de color del jugador (una sola vez por escena)
    if (!this.scene.playerColorManager) {
      this.scene.playerColorManager = new PlayerColorManager(this.scene, this.scene.player ?? null)
    } else if (!this.scene.playerColorManager.player && this.scene.player) {
      this.scene.playerColorManager.setPlayer(this.scene.player)
    }
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
    plat.typeColor = t.color
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
        PlatformFactory.applyTypeMeta(plat, 'fragile')
        scene.tweens.killTweensOf(plat)
        plat.setAlpha(1)
        plat.setTint(PlatformFactory.PLATFORM_TYPES.fragile.color)
        break
      }
      case 'timed': {
        PlatformFactory.applyTypeMeta(plat, 'timed')
        plat.setTint(PlatformFactory.PLATFORM_TYPES.timed.color)

        // Parpadeo inicial (1s)
        PlatformFactory.blinkFor(scene, plat, 1000)

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
              if (!plat._breaking && plat._stayAccumMs >= 2000) {
                plat._breaking = true
                PlatformFactory.blinkFor(scene, plat, 1000).then(() => { if (plat.active) plat.destroy() })
              }
            } else {
              plat._stayAccumMs = 0
            }
          }
        })

        const spawnX = plat.x
        const spawnY = plat.y
        plat.once('destroy', () => {
          plat._stayCheckEv?.remove(false)
          stayZone.destroy()
          scene.time.delayedCall(500, () => this.spawn(spawnX, spawnY))
        })
        break
      }
      case 'dodger': {
        PlatformFactory.applyTypeMeta(plat, 'dodger')
        plat.setTint(PlatformFactory.PLATFORM_TYPES.dodger.color)
        break
      }
      case 'ice': {
        PlatformFactory.applyTypeMeta(plat, 'ice')
        plat.setTint(0xff69b4) // rosa forzado
        break
      }
      case 'inversa': {
        this.applyInversaBehavior(scene, plat)
        break
      }
      default: {
        PlatformFactory.applyTypeMeta(plat, 'normal')
        plat.clearTint()
      }
    }
  }

  /**
   * Aplica comportamiento para plataforma 'inversa'.
   * - Meta/tinte.
   * - Evento que mueve la plataforma en sentido opuesto a la velocidad del jugador.
   * - Tintado del jugador mientras solapa con la plataforma.
   */
  applyInversaBehavior(scene, plat) {
    PlatformFactory.applyTypeMeta(plat, 'inversa')
    plat.setTint(0x000000)

    // Movimiento opuesto al del jugador (solo mientras se mueve)
    plat._inversaTween = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!scene.player || !plat.active) return
        const body = scene.player.body
        if (body && Math.abs(body.velocity.x) > 0.1) {
          const speed = 2
          plat.x -= Math.sign(body.velocity.x) * speed
          plat.refreshBody()
        }
      }
    })
    plat.once('destroy', () => plat._inversaTween?.remove(false))

    // Efecto de tintado del jugador mientras hay solape
    const mgr = scene.playerColorManager || (scene.playerColorManager = new PlayerColorManager(scene, scene.player ?? null))
    if (!mgr.player && scene.player) mgr.setPlayer(scene.player)
    mgr.applyWhileOverlap(plat, 0x000000, 80)
    plat.once('destroy', () => mgr.stopFor(plat, true))
  }

  /**
   * Crea una plataforma en (x,y) con posibles rasgos especiales.
   * Devuelve el GameObject de plataforma (Static Physics Sprite).
   * @param {number} x
   * @param {number} y
   * @param {keyof typeof PlatformFactory.PLATFORM_TYPES | null} [forcedType=null]
   */
  spawn(x, y, forcedType = null) {
    const { scene } = this
    const plat = scene.platforms.create(x, y, 'platform')
    plat.refreshBody()

    // REEMPLAZO: selección/aplicación del tipo (con flags y comportamiento)
    const typeKey = (forcedType && PlatformFactory.PLATFORM_TYPES[forcedType])
      ? forcedType
      : PlatformFactory.chooseType()

    PlatformFactory.setTypeFlags(plat, typeKey)
    this.applyTypeBehavior(scene, plat, typeKey)

    // 15% móviles si no son dodger ni hielo (para evitar combinaciones complicadas)
    plat.isMoving = !plat.isDodger && !plat.isIce && Math.random() < 0.15
    if (plat.isMoving) {
      const amplitude = Phaser.Math.Between(30, 90)
      const baseX = x
      scene.tweens.add({
        targets: plat,
        x: { from: baseX - amplitude, to: baseX + amplitude },
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(1500, 2800),
        ease: 'Sine.inOut',
        onUpdate: (tween, target) => {
          if (target && target.body && target.body.updateFromGameObject) {
            target.body.updateFromGameObject()
          }
          // Mantener la stayZone alineada si existe
          if (target && target.stayZone) {
            target.stayZone.x = target.x
            target.stayZone.y = target.y - target.displayHeight / 2 - target.stayZone.displayHeight / 2
            target.stayZone.refreshBody()
          }
        }
      })
      // Si quieres mostrar el color de móvil, descomenta:
      // plat.setTint(PlatformFactory.PLATFORM_TYPES.moving.color)
      // plat.typeName += ' + ' + PlatformFactory.PLATFORM_TYPES.moving.name
    }

    return plat
  }
}