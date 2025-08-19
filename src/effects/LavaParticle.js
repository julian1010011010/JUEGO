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
    // Memoriza la última dirección para cuando la vel sea casi 0
    this._lastAngle = 0

    // NUEVO: config de estela (más notoria y parametrizable)
    this._trailInterval  = opts.trailInterval  ?? 18
    this._trailLife      = opts.trailLife      ?? 500
    this._lastTrailAt    = 0
    this._trailAlpha     = opts.trailAlpha     ?? 1.0
    this._trailStretch   = opts.trailStretch   ?? 3.0   // largo relativo a this.size
    this._trailThickness = opts.trailThickness ?? 0.6   // grosor relativo a this.size
    this._trailDecayEase = opts.trailDecayEase ?? 'Expo.easeOut'

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
    } else {
      // NUEVO: estela tipo cometa mientras está en vuelo
      if (time - this._lastTrailAt >= this._trailInterval) {
        this._lastTrailAt = time;
        this.spawnTrail();
      }
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
    // Acelera el parpadeo tras el lanzamiento
    this._blinkEvent?.remove(false)
    this._blinkEvent = this.scene.time.addEvent({
      delay: 30, loop: true,
      callback: () => this.setTint(this._palette[(this._colorIdx++) % this._palette.length])
    })
    // No limpiar el tinte para mantener el efecto de parpadeo
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

  // NUEVO: genera una estela que se encoge y desvanece, anclada detrás
  spawnTrail() {
    const vx = this.body?.velocity.x ?? 0
    const vy = this.body?.velocity.y ?? 0

    // Usa el ángulo actual o el último válido si no hay velocidad
    let ang = (Math.abs(vx) + Math.abs(vy)) > 0.01
      ? Phaser.Math.RadToDeg(Math.atan2(vy, vx))
      : this._lastAngle
    this._lastAngle = ang
    const rad = Phaser.Math.DegToRad(ang)

    const baseW = Math.max(2, this.size * this._trailStretch)
    const baseH = Math.max(1, this.size * this._trailThickness)

    // Offset hacia atrás para no tapar la partícula
    const backOffset = Math.max(2, baseW * 0.15)
    const ox = Math.cos(rad) * -backOffset
    const oy = Math.sin(rad) * -backOffset

    // Capa de brillo (glow) — anclada al borde “frontal”, extendida hacia atrás
    const glow = this.scene.add.image(this.x + ox, this.y + oy, 'px')
      .setOrigin(1, 0.5) // el borde anclado queda en la posición de la partícula
      .setDepth(this.depth - 2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(Math.min(1, this._trailAlpha * 0.7))
      .setTint(0xffa227) // naranja brillante
    glow.setDisplaySize(baseW, baseH * 1.25)
    glow.setAngle(ang)

    // Núcleo más intenso — también anclado atrás
    const core = this.scene.add.image(this.x + ox, this.y + oy, 'px')
      .setOrigin(1, 0.5)
      .setDepth(this.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(this._trailAlpha)
      .setTint(0xffffff) // highlight
    core.setDisplaySize(baseW * 0.85, baseH * 0.7)
    core.setAngle(ang)

    this.scene.tweens.add({
      targets: [glow, core],
      alpha: 0,
      displayWidth: 0,
      displayHeight: 0,
      duration: this._trailLife,
      ease: this._trailDecayEase,
      onComplete: (_tween, targets) => targets.forEach(t => t.destroy())
    })
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
