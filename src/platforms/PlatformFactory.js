import Phaser from 'phaser'

export default class PlatformFactory {
  static PLATFORM_TYPES = {
  fragile:   { name: 'Frágil',      color: 0xff1744, typeChance: 0.10 }, // rojo vivo
  timed:     { name: 'Temporizada', color: 0xffea00, typeChance: 0.15 }, // amarillo neón
  dodger:    { name: 'Escurridiza', color: 0x651fff, typeChance: 0.15 }, // violeta intenso
  ice:       { name: 'Hielo',       color: 0x00e5ff, typeChance: 0.15 }, // celeste brillante
  normal:    { name: 'Normal',      color: null,     typeChance: 0.45 }, // sin color
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
