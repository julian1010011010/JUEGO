import Phaser from 'phaser'

export default class PlatformFactory {
  static PLATFORM_TYPES = {
    fragile: { name: 'Frágil', color: 0xff1744, typeChance: 0.10 }, // rojo vivo
    timed: { name: 'Temporizada', color: 0xffea00, typeChance: 0.15 }, // amarillo neón
    dodger: { name: 'Escurridiza', color: 0x651fff, typeChance: 0.15 }, // lavioleta intenso
    ice: { name: 'Hielo', color: 0xff69b4, typeChance: 0.15 }, // rosa
    normal: { name: 'Normal', color: null, typeChance: 0.45 }, // sin color
    // Eliminada la plataforma 'moving' por no tener poder
  }
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene
  }

  /**
   * Crea una plataforma en (x,y) con posibles rasgos especiales.
   * Devuelve el GameObject de plataforma (Static Physics Sprite).
   */
  spawn(x, y, forcedType = null) {
    const { scene } = this
    const plat = scene.platforms.create(x, y, 'platform')
    plat.refreshBody()

    // Permitir forzar el tipo de plataforma
    if (forcedType && PlatformFactory.PLATFORM_TYPES[forcedType]) {
      plat.isFragile = forcedType === 'fragile'
      plat.isTimed = forcedType === 'timed'
      plat.isDodger = forcedType === 'dodger'
      plat.isIce = forcedType === 'ice'
    } else {
      // Asignación de tipos (mutuamente excluyentes salvo móviles):
      // frágil (10%), temporizada (15%), escurridiza/dodger (15%), hielo (15%), normal en otro caso.
      const r = Math.random()
      plat.isFragile = r < 0.10
      plat.isTimed = !plat.isFragile && r >= 0.10 && r < 0.25
      plat.isDodger = !plat.isFragile && !plat.isTimed && r >= 0.25 && r < 0.40
      plat.isIce = !plat.isFragile && !plat.isTimed && !plat.isDodger && r >= 0.40 && r < 0.55
    }

    // Asignar nombre, color y chance según tipo
    if (plat.isFragile) {
      const t = PlatformFactory.PLATFORM_TYPES.fragile
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      plat.setTint(t.color)
      // (Sin lógica de parpadeo/respawn aquí)
    } else if (plat.isTimed) {
      const t = PlatformFactory.PLATFORM_TYPES.timed
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      plat.setTint(t.color)

      // Parpadeo al crear (1s)
      const blinkFor = (ms = 1000) => new Promise((resolve) => {
        const tween = scene.tweens.add({
          targets: plat,
          alpha: { from: 1, to: 0.25 },
          duration: 90,
          yoyo: true,
          repeat: Math.max(0, Math.floor(ms / 90) - 1),
          onComplete: () => plat.setAlpha(1)
        })
        scene.time.delayedCall(ms, () => {
          if (tween?.isPlaying()) tween.stop()
          plat.setAlpha(1)
          resolve()
        })
      })
      blinkFor(1000)

      // Asegura textura 'px' para el sensor
      if (!scene.textures.exists('px')) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false })
        g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 1, 1)
        g.generateTexture('px', 1, 1); g.destroy()
      }

      // Zona de permanencia (encima de la plataforma)
      const zoneH = 6
      const stayZone = scene.physics.add.staticImage(plat.x, plat.y, 'px')
        .setOrigin(0.5, 0.5)
        .setVisible(false)
        .setAlpha(0)
      stayZone.setDisplaySize(plat.displayWidth, zoneH)
      stayZone.refreshBody()
      stayZone.y = plat.y - plat.displayHeight / 2 - zoneH / 2
      stayZone.refreshBody()
      plat.stayZone = stayZone

      // Acumulador de permanencia (2s requeridos)
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
              blinkFor(1000).then(() => { if (plat.active) plat.destroy() })
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
        this.scene.time.delayedCall(500, () => this.spawn(spawnX, spawnY))
      })
    } else if (plat.isDodger) {
      const t = PlatformFactory.PLATFORM_TYPES.dodger
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      plat.setTint(t.color)
    } else if (plat.isIce) {
      const t = PlatformFactory.PLATFORM_TYPES.ice
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      // Forzar rosa
      plat.setTint(0xff69b4)
    } else {
      const t = PlatformFactory.PLATFORM_TYPES.normal
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      plat.clearTint()
    }

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
