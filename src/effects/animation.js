import Phaser from 'phaser'

/**
 * Animación de impacto para el personaje (lava o misil).
 * Secuencia con Timeline de Phaser:
 * 1) Tinte rojo inmediato.
 * 2) Rebotes caóticos por la pantalla (gira, sacude, salta).
 * 3) Entra en zoom al centro de la cámara (escala grande).
 * 4) Termina cambiando a ojos "X" y cuerpo negro.
 */
export default class animation {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene
    this._ensureDeadTexture()
  }

  // Asegura una textura de "muerto" (cuerpo negro + ojos en X)
  _ensureDeadTexture() {
    const s = this.scene
    if (s.textures.exists('player_dead')) return
    const g = s.make.graphics({ x: 0, y: 0, add: false })
    // Cuerpo negro
    g.fillStyle(0x000000, 1)
    g.fillRoundedRect(0, 0, 28, 28, 6)
    // Ojos en X (líneas blancas)
    g.lineStyle(3, 0xffffff, 1)
    // Ojo izquierdo
    g.beginPath(); g.moveTo(6, 8); g.lineTo(12, 14); g.strokePath()
    g.beginPath(); g.moveTo(12, 8); g.lineTo(6, 14); g.strokePath()
    // Ojo derecho
    g.beginPath(); g.moveTo(16, 8); g.lineTo(22, 14); g.strokePath()
    g.beginPath(); g.moveTo(22, 8); g.lineTo(16, 14); g.strokePath()
    // Boca (pequeña línea)
    g.lineStyle(2, 0x888888, 1)
    g.beginPath(); g.moveTo(8, 20); g.lineTo(20, 20); g.strokePath()
    g.generateTexture('player_dead', 28, 28)
    g.destroy()
  }

  /**
   * Reproduce la animación completa sobre el sprite del jugador.
   * Devuelve una Promise que se resuelve al finalizar.
   * @param {Phaser.GameObjects.Sprite} player
   */
  play(player) {
    const s = this.scene
    if (!player) return Promise.resolve()

    // Clonar sprite de solo presentación para animar (las físicas están pausadas)
    const key = player.texture?.key || 'player'
    const ghost = s.add.sprite(player.x, player.y, key)
      .setOrigin(player.originX ?? 0.5, player.originY ?? 0.5)
      .setScale(player.scaleX ?? 1, player.scaleY ?? 1)
      .setAngle(player.angle ?? 0)
      .setDepth(10_000)
    // Ocultar el sprite original durante la animación de muerte
    try { player.setVisible(false) } catch {}
    try { s.tweens.killTweensOf(ghost) } catch {}

    // 1) Tinte rojo inmediato al impactar
    ghost.setTint(0xff1f1f)

    // Helper: ejecuta una cadena de tweens secuenciales (sin depender de Timeline)
    const runChain = (steps) => new Promise((done) => {
      const next = (i) => {
        if (i >= steps.length) return done()
        const step = steps[i]
        const userOnStart = step.onStart
        const userOnComplete = step.onComplete
        const cfg = {
          ...step,
          onStart: () => { try { userOnStart?.() } catch {} },
          onComplete: () => {
            try { userOnComplete?.() } catch {}
            next(i + 1)
          }
        }
        s.tweens.add(cfg)
      }
      next(0)
    })

    // 2) Rebotes caóticos: saltos a posiciones aleatorias, giros, y escalado leve
    const W = s.scale.width
    const H = s.scale.height
    const cx = s.cameras.main.scrollX + W / 2
    const cy = s.cameras.main.scrollY + H / 2

    const steps = []
    const hops = 6 // cantidad de saltos/choques
    for (let i = 0; i < hops; i++) {
      const tx = s.cameras.main.scrollX + Phaser.Math.Between(20, W - 20)
      const ty = s.cameras.main.scrollY + Phaser.Math.Between(20, H - 20)
      const ang = Phaser.Math.Between(-180, 180)
      const sc = Phaser.Math.FloatBetween(0.9, 1.15)
      steps.push({
        targets: ghost,
        x: tx,
        y: ty,
        angle: ang,
        scale: sc,
        ease: i % 2 === 0 ? 'Bounce.out' : 'Back.inOut',
        duration: Phaser.Math.Between(160, 260),
      })
    }

    // 3) Zoom al centro de la cámara: centrar y hacer zoom grande
    steps.push({
      targets: ghost,
      x: cx,
      y: cy,
      angle: 0,
      scale: 2.8,
      ease: 'Quad.in',
      duration: 480,
      onStart: () => {
        // Asegurar que quede bien visible sobre la UI
        ghost.setDepth(20_000)
      }
    })

    // 4) Al terminar el zoom: ojos "X" y cuerpo negro (cambiar textura)
    steps.push({
      targets: ghost,
      duration: 10,
      onStart: () => {
        try {
          ghost.clearTint()
          ghost.setTexture('player_dead')
          ghost.setScale(3.0)
        } catch {}
      }
    })

    // Pequeña "respiración" final (latido) para darle dramatismo
    steps.push({ targets: ghost, scale: 3.2, duration: 120, ease: 'Sine.out' })
    steps.push({ targets: ghost, scale: 3.0, duration: 160, ease: 'Sine.in' })

    return runChain(steps).then(() => {
      try { ghost.destroy() } catch {}
    })
  }
}
