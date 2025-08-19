import Phaser from 'phaser'
import PlatformFactory from '../platforms/PlatformFactory'

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game')

    // Entidades y estado base
    this.player = null
    this.platforms = null
    this.cursors = null
    this.score = 0
    this.best = Number(localStorage.getItem('best_score') || 0)

    // Salto / contacto suelo
    this.lastGroundTime = 0
    this.currentPlatform = null

    // Lava (visual) y muerte
    this.lavaHeight = 56
    this.lavaRiseSpeed = 120
    this.lavaOffset = 0
    this.lavaKillMargin = 3

    // Plataformas escurridizas (que se mueven al intentar alcanzarlas)
    this.dodgerDx = 80
    this.dodgerMinDy = 30
    this.dodgerMaxDy = 160
    this.dodgerCooldown = 700

    // Estados de juego / animaciones
    this.hasAscended = false
    this._playedLavaAnim = false
    this._ended = false
    // Ventana temporal de resbalón cuando pisas hielo
    this._onIceUntil = 0
  }

  preload() {
    this.createTextures()
  }

  create() {
    const width = this.scale.width
    const height = this.scale.height

    // Fondo gradiente
    const g = this.add.graphics()
    const top = 0x0f1020
    const bottom = 0x0a0a14
    const steps = 10
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(top),
        Phaser.Display.Color.ValueToColor(bottom),
        steps - 1,
        i
      )
      const hex = Phaser.Display.Color.GetColor(color.r, color.g, color.b)
      g.fillStyle(hex, 1)
      g.fillRect(0, (height / steps) * i, width, height / steps)
    }

    // Grupo de plataformas y fábrica
    this.platforms = this.physics.add.staticGroup()
    this.platformFactory = new PlatformFactory(this)

    // Crear plataformas iniciales
    const startY = height - 50
    for (let i = 0; i < 12; i++) {
      this.platformFactory.spawn(Phaser.Math.Between(60, width - 60), startY - i * 70)
    }
    // Plataforma base bajo el jugador
    this.basePlatform = this.platformFactory.spawn(width / 2, height - 60)

    // Jugador
    this.player = this.physics.add.sprite(width / 2, height - 120, 'player')
    this.player.setBounce(0.05)
    this.player.setCollideWorldBounds(false)
    this.player.body.setSize(24, 28)

    // Colisiones jugador <-> plataformas
    this.physics.add.collider(this.player, this.platforms, (player, plat) => {
      if (!plat || !plat.body) return
      const pb = player.body
      const sb = plat.body
      const landing = pb.velocity.y >= 0 && pb.bottom <= sb.top + 8
      if (landing || pb.touching.down || pb.blocked.down) {
        this.lastGroundTime = this.time.now
        this.currentPlatform = plat

        // Temporizadas: cuentan 2s si sigues encima
        if (plat.isTimed && !plat._timing) {
          plat._timing = true
          plat._timer = this.time.delayedCall(2000, () => {
            if (plat && plat.active && this.currentPlatform === plat) {
              this.tweens.killTweensOf(plat)
              plat.destroy()
            }
            if (plat) {
              plat._timing = false
              plat._timer = null
            }
          })
        }

        // Hielo: activa ventana de resbalón
        if (plat.isIce) this._onIceUntil = this.time.now + 350
      }
    })

    // Entrada: cursores + Space y táctil
    this.cursors = this.input.keyboard.createCursorKeys()
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.jumpKeyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this.jumpKeyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.W
    ])
    this.setupTouchControls()

    // Cámara: solo sube (sin seguir hacia abajo)
    this.cameras.main.stopFollow()
    this._cameraMinY = this.cameras.main.scrollY

    // Lava visual (la muerte se decide con borde inferior de cámara)
    const lavaY = height - this.lavaHeight
    this.lava = this.add.tileSprite(0, lavaY, width, this.lavaHeight, 'lava')
      .setOrigin(0, 0)
      .setDepth(1)

    // UI DOM
    this.scoreText = document.getElementById('score')
    this.timerEl = document.getElementById('timer')
    this.overlay = document.getElementById('overlay')
    this.finalText = document.getElementById('final')
    if (this.overlay) this.overlay.style.display = 'none'
    const restartBtn = document.getElementById('restart')
    if (restartBtn) {
      restartBtn.onclick = () => {
        if (this.overlay) this.overlay.style.display = 'none'
        this.scene.restart()
      }
    }

    // Gracia inicial
    this.canLose = false
    this.time.delayedCall(800, () => (this.canLose = true))

    // Inicializa estado de cruce de plataformas
    this.platforms.children.iterate(plat => {
      if (!plat) return
      plat.lastState = (this.player.y < plat.y - 8) ? 'above' : 'below'
    })

    // Cronómetro
    this.startTime = this.time.now
  }

  update() {
    const width = this.scale.width
    const height = this.scale.height

    const speed = 220
    const onIce = this.time.now <= this._onIceUntil

    // Movimiento horizontal (con efecto hielo)
    if (onIce) {
      this.player.setDragX(60)
      let vx = this.player.body.velocity.x
      if (this.cursors.left.isDown || this.leftPressed) vx = Phaser.Math.Clamp(vx - 24, -speed, speed)
      else if (this.cursors.right.isDown || this.rightPressed) vx = Phaser.Math.Clamp(vx + 24, -speed, speed)
      this.player.setVelocityX(vx)
      this.player.setFlipX(vx < 0)
    } else {
      this.player.setDragX(0)
      if (this.cursors.left.isDown || this.leftPressed) {
        this.player.setVelocityX(-speed)
        this.player.setFlipX(true)
      } else if (this.cursors.right.isDown || this.rightPressed) {
        this.player.setVelocityX(speed)
        this.player.setFlipX(false)
      } else {
        this.player.setVelocityX(0)
      }
    }

    // Salto manual con coyote
    const grounded = this.player.body.touching.down || this.player.body.blocked.down
    const canCoyote = this.time.now - this.lastGroundTime <= 200
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.jumpKey) ||
                       Phaser.Input.Keyboard.JustDown(this.jumpKeyUp) ||
                       Phaser.Input.Keyboard.JustDown(this.jumpKeyW) ||
                       Phaser.Input.Keyboard.JustDown(this.cursors.up)
    if (jumpPressed && (grounded || canCoyote)) {
      // Reubicar la mejor plataforma escurridiza si va a ser alcanzada
      const candidates = this.platforms.getChildren().filter(p => p && p.isDodger)
      let best = null
      let bestDy = Infinity
      for (const p of candidates) {
        const dx = Math.abs(p.x - this.player.x)
        const dy = p.y - this.player.y
        const canDodge = dx <= this.dodgerDx && dy >= this.dodgerMinDy && dy <= this.dodgerMaxDy
        const cooldownOk = !p._lastDodgeTime || (this.time.now - p._lastDodgeTime) > this.dodgerCooldown
        if (canDodge && cooldownOk && dy < bestDy) { best = p; bestDy = dy }
      }
      if (best) this.relocateDodger(best)

      this.player.setVelocityY(-520)

        // Destruir la plataforma base en el primer salto
        if (this.basePlatform && this.basePlatform.active) {
          this.basePlatform.destroy();
          this.basePlatform = null;
        }
      // Rompe frágil al despegar
      if (this.currentPlatform && this.currentPlatform.isFragile && !this.currentPlatform._broken) {
        this.currentPlatform._broken = true
        this.time.delayedCall(60, () => {
          if (this.currentPlatform && this.currentPlatform.active) this.currentPlatform.destroy()
        })
      }
      this.currentPlatform = null
    }

    // Wrap horizontal
    if (this.player.x < -16) this.player.x = width + 16
    if (this.player.x > width + 16) this.player.x = -16

    // Generación y limpieza de plataformas
    const camY = this.cameras.main.worldView.y
    this.platforms.children.iterate(plat => {
      if (!plat) return
      // Cancela temporizador al dejar temporizada
      if (plat.isTimed && plat._timing && this.currentPlatform !== plat) {
        if (plat._timer) { plat._timer.remove(false); plat._timer = null }
        plat._timing = false
      }
      if (plat.y > camY + height + 60) {
        this.tweens.killTweensOf(plat)
        plat.destroy()
      }
    })
    while (this.platforms.getChildren().length < 14) {
      const topY = this.getTopPlatformY()
      const newY = topY - Phaser.Math.Between(60, 100)
      const newX = Phaser.Math.Between(60, width - 60)
      this.platformFactory.spawn(newX, newY)
    }

    // Reubicación escurridizas al aproximarse en ascenso
    if (this.player.body.velocity.y < -50) {
      this.platforms.children.iterate(plat => {
        if (!plat || !plat.isDodger) return
        const dx = Math.abs(plat.x - this.player.x)
        const dy = plat.y - this.player.y
        const cooldownOk = !plat._lastDodgeTime || (this.time.now - plat._lastDodgeTime) > this.dodgerCooldown
        if (dx <= this.dodgerDx && dy >= this.dodgerMinDy && dy <= this.dodgerMaxDy && cooldownOk) this.relocateDodger(plat)
      })
    }

    // Scoring por cruce de plataformas
    this.platforms.children.iterate(plat => {
      if (!plat) return
      if (plat.lastState === undefined) plat.lastState = (this.player.y < plat.y - 8) ? 'above' : 'below'
      const aboveNow = this.player.y < plat.y - 8
      const belowNow = this.player.y > plat.y + 8
      if (aboveNow && plat.lastState === 'below') {
        this.score += 1
        plat.lastState = 'above'
        if (this.score > this.best) this.best = this.score
      } else if (belowNow && plat.lastState === 'above') {
        this.score = Math.max(0, this.score - 1)
        plat.lastState = 'below'
      }
    })

    // HUD
    if (this.scoreText) this.scoreText.textContent = `Puntos: ${this.score} (Récord: ${this.best})`
    if (this.timerEl) {
      const secs = Math.floor((this.time.now - this.startTime) / 1000)
      const mm = String(Math.floor(secs / 60)).padStart(2, '0')
      const ss = String(secs % 60).padStart(2, '0')
      this.timerEl.textContent = `${mm}:${ss}`
    }

    // Lava (visual) sube con la cámara, no baja
    if (this.lava) {
      const targetY = this.cameras.main.scrollY + height - this.lavaHeight - this.lavaOffset
      const currentY = this.lava.y
      if (targetY < currentY) {
        const maxStep = (this.lavaRiseSpeed * this.game.loop.delta) / 1000
        this.lava.y = Math.max(targetY, currentY - maxStep)
      }
      this.lava.tilePositionX += 0.4
    }

    // Muerte por lava: usa borde inferior visible de la cámara
    if (!this._ended && this.canLose && this.player && this.player.body) {
      const worldLavaTop = this.cameras.main.scrollY + height - this.lavaHeight - this.lavaOffset
      const playerBottom = this.player.body.bottom
      if (playerBottom >= worldLavaTop - this.lavaKillMargin) this.gameOver('lava')
    }

    // Cámara solo-subida
    const desired = this.player.y - height * 0.5
    this._cameraMinY = Math.min(this._cameraMinY, desired)
    this.cameras.main.scrollY = Math.min(this.cameras.main.scrollY, this._cameraMinY)
    if (!this.hasAscended && this.cameras.main.scrollY < -20) this.hasAscended = true

    // Game over por borde inferior de cámara
    const cameraBottom = this.cameras.main.scrollY + height
    const playerBottomEdge = this.player.body ? this.player.body.bottom : this.player.y
    if (this.canLose && playerBottomEdge >= cameraBottom - 6) this.gameOver('fall')
  }

  relocateDodger(plat) {
    const width = this.scale.width
    let newX
    let attempts = 0
    do {
      newX = Phaser.Math.Between(60, width - 60)
      attempts++
    } while (Math.abs(newX - plat.x) < 100 && attempts < 8)
    plat.x = newX
    if (plat.body && plat.body.updateFromGameObject) plat.body.updateFromGameObject()
    plat._lastDodgeTime = this.time.now
    this.tweens.add({ targets: plat, alpha: { from: 0.4, to: 1 }, duration: 150, ease: 'Quad.out' })
  }

  getTopPlatformY() {
    let minY = Infinity
    this.platforms.children.iterate(plat => { if (plat && plat.y < minY) minY = plat.y })
    if (!isFinite(minY)) return this.cameras.main.worldView.y + this.scale.height - 50
    return minY
  }

  gameOver(cause) {
    if (this._ended) return
    this._ended = true
    this.physics.pause()
    this.best = Math.max(this.best, this.score)
    localStorage.setItem('best_score', String(this.best))

    const showOverlay = () => {
      if (this.finalText) this.finalText.textContent = `Puntos: ${this.score} — Récord: ${this.best}`
      if (this.overlay) this.overlay.style.display = 'flex'
    }

    if (cause === 'lava' && this.hasAscended && !this._playedLavaAnim) {
      this._playedLavaAnim = true
      if (this.player) this.player.setVisible(false)
      this.playTerminatorThumb()
      this.time.delayedCall(1200, showOverlay)
    } else {
      showOverlay()
    }
  }

  playTerminatorThumb() {
    const width = this.scale.width
    if (!this.lava) return
    const hand = this.add.image(this.player ? this.player.x : width / 2, this.lava.y - 6, 'thumb_up')
      .setOrigin(0.5, 1)
      .setDepth(2)
      .setAngle(-10)
      .setAlpha(1)
      .setScale(1)

    if (this.tweens.createTimeline) {
      const tl = this.tweens.createTimeline()
      tl.add({ targets: hand, y: hand.y - 6, duration: 160, ease: 'Sine.out' })
      tl.add({ targets: hand, y: hand.y + 46, angle: -25, alpha: 0.85, duration: 520, ease: 'Sine.in' })
      tl.add({ targets: hand, y: hand.y + 62, angle: -35, alpha: 0, duration: 420, ease: 'Quad.in', onComplete: () => hand.destroy() })
      tl.play()
    } else {
      // Fallback encadenado
      this.tweens.add({
        targets: hand,
        y: hand.y - 6,
        duration: 160,
        ease: 'Sine.out',
        onComplete: () => {
          this.tweens.add({
            targets: hand,
            y: hand.y + 46,
            angle: -25,
            alpha: 0.85,
            duration: 520,
            ease: 'Sine.in',
            onComplete: () => {
              this.tweens.add({
                targets: hand,
                y: hand.y + 62,
                angle: -35,
                alpha: 0,
                duration: 420,
                ease: 'Quad.in',
                onComplete: () => hand.destroy()
              })
            }
          })
        }
      })
    }
  }

  setupTouchControls() {
    this.leftPressed = false
    this.rightPressed = false
    const leftZone = this.add.zone(0, 0, this.scale.width / 2, this.scale.height).setOrigin(0)
    const rightZone = this.add.zone(this.scale.width / 2, 0, this.scale.width / 2, this.scale.height).setOrigin(0)
    leftZone.setInteractive({ useHandCursor: true })
    rightZone.setInteractive({ useHandCursor: true })
    leftZone.on('pointerdown', () => (this.leftPressed = true))
    leftZone.on('pointerup', () => (this.leftPressed = false))
    leftZone.on('pointerout', () => (this.leftPressed = false))
    rightZone.on('pointerdown', () => (this.rightPressed = true))
    rightZone.on('pointerup', () => (this.rightPressed = false))
    rightZone.on('pointerout', () => (this.rightPressed = false))
  }

  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    // Jugador
    g.fillStyle(0x7dd3fc, 1)
    g.fillRoundedRect(0, 0, 28, 28, 6)
    g.fillStyle(0x0b1020, 1)
    g.fillCircle(9, 11, 3)
    g.fillCircle(19, 11, 3)
    g.fillRect(9, 18, 10, 3)
    g.generateTexture('player', 28, 28)

    // Plataforma
    g.clear()
    g.fillStyle(0x93c5fd, 1)
    g.fillRoundedRect(0, 0, 90, 18, 8)
    g.lineStyle(2, 0x1e293b, 0.3)
    g.strokeRoundedRect(1, 1, 88, 16, 8)
    g.generateTexture('platform', 90, 18)

    // Lava tile (64x32)
    g.clear()
    const w = 64, h = 32
    g.fillStyle(0xdc2626, 1)
    g.fillRect(0, 0, w, h)
    g.fillStyle(0x991b1b, 1)
    for (let y = 4; y < h; y += 8) g.fillRect(0, y, w, 3)
    g.fillStyle(0xf59e0b, 1)
    for (let i = 0; i < 6; i++) g.fillCircle(Phaser.Math.Between(4, w - 4), Phaser.Math.Between(4, h - 4), Phaser.Math.Between(2, 4))
    g.generateTexture('lava', w, h)

    // Pulgar arriba (simple)
    g.clear()
    const hw = 28, hh = 40
    g.fillStyle(0xffe0b2, 1)
    g.fillRoundedRect(10, 18, 12, 18, 6) // palma
    g.save()
    g.translateCanvas(16, 18)
    g.rotateCanvas(-0.6)
    g.fillRoundedRect(0, -10, 10, 14, 5) // pulgar
    g.restore()
    g.fillRoundedRect(6, 10, 18, 6, 3)
    g.fillRoundedRect(6, 6, 16, 5, 2)
    g.fillRoundedRect(6, 3, 14, 4, 2)
    g.lineStyle(2, 0x8c6239, 0.4)
    g.strokeRoundedRect(10, 18, 12, 18, 6)
    g.generateTexture('thumb_up', hw, hh)
  }
}
 
