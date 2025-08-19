import Phaser from 'phaser'
import gameConfig from '../config/gameConfig'

/** Gestiona poderes temporales del jugador (spawn, recogida, activación y expiración). */
export default class PowerManager {
  /** @param {Phaser.Scene & { player: any, platforms: any }} scene */
  constructor(scene) {
    this.scene = scene
  this.group = scene.physics.add.staticGroup()
  // Poderes activos simultáneos: { noGravity?: {until,duration,warned}, freezeLava?: {until,duration,warned} }
  this.powers = {}
    this._bobTweens = new Set()
  this._blinkTween = null
  this.uiText = null
  this._pulseTween = null

    this._ensureTextures()

    // Overlap jugador ↔ poder
    scene.physics.add.overlap(scene.player, this.group, (_player, item) => {
      if (!item || !item.active) return
      const key = item.powerKey
      item.destroy()
      if (key === 'noGravity') this.activateNoGravity()
      else if (key === 'freezeLava') this.activateFreezeLava()
    })
  }

  _ensureUi() {
    if (this.uiText && !this.uiText.destroyed) return
    const s = this.scene
    const w = s.scale.width, h = s.scale.height
    this.uiText = s.add.text(w * 0.5, h * 0.38, '', {
      fontFamily: 'monospace',
      fontSize: '112px',
      color: '#39ff14',
      stroke: '#0b1020',
      strokeThickness: 8
    })
      .setOrigin(0.5)
      .setScrollFactor(0, 0)
      // Profundidad baja para sensación de fondo pero visible sobre el clear color
      .setDepth(0)
      .setAlpha(0.4)
      .setScale(1)
      .setShadow(0, 0, 'rgba(0,0,0,0.35)', 12, true, true)
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
    if (!s.textures.exists('power_freeze')) {
      const g = s.make.graphics({ x: 0, y: 0, add: false })
      // Copo de nieve simple azul
      g.fillStyle(0x7dd3fc, 1)
      g.fillCircle(12, 12, 5)
      g.lineStyle(3, 0x38bdf8, 1)
      g.beginPath()
      g.moveTo(12, 2); g.lineTo(12, 22)
      g.moveTo(2, 12); g.lineTo(22, 12)
      g.moveTo(5, 5); g.lineTo(19, 19)
      g.moveTo(19, 5); g.lineTo(5, 19)
      g.strokePath()
      g.generateTexture('power_freeze', 24, 24)
      g.destroy()
    }
  }

  /** Llamar cuando se crea una plataforma para intentar spawnear un poder encima. */
  maybeSpawnAbovePlatform(plat) {
    const cfg = gameConfig?.powers
    if (!cfg?.enabled) return
    const chance = Number(cfg.spawnChancePerPlatform)
    if (!(chance > 0) || Math.random() > chance) return
    // Elegir poder según pesos (por defecto 50/50)
    const weights = cfg.weights || { noGravity: 1, freezeLava: 1 }
    const entries = [
      ['noGravity', Math.max(0, Number(weights.noGravity) || 0)],
      ['freezeLava', Math.max(0, Number(weights.freezeLava) || 0)]
    ].filter(([, w]) => w > 0)
    let total = entries.reduce((a, [, w]) => a + w, 0)
    if (total <= 0) return this.spawnNoGravityAbove(plat)
    let r = Math.random() * total
    const pick = entries.find(([, w]) => (r -= w) <= 0)?.[0] || 'noGravity'
    if (pick === 'freezeLava') this.spawnFreezeAbove(plat)
    else this.spawnNoGravityAbove(plat)
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

  /** Crea un pickup de Congelar Lava encima de una plataforma. */
  spawnFreezeAbove(plat) {
    const yOffset = 22
    const x = plat.x
    const y = plat.y - (plat.displayHeight ?? 18) - yOffset
    const item = this.scene.physics.add.staticImage(x, y, 'power_freeze')
      .setDepth(5)
      .setScale(1)
    item.powerKey = 'freezeLava'
    this.group.add(item)

    const t = this.scene.tweens.add({ targets: item, y: y - 8, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' })
    this._bobTweens.add(t)
    item.once('destroy', () => { try { t.stop() } catch {}; this._bobTweens.delete(t) })
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

    // Registrar/Extender
    if (!this.powers.noGravity) this.powers.noGravity = { until: now + duration, duration, warned: false }
    else { this.powers.noGravity.until = now + duration; this.powers.noGravity.duration = duration; this.powers.noGravity.warned = false }
    // Cambiar diseño (una sola vez)
    if (!player._baseTextureKey) {
      player._baseTextureKey = player.texture?.key
      if (this.scene.textures.exists('player_nograv')) player.setTexture('player_nograv')
    }
    // Feedback visual
    player.setTint(0x22d3ee)

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

  /** Congela la lava y los misiles por un tiempo configurado. */
  activateFreezeLava() {
    const s = this.scene
    const cfg = gameConfig?.powers?.freezeLava || {}
    const duration = Math.max(200, Number(cfg.durationMs) || 5000)
    const now = s.time.now

    if (!this.powers.freezeLava) this.powers.freezeLava = { until: now + duration, duration, warned: false }
    else { this.powers.freezeLava.until = now + duration; this.powers.freezeLava.duration = duration; this.powers.freezeLava.warned = false }
    // Visual lava congelada (una vez)
    try {
      if (!s._lavaFrozenVisual) {
        const tint = (typeof cfg.tint === 'number') ? cfg.tint : 0x7dd3fc
        s.lava?.setTint?.(tint)
        s.lavaFlames && (s.lavaFlames.visible = false)
        s.lavaRocks && (s.lavaRocks.visible = false)
        s._lavaFrozenVisual = true
      }
    } catch {}

    // Aplicar congelación
    s.lavaFrozenUntil = now + duration
    // Pausar spawner de misiles
    try { if (s._lavaMissileTimer) s._lavaMissileTimer.paused = true } catch {}
    // Congelar misiles existentes
    try {
      const items = s.lavaMissiles?.getChildren?.() || []
      for (const m of items) { if (m?.setFrozen) m.setFrozen(true) }
    } catch {}

    // UI
    this._ensureUi()
    this.uiText.setVisible(true)
    try { const w = s.scale.width, h = s.scale.height; this.uiText.setPosition(w * 0.5, h * 0.38) } catch {}
  }

  /** Llamar en update() de la escena para mantener y expirar poderes. */
  update() {
    const player = this.scene.player
    if (!player || !player.body) return
    const now = this.scene.time.now

    const ng = this.powers.noGravity
    const fr = this.powers.freezeLava
    if (!ng && !fr) {
      if (this.uiText && !this.uiText.destroyed) {
        this.uiText.setVisible(false)
        this.uiText.setText('')
      }
      if (this._pulseTween) { try { this._pulseTween.stop() } catch {}; this._pulseTween = null }
      return
    }

    // noGravity: mantener subida suave mientras dure
    if (ng && now < ng.until) {
      const floatSpeed = Math.max(0, Number(gameConfig?.powers?.noGravity?.floatSpeed) || 60)
      if (player.body.velocity.y > -floatSpeed) player.setVelocityY(-floatSpeed)
    }

    // UI: elegir el poder que vence antes
    let activeRec = null
    if (ng) activeRec = ng
    if (fr && (!activeRec || fr.until < activeRec.until)) activeRec = fr
    const remaining = Math.max(0, activeRec.until - now)
    if (this.uiText && !this.uiText.destroyed) {
      const secs = (remaining / 1000)
      this.uiText.setText(secs.toFixed(1))
      const total = Math.max(1, activeRec.duration || 1000)
      const p = 1 - Math.min(1, Math.max(0, remaining / total))
      const c1 = Phaser.Display.Color.ValueToColor(0x39ff14)
      const c2 = Phaser.Display.Color.ValueToColor(0xffea00)
      const c3 = Phaser.Display.Color.ValueToColor(0xff1744)
      let r, g, b
      if (p < 0.5) {
        const t = p / 0.5
        r = Math.round(c1.red + (c2.red - c1.red) * t)
        g = Math.round(c1.green + (c2.green - c1.green) * t)
        b = Math.round(c1.blue + (c2.blue - c1.blue) * t)
      } else {
        const t = (p - 0.5) / 0.5
        r = Math.round(c2.red + (c3.red - c2.red) * t)
        g = Math.round(c2.green + (c3.green - c2.green) * t)
        b = Math.round(c2.blue + (c3.blue - c2.blue) * t)
      }
      const css = Phaser.Display.Color.RGBToString(r, g, b, 0, '#')
      this.uiText.setColor(css)
      this.uiText.setVisible(true)
    }

    // Parpadeo de jugador cerca de expirar NO-GRAVITY
    const warnMs = Math.max(0, Number(gameConfig?.powers?.warningMs) || 500)
    if (ng && (ng.until - now) <= warnMs) {
      if (!ng.warned) {
        ng.warned = true
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
    } else if (ng && ng.warned && now < (ng.until - warnMs)) {
      ng.warned = false
      try { this._blinkTween?.stop() } catch {}
      this._blinkTween = null
      player.setAlpha(1)
    }

    // Pulso (zoom) en el último segundo del temporizador mostrado
    const pulseMs = 1000
    if (remaining <= pulseMs) {
      if (!this._pulseTween && this.uiText && !this.uiText.destroyed) {
        try { this._pulseTween?.stop() } catch {}
        this.uiText.setScale(1)
        this._pulseTween = this.scene.tweens.add({
          targets: this.uiText,
          scale: { from: 1.0, to: 1.3 },
          duration: 140,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    } else if (this._pulseTween) {
      try { this._pulseTween.stop() } catch {}
      this._pulseTween = null
      if (this.uiText && !this.uiText.destroyed) this.uiText.setScale(1)
    }

    // Expiraciones independientes
    if (ng && now >= ng.until) this._endNoGravity()
    if (fr && now >= fr.until) this._endFreezeLava()
  }

  /** Desactiva el poder activo y restaura estado/skin. */
  deactivate() {
    // Terminar todos los poderes activos
    if (this.powers.noGravity) this._endNoGravity()
    if (this.powers.freezeLava) this._endFreezeLava()
    this.powers = {}
    if (this.scene) this.scene.lavaRiseBoost = 1
    if (this.uiText && !this.uiText.destroyed) { this.uiText.setVisible(false); this.uiText.setText('') }
  }

  _endNoGravity() {
    const s = this.scene
    const player = s.player
    if (!this.powers.noGravity) return
    delete this.powers.noGravity
    if (player && player.body) {
      player.body.allowGravity = true
      if (player._baseTextureKey && s.textures.exists(player._baseTextureKey)) {
        player.setTexture(player._baseTextureKey)
        player._baseTextureKey = null
      }
      player.clearTint()
      try { this._blinkTween?.stop() } catch {}
      this._blinkTween = null
      player.setAlpha(1)
    }
    if (!this.powers.noGravity && s) s.lavaRiseBoost = 1
  }

  _endFreezeLava() {
    const s = this.scene
    if (!this.powers.freezeLava) return
    delete this.powers.freezeLava
    s.lavaFrozenUntil = 0
    try {
      s.lava?.clearTint?.()
      s.lavaFlames && (s.lavaFlames.visible = true)
      s.lavaRocks && (s.lavaRocks.visible = true)
      if (s._lavaMissileTimer) s._lavaMissileTimer.paused = false
      const items = s.lavaMissiles?.getChildren?.() || []
      for (const m of items) { if (m?.setFrozen) m.setFrozen(false) }
      s._lavaFrozenVisual = false
    } catch {}
  }
}
