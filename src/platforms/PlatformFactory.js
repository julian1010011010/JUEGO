import Phaser from 'phaser'

export default class PlatformFactory {
  static PLATFORM_TYPES = {
    fragile:   { name: 'Frágil',      color: 0xffa3a3, typeChance: 0.10 }, // 10%
    timed:     { name: 'Temporizada', color: 0xfacc15, typeChance: 0.15 }, // 15%
    dodger:    { name: 'Escurridiza', color: 0xa78bfa, typeChance: 0.15 }, // 15%
    ice:       { name: 'Hielo',       color: 0x60a5fa, typeChance: 0.15 }, // 15%
    normal:    { name: 'Normal',      color: null,     typeChance: 0.45 }, // 45%
    moving:    { name: 'Móvil',       color: 0x34d399, typeChance: 0.15 }, // 15% (solo si se quiere mostrar)
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
  spawn(x, y) {
    const { scene } = this
    const plat = scene.platforms.create(x, y, 'platform')
    plat.refreshBody()

    // Asignación de tipos (mutuamente excluyentes salvo móviles):
    // frágil (10%), temporizada (15%), escurridiza/dodger (15%), hielo (15%), normal en otro caso.
    const r = Math.random()
    plat.isFragile = r < 0.10
    plat.isTimed = !plat.isFragile && r >= 0.10 && r < 0.25
    plat.isDodger = !plat.isFragile && !plat.isTimed && r >= 0.25 && r < 0.40
    plat.isIce    = !plat.isFragile && !plat.isTimed && !plat.isDodger && r >= 0.40 && r < 0.55

    // Asignar nombre, color y chance según tipo
    if (plat.isFragile) {
      const t = PlatformFactory.PLATFORM_TYPES.fragile
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      plat.setTint(t.color)
    } else if (plat.isTimed) {
      const t = PlatformFactory.PLATFORM_TYPES.timed
      plat.typeName = t.name
      plat.typeColor = t.color
      plat.typeChance = t.typeChance
      plat.setTint(t.color)
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
      plat.setTint(t.color)
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
        }
      })
        // Si quieres mostrar el color de móvil, descomenta:
        // plat.setTint(PlatformFactory.PLATFORM_TYPES.moving.color)
        // plat.typeName += ' + ' + PlatformFactory.PLATFORM_TYPES.moving.name
    }

    return plat
  }
}
