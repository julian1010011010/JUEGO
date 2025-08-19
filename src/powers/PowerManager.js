import Phaser from 'phaser'
import gameConfig from '../config/gameConfig'

/** Gestiona poderes temporales del jugador (spawn, recogida, activación y expiración). */
export default class PowerManager {
  /** @param {Phaser.Scene & { player: any, platforms: any }} scene */
  constructor(scene) {
    this.scene = scene
    this.group = scene.physics.add.staticGroup()
    this.active = null // { key: string, until: number }
    this._bobTweens = new Set()
  this._blinkTween = null
  this.uiText = null

    this._ensureTextures()

    // Overlap jugador ↔ poder
    scene.physics.add.overlap(scene.player, this.group, (_player, item) => {
      if (!item || !item.active) return
      const key = item.powerKey
      item.destroy()
      if (key === 'noGravity') this.activateNoGravity()
    })
  }

  _ensureUi() {
    if (this.uiText && !this.uiText.destroyed) return
    const s = this.scene
    const w = s.scale.width, h = s.scale.height
    this.uiText = s.add.text(w * 0.5, h * 0.38, '', {
      fontFamily: 'monospace',
      fontSize: '96px',
      color: '#22c55e',
      stroke: '#0b1020',
      strokeThickness: 6
    })
      .setOrigin(0.5)
      .setScrollFactor(0, 0)
      // Profundidad baja para sensación de fondo pero visible sobre el clear color
      .setDepth(0)
      .setAlpha(0.25)
      .setVisible(false)
  }

  /** Genera texturas para poderes y para skin del jugador en poder. */
  _ensureTextures() {
    const s = this.scene
    if (!s.textures.exists('power_nograv')) {
      const g = s.make.graphics({ x: 0, y: 0, add: false })
      // Ícono: gota invertida brillante cyan
      g.fillStyle(0x00e5ff, 1)
      g.fillCircle(12, 10, 8)
      g.fillStyle(0x0ea5b7, 1)
      g.fillCircle(12, 10, 4)
      g.fillStyle(0xffffff, 0.7)
      g.fillCircle(9, 7, 2)
      g.generateTexture('power_nograv', 24, 24)
      g.destroy()
    }
    if (!s.textures.exists('player_nograv')) {
      const g = s.make.graphics({ x: 0, y: 0, add: false })
      // Jugador con halo azul
      g.fillStyle(0x7dd3fc, 1)
      g.fillRoundedRect(2, 2, 24, 24, 6)
      g.lineStyle(3, 0x22d3ee, 1)
      g.strokeRoundedRect(1, 1, 26, 26, 8)
      g.fillStyle(0x0b1020, 1)
      g.fillCircle(9, 11, 3)
      g.fillCircle(19, 11, 3)
      g.fillRect(9, 18, 10, 3)
      g.generateTexture('player_nograv', 28, 28)
      g.destroy()
    }
  }

  /** Llamar cuando se crea una plataforma para intentar spawnear un poder encima. */
  maybeSpawnAbovePlatform(plat) {
    const cfg = gameConfig?.powers
    if (!cfg?.enabled) return
    const chance = Number(cfg.spawnChancePerPlatform)
    if (!(chance > 0) || Math.random() > chance) return
    // Por ahora solo spawneamos el poder noGravity
    this.spawnNoGravityAbove(plat)
  }

  /** Crea un pickup de No-Gravity encima de una plataforma. */
  spawnNoGravityAbove(plat) {
    const yOffset = 22
    const x = plat.x
    const y = plat.y - (plat.displayHeight ?? 18) - yOffset
    const item = this.scene.physics.add.staticImage(x, y, 'power_nograv')
      .setDepth(5)
      .setScale(1)
    item.powerKey = 'noGravity'
    this.group.add(item)

    // Bob animation
    const t = this.scene.tweens.add({
      targets: item,
      y: y - 8,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.inOut'
    })
    this._bobTweens.add(t)
    item.once('destroy', () => { try { t.stop() } catch {}; this._bobTweens.delete(t) })

    // Seguir X/Y de la plataforma si se mueve (se refresca en tween onUpdate en PlatformFactory)
    plat.powerPickup = item
    plat.once('destroy', () => { if (item && item.active) item.destroy() })
    return item
  }

  /** Activa el poder de ingravidez por un tiempo configurado. */
  activateNoGravity() {
    const player = this.scene.player
    if (!player || !player.body) return

    const cfg = gameConfig?.powers?.noGravity || {}
    const duration = Math.max(200, Number(cfg.durationMs) || 5000)
    const now = this.scene.time.now

    // Si ya hay un poder igual, extender duración
    if (this.active?.key === 'noGravity') {
      this.active.until = now + duration
      this.active.warned = false
    } else {
  this.active = { key: 'noGravity', until: now + duration, duration, warned: false }
      // Cambiar diseño
      player._baseTextureKey = player.texture?.key
      if (this.scene.textures.exists('player_nograv')) player.setTexture('player_nograv')
      // Feedback visual
      player.setTint(0x22d3ee)
    }

  // Aplicar efectos inmediatos
    player.body.allowGravity = false
    // Opcional: cancelar velocidad hacia abajo instantánea
    if (player.body.velocity.y > 0) player.setVelocityY(0)

    // Ajustar lava durante el poder (acelerar subida si se configuró)
    const boost = Number(gameConfig?.powers?.noGravity?.lavaRiseBoost)
    if (isFinite(boost) && boost > 0) {
      const s = this.scene
      // Si ya hay boost previo (por otro poder), tomar el mayor
      s.lavaRiseBoost = Math.max(1, boost, s.lavaRiseBoost || 1)
    }

    // UI
    this._ensureUi()
    this.uiText.setVisible(true)
    // Re-centrar por si cambió el tamaño (modo responsive)
    try {
      const w = this.scene.scale.width, h = this.scene.scale.height
      this.uiText.setPosition(w * 0.5, h * 0.38)
    } catch {}
  }

  /** Llamar en update() de la escena para mantener y expirar poderes. */
  update() {
    if (!this.active) return
    const player = this.scene.player
    if (!player || !player.body) return

    if (this.active.key === 'noGravity') {
      const floatSpeed = Math.max(0, Number(gameConfig?.powers?.noGravity?.floatSpeed) || 60)
      // Mantener una subida suave
      if (player.body.velocity.y > -floatSpeed) player.setVelocityY(-floatSpeed)
    }

    // UI contador restante (fondo, grande, con gradiente verde→rojo)
    const remaining = Math.max(0, this.active.until - this.scene.time.now)
    if (this.uiText && !this.uiText.destroyed) {
      const secs = (remaining / 1000)
      // Mostrar solo número con 1 decimal
      this.uiText.setText(secs.toFixed(1))
      // Color: verde (#22c55e) → rojo (#ef4444)
      const total = Math.max(1, this.active.duration || 1000)
      const t = 1 - Math.min(1, Math.max(0, remaining / total))
      const from = Phaser.Display.Color.ValueToColor(0x22c55e)
      const to = Phaser.Display.Color.ValueToColor(0xef4444)
      const r = Math.round(from.red + (to.red - from.red) * t)
      const g = Math.round(from.green + (to.green - from.green) * t)
      const b = Math.round(from.blue + (to.blue - from.blue) * t)
      const css = Phaser.Display.Color.RGBToString(r, g, b, 0, '#')
      this.uiText.setColor(css)
      this.uiText.setVisible(true)
    }

    // Parpadeo rápido en los últimos ms configurables
    const warnMs = Math.max(0, Number(gameConfig?.powers?.warningMs) || 500)
    if (remaining <= warnMs) {
      if (!this.active.warned) {
        this.active.warned = true
        // Inicia tween de parpadeo rápido
        try { this._blinkTween?.stop() } catch {}
        player.setAlpha(1)
        this._blinkTween = this.scene.tweens.add({
          targets: player,
          alpha: { from: 1, to: 0.1 },
          duration: 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    } else if (this.active.warned) {
      // Si se extendió el poder, cancelar el parpadeo y resetear
      this.active.warned = false
      try { this._blinkTween?.stop() } catch {}
      this._blinkTween = null
      player.setAlpha(1)
    }

    if (this.scene.time.now >= this.active.until) {
      this.deactivate()
    }
  }

  /** Desactiva el poder activo y restaura estado/skin. */
  deactivate() {
    const player = this.scene.player
    if (player && player.body) {
      if (this.active?.key === 'noGravity') {
        player.body.allowGravity = true
      }
      // Restaurar diseño
      if (player._baseTextureKey && this.scene.textures.exists(player._baseTextureKey)) {
        player.setTexture(player._baseTextureKey)
      }
      player.clearTint()
      try { this._blinkTween?.stop() } catch {}
      this._blinkTween = null
      player.setAlpha(1)
    }
    this.active = null
  // Restaurar boost de lava
  if (this.scene) this.scene.lavaRiseBoost = 1
    if (this.uiText && !this.uiText.destroyed) {
      this.uiText.setVisible(false)
      this.uiText.setText('')
    }
  }
}
