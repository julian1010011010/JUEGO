import Phaser from 'phaser'

export default class LavaParticle extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, opts = {}) {
    super(scene, x, y, 'px')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Garantiza textura 'px' si aún no existe
    if (!scene.textures.exists('px')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 1, 1)
      g.generateTexture('px', 1, 1)
      g.destroy()
    }
    this.setTexture('px')

    // Opciones
    this.delayMs = opts.delay ?? 2000
    this.speed = opts.speed ?? 420
    this.size = Phaser.Math.Clamp(opts.size ?? 3, 1, 64)

    // Apariencia y físicas
    this.setDepth(2)
    this.setDisplaySize(this.size, this.size)
    const collider = Math.max(1, this.size - 2) // un poco más pequeño que el visual
    if (this.body && this.body.setSize) this.body.setSize(collider, collider, true)
    if (this.body && this.body.updateFromGameObject) this.body.updateFromGameObject()
    this.setBlendMode(Phaser.BlendModes.ADD)
    this.setActive(true).setVisible(true)
    this.body.setAllowGravity(false)
    this.setVelocity(0, 0)
    this.setCollideWorldBounds(false)
    // Importante: no colisiona mientras “carga”
    if (this.body) this.body.enable = false

    // Estado
    this._waiting = true
    // Solo rojo, anaranjado y amarillo
    this._palette = [0xdc2626, 0xf97316, 0xf59e0b, 0xfbbf24]
    this._colorIdx = 0

    // Parpadeo de colores mientras carga (bucle)
    this._blinkEvent = scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => this.setTint(this._palette[(this._colorIdx++) % this._palette.length]),
      callbackScope: this
    })

    // Cuenta atrás independiente: a los 2s lanza
    this._launchEvent = scene.time.delayedCall(this.delayMs, () => this.launch())

    // Vida máxima defensiva
    this._lifeEvent = scene.time.delayedCall(7000, () => this.destroy())
  }

  preUpdate(time, delta) {
    super.preUpdate?.(time, delta)
    // Mientras espera, seguir la cresta de la lava y quedarse quieto
    if (this._waiting && this.scene.lava) {
      this.y = this.scene.lava.y - 2
      this.setVelocity(0, 0)
      if (this.body && this.body.updateFromGameObject) this.body.updateFromGameObject()
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
    // Habilitar colisión al lanzar
    if (this.body) this.body.enable = true

    const px = this.scene.player.x
    const py = this.scene.player.y
    const dx = px - this.x
    const dy = py - this.y
    const len = Math.max(1e-3, Math.hypot(dx, dy))
    const vx = (dx / len) * this.speed
    const vy = (dy / len) * this.speed
    this.setVelocity(vx, vy)
  }

  destroy(fromScene) {
    this._blinkEvent?.remove(false)
    this._launchEvent?.remove(false)
    this._lifeEvent?.remove(false)
    super.destroy(fromScene)
}}
