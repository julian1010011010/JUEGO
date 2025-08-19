import Phaser from 'phaser'

export default class PlatformFactory {
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

    if (plat.isFragile) {
      plat.setTint(0xffa3a3) // rojo suave
    } else if (plat.isTimed) {
      plat.setTint(0xfacc15) // amarillo
    } else if (plat.isDodger) {
      plat.setTint(0xa78bfa) // violeta
    } else if (plat.isIce) {
      plat.setTint(0x60a5fa) // azul hielo
    } else {
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
    }

    return plat
  }
}
