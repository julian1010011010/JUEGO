import Phaser from 'phaser'

export default class LavaParticle extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, opts = {}) {
    if (!scene.textures.exists('px')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 1, 1)
      g.generateTexture('px', 1, 1); g.destroy()
    }

    super(scene, x, y, 'px')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.delayMs = opts.delay ?? 2000
    this.speed   = opts.speed ?? 420
    this.useCircleCollider =  false;

    const s = opts.size ?? 8
    this.size = typeof s === 'number'
      ? Math.max(1, Math.round(s))
      : Phaser.Math.Between(Math.max(1, Math.round(s.min ?? 1)), Math.max(1, Math.round(s.max ?? s.min ?? 1)))

    // Apariencia / físicas
    this.setDepth(2).setOrigin(0.5, 0.5)
    this.setBlendMode(Phaser.BlendModes.ADD)
    this.setActive(true).setVisible(true)
    this.body.setAllowGravity(false)
    this.setCollideWorldBounds(false)
    this.setVelocity(0, 0)
    this.body.enable = false // espera “carga”

    // Estado
    this._waiting = true
    this._palette = [0xdc2626, 0xf97316, 0xf59e0b, 0xfbbf24]
    this._colorIdx = 0

    // Visual + collider (una sola vez aquí)
    this.syncCollider()

    // FX y timers
    this._blinkEvent = scene.time.addEvent({
      delay: 80, loop: true,
      callback: () => this.setTint(this._palette[(this._colorIdx++) % this._palette.length])
    })
    this._launchEvent = scene.time.delayedCall(this.delayMs, () => this.launch())
    this._lifeEvent   = scene.time.delayedCall(7000, () => this.destroy())
  }

preUpdate(time, delta) {
  super.preUpdate?.(time, delta);
  if (this._waiting && this.scene.lava) {
    this.y = this.scene.lava.y - 2;
    this.setVelocity(0, 0);
    // ❌ no llamar updateFromGameObject aquí
  }
}
debugDrawBodyOnce() {
  if (!this.body) return;
  const g = this.scene.add.graphics().setDepth(10000);
  g.lineStyle(2, 0x3b82f6, 1);
  g.strokeRect(this.body.left, this.body.top, this.body.width, this.body.height);
  // auto-destruir a los 600 ms
  this.scene.time.delayedCall(600, () => g.destroy());
}

  launch() {
    if (!this.scene || !this.scene.player) { this.destroy(); return }
    this._waiting = false
    this._blinkEvent?.remove(false)
    this.clearTint()
    this.setAlpha(1)
    this.body.setAllowGravity(false)
    this.body.enable = true

    // Asegura collider correcto justo antes de moverse
    this.syncCollider()

    const { x: px, y: py } = this.scene.player
    const dx = px - this.x, dy = py - this.y
    const len = Math.max(1e-3, Math.hypot(dx, dy))
    this.setVelocity((dx / len) * this.speed, (dy / len) * this.speed)

 
  }

syncCollider() {
  if (!this.body) return;

  // Visual = tamaño lógico en pantalla
  this.setDisplaySize(this.size, this.size);

  // Evita doble escalado del body: divide por la escala actual (Arcade multiplica por scaleX/Y)
  const sx = this.scaleX || 1;
  const sy = this.scaleY || 1;
  const bw = Math.max(1, Math.round(this.size / sx));
  const bh = Math.max(1, Math.round(this.size / sy));
  this.body.setSize(bw, bh, true);

  // Si activas collider circular en el futuro, usa:
  // const r = Math.max(1, Math.round((this.size / 2) / sx));
  // this.body.setCircle(r, -r + this.width * this.originX, -r + this.height * this.originY);
}


  destroy(fromScene) {
    this._blinkEvent?.remove(false)
    this._launchEvent?.remove(false)
    this._lifeEvent?.remove(false)
    super.destroy(fromScene)
  }
}
