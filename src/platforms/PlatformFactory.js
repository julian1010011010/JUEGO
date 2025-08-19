import Phaser from 'phaser'
import PlayerColorManager from '../effects/PlayerColorManager'
import gameConfig from '../config/gameConfig'

export default class PlatformFactory {
  static PLATFORM_TYPES = {
    fragile: { name: 'Frágil',    color: 0xff1744, typeChance: 0.10 },
    timed:   { name: 'Temporizada', color: 0xffea00, typeChance: 0.15 },
    dodger:  { name: 'Escurridiza', color: 0x651fff, typeChance: 0.15 },
    ice:     { name: 'Hielo',       color: 0xff69b4, typeChance: 0.15 },
    inversa: { name: 'Inversa',     color: 0x000000, typeChance: 0.10 },
    normal:  { name: 'Normal',      color: null,     typeChance: null }, // toma el resto
  }

  /**
   * Helpers estáticos reutilizables (evita recreaciones por spawn)
   */
  static ensurePxTexture(scene) {
    if (!scene.textures.exists('px')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 1, 1)
      g.generateTexture('px', 1, 1)
      g.destroy()
    }
  }

  static blink(scene, target, ms = 1000, minAlpha = 0.25, step = 90) {
    // Devuelve una promesa y asegura alpha=1 al terminar
    return new Promise((resolve) => {
      if (!target?.active) return resolve()
      scene.tweens.killTweensOf(target)
      target.setAlpha(1)

      const reps = Math.max(0, Math.floor(ms / step) - 1)
      const tween = scene.tweens.add({
        targets: target,
        alpha: { from: 1, to: minAlpha },
        duration: step,
        yoyo: true,
        repeat: reps,
        onComplete: () => target.setAlpha(1),
      })

      scene.time.delayedCall(ms, () => {
        if (tween?.isPlaying()) tween.stop()
        target.setAlpha(1)
        resolve()
      })
    })
  }

  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene

    // Gestor de color del jugador, 1 por escena
    if (!scene.playerColorManager) {
      scene.playerColorManager = new PlayerColorManager(scene, scene.player ?? null)
    } else if (!scene.playerColorManager.player && scene.player) {
      scene.playerColorManager.setPlayer(scene.player)
    }

    // Precalcular distribución ( todas salvo normal )
    this.weightedKeys = this.buildWeightedKeys()
  }

  buildWeightedKeys() {
    const entries = Object.entries(PlatformFactory.PLATFORM_TYPES)
      .filter(([k]) => k !== 'normal')
    const total = entries.reduce((acc, [, v]) => acc + (v.typeChance ?? 0), 0)
    const arr = []
    let cum = 0
    for (const [k, v] of entries) {
      cum += v.typeChance ?? 0
      arr.push({ key: k, cum })
    }
    // normal absorbe el resto (1 - total)
    this.normalRemainder = Math.max(0, 1 - total)
    return arr
  }

  chooseType(forcedType = null) {
    if (forcedType && PlatformFactory.PLATFORM_TYPES[forcedType]) return forcedType
    const r = Math.random()
    for (const it of this.weightedKeys) {
      if (r < it.cum) return it.key
    }
    return 'normal'
  }

  /** Etiquetar nombre/color/chance de forma centralizada */
  tagPlatform(plat, key) {
    const def = PlatformFactory.PLATFORM_TYPES[key]
    plat.typeKey = key
    plat.typeName = def.name
    plat.typeColor = def.color
    plat.typeChance = def.typeChance ?? this.normalRemainder
    if (def.color == null) plat.clearTint()
    else plat.setTint(def.color)
  }

  /** Limpieza estándar de recursos asociados a la plataforma */
  cleanupOnDestroy(plat, disposers = []) {
    plat.once('destroy', () => {
      for (const d of disposers) {
        if (!d) continue
        // tolerante: soporta tweens, timers y GOs con destroy/remove/stop
        if (d.remove) d.remove(false)
        else if (d.stop) d.stop()
        else if (d.destroy) d.destroy()
      }
    })
  }

  /** Comportamiento: frágil */
  setupFragile(plat) {
    // Solo visual ahora. Si luego añades lógica (romper al tocar) ya tienes punto único.
    this.scene.tweens.killTweensOf(plat)
    plat.setAlpha(1)
  }

  /** Comportamiento: temporizada (rompe tras 2s de permanencia) y respawn */
  setupTimed(plat) {
    const scene = this.scene
    PlatformFactory.ensurePxTexture(scene)

    // Zona de permanencia
    const zoneH = 6
    const stayZone = scene.physics.add.staticImage(plat.x, plat.y, 'px')
      .setOrigin(0.5, 0.5)
      .setVisible(false)
      .setAlpha(0)
    stayZone.setDisplaySize(plat.displayWidth, zoneH)
    stayZone.y = plat.y - plat.displayHeight / 2 - zoneH / 2
    stayZone.refreshBody()
    plat.stayZone = stayZone

    // Estado
    plat._stayAccumMs = 0
    plat._breaking = false
    const tickMs = 100

    const ev = scene.time.addEvent({
      delay: tickMs,
      loop: true,
      callback: () => {
        if (!plat.active || !scene.player || !stayZone.body) return
        const onTop = scene.physics.world.overlap(scene.player, stayZone)
        plat._stayAccumMs = onTop ? plat._stayAccumMs + tickMs : 0

        if (!plat._breaking && plat._stayAccumMs >= 2000) {
          plat._breaking = true
          PlatformFactory.blink(scene, plat, 1000).then(() => {
            if (plat.active) plat.destroy()
          })
        }
      },
    })

    const spawnX = plat.x
    const spawnY = plat.y

    // Respawn + cleanup
    this.cleanupOnDestroy(plat, [ev, stayZone])
    plat.once('destroy', () => {
      scene.time.delayedCall(500, () => this.spawn(spawnX, spawnY))
    })
  }

  /** Comportamiento: inversa (se mueve contrario a la vel. X del player) + tintado jugador */
  setupInversa(plat) {
    const scene = this.scene
    const mgr = scene.playerColorManager || (scene.playerColorManager = new PlayerColorManager(scene, scene.player ?? null))
    if (!mgr.player && scene.player) mgr.setPlayer(scene.player)

    const speed = 2
    const mulBase = gameConfig?.platforms?.movement?.displacementFactor ?? 1
    const mulInversa = gameConfig?.platforms?.movement?.inversaDisplacementFactor ?? mulBase

    const ev = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!scene.player || !plat.active) return
        const body = scene.player.body
        if (body && Math.abs(body.velocity.x) > 0.1) {
          // Aplicar desplazamiento con multiplicador parametrizable
          plat.x -= Math.sign(body.velocity.x) * speed * mulInversa
          plat.refreshBody()
          if (plat.stayZone) { // por si existiera
            plat.stayZone.x = plat.x
            plat.stayZone.refreshBody()
          }
        }
      },
    })

    mgr.applyWhileOverlap(plat, 0x000000, 80)
    this.cleanupOnDestroy(plat, [ev])
    plat.once('destroy', () => mgr.stopFor(plat, true))
  }

  /** Comportamiento: móviles (común) */
  setupMoving(plat, baseX) {
    const scene = this.scene
    const amplitude = Phaser.Math.Between(30, 90)
    const tw = scene.tweens.add({
      targets: plat,
      x: { from: baseX - amplitude, to: baseX + amplitude },
      yoyo: true,
      repeat: -1,
      duration: Phaser.Math.Between(1500, 2800),
      ease: 'Sine.inOut',
      onUpdate: (_tween, target) => {
        if (target?.body?.updateFromGameObject) target.body.updateFromGameObject()
        if (target?.stayZone) {
          target.stayZone.x = target.x
          target.stayZone.y = target.y - target.displayHeight / 2 - target.stayZone.displayHeight / 2
          target.stayZone.refreshBody()
        }
      },
    })
    this.cleanupOnDestroy(plat, [tw])
  }

  /** Punto único de creación y configuración */
  spawn(x, y, forcedType = null) {
    const { scene } = this
    const plat = scene.platforms.create(x, y, 'platform')
    // Ajustes base
    plat.setAlpha(1)
    plat.refreshBody()

    const key = this.chooseType(forcedType)
    this.tagPlatform(plat, key)

    // Comportamientos por tipo
    switch (key) {
      case 'fragile':
        this.setupFragile(plat)
        break
      case 'timed':
        PlatformFactory.blink(scene, plat, 1000) // feedback inicial
        this.setupTimed(plat)
        break
      case 'dodger':
        // visual ya aplicado en tagPlatform; si luego agregas lógica, centraliza aquí
        break
      case 'ice':
        // Color ya es rosa en config; si requiere físicas (deslizamiento), aplícalo aquí
        break
      case 'inversa':
        this.setupInversa(plat)
        break
      case 'normal':
      default:
        // sin extras
        break
    }

    // Móviles: evita mezclas complejas (como antes) con dodger/ice
    plat.isMoving = (key !== 'dodger' && key !== 'ice') && Math.random() < 0.15
    if (plat.isMoving) this.setupMoving(plat, x)

    return plat
  }
}
