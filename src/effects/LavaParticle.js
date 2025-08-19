import Phaser from 'phaser'

export default class LavaParticle extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, opts = {}) {
    // 1) Garantiza textura 'px' ANTES de crear el sprite
    if (!scene.textures.exists('px')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 1, 1)
      g.generateTexture('px', 1, 1)
      g.destroy()
    }

    super(scene, x, y, 'px')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // 2) Opciones
    this.delayMs = opts.delay ?? 2000
    this.speed   = opts.speed ?? 420
    this.useCircleCollider = !!opts.circleCollider

    // Soporta número o rango {min,max}
    const sizeOpt = opts.size ?? 8
    let desiredSize
    if (typeof sizeOpt === 'number') {
      desiredSize = Math.max(1, Math.round(sizeOpt))
    } else {
      const min = Math.max(1, Math.round(sizeOpt.min ?? 1))
      const max = Math.max(min, Math.round(sizeOpt.max ?? min))
      desiredSize = Phaser.Math.Between(min, max)
    }
    this.size = desiredSize // NO clamping a 10: respeta config grande (p.ej. 50–100)

    // Apariencia y físicas
    this.setDepth(2)
    this.setOrigin(0.5, 0.5)
    this.setBlendMode(Phaser.BlendModes.ADD)
    this.setActive(true).setVisible(true)
    this.body.setAllowGravity(false)
    this.setCollideWorldBounds(false)
    this.setVelocity(0, 0)
    if (this.body) this.body.enable = false // deshabilitado mientras “carga”

    // Estado
    this._waiting = true
    this._palette = [0xdc2626, 0xf97316, 0xf59e0b, 0xfbbf24]
    this._colorIdx = 0

    // Talla inicial: visual + collider
    this.syncCollider()

    // Parpadeo y timers
    this._blinkEvent = scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => this.setTint(this._palette[(this._colorIdx++) % this._palette.length]),
      callbackScope: this
    })
    this._launchEvent = scene.time.delayedCall(this.delayMs, () => this.launch())
    this._lifeEvent   = scene.time.delayedCall(7000, () => this.destroy())
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta)
    // Mientras espera, seguir la cresta de la lava
    if (this._waiting && this.scene.lava) {
      this.y = this.scene.lava.y - 2
      this.setVelocity(0, 0)
      this.body?.updateFromGameObject?.()
    }
  }

  launch() {
    if (!this.scene || !this.scene.player) {
      this.destroy()
      return
    }
    this._waiting = false
    this._blinkEvent?.remove(false)
    this.clearTint()
    this.setAlpha(1)
    this.body.setAllowGravity(false)
    if (this.body) this.body.enable = true

    // Asegura tamaño correcto justo antes de moverse
    this.syncCollider()

    const { x: px, y: py } = this.scene.player
    const dx = px - this.x
    const dy = py - this.y
    const len = Math.max(1e-3, Math.hypot(dx, dy))
    this.setVelocity((dx / len) * this.speed, (dy / len) * this.speed)
  }

  // ÚNICO: iguala visual y collider y centra en el origen (0.5, 0.5)
  syncCollider() {
    if (!this.body) return

    // Visual
    this.setDisplaySize(this.size, this.size)

    // Collider
    if (this.useCircleCollider) {
      const r = Math.round(this.displayWidth / 2)
      // Offset para centrar el círculo en el origen (0.5,0.5)
      const ox = -r + this.width * this.originX
      const oy = -r + this.height * this.originY
      this.body.setCircle(r, ox, oy)
    } else {
      const bw = Math.max(1, Math.round(this.displayWidth))
      const bh = Math.max(1, Math.round(this.displayHeight))
      this.body.setSize(bw, bh, true) // true = centra en origen
    }
    this.body.updateFromGameObject?.()
  }

  destroy(fromScene) {
    this._blinkEvent?.remove(false)
    this._launchEvent?.remove(false)
    this._lifeEvent?.remove(false)
    super.destroy(fromScene)
  }
}
