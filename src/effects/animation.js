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
  this._ensurePxTexture()
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

  // Asegura textura 1x1 para humo/partículas si no existe
  _ensurePxTexture() {
    const s = this.scene
    if (s.textures.exists('px')) return
    const g = s.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1)
    g.destroy()
  }

  /**
   * Reproduce la animación completa sobre el sprite del jugador.
   * Devuelve una Promise que se resuelve al finalizar.
   * @param {Phaser.GameObjects.Sprite} player
   */
  play(player, options = {}) {
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

    // Humo que sigue al personaje durante toda la animación
    // Config: partículas grises que suben y se desvanecen
    const density = Math.max(0, options.density ?? 1.6) // 1.0=base, >1 más denso
    const qty = Math.round((options.quantity ?? 6) * density)
    const freq = Math.max(10, Math.round((options.frequency ?? 35) / density))
    const smoke = s.add.particles(0, 0, 'px', {
      follow: ghost,           // el emisor sigue al sprite clonado
      x: 0,
      y: 0,
      quantity: qty,
      frequency: freq,
      lifespan: options.lifespan || { min: 800, max: 1600 },
      speedY: options.speedY || { min: -80, max: -180 },
      speedX: options.speedX || { min: -50, max: 50 },
      scale: options.scale || { start: 2.0, end: 4.5, ease: 'Sine.out' },
      alpha: options.alpha || { start: 0.75, end: 0 },
      tint: options.tint || [0x6b7280, 0x4b5563, 0x9ca3af],
      rotate: options.rotate || { min: -12, max: 12 },
      blendMode: Phaser.BlendModes.NORMAL
    }).setDepth(ghost.depth - 1)

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
    let cx0 = ghost.x
    let cy0 = ghost.y
    for (let i = 0; i < hops; i++) {
      const tx = s.cameras.main.scrollX + Phaser.Math.Between(20, W - 20)
      const ty = s.cameras.main.scrollY + Phaser.Math.Between(20, H - 20)
      const dx = tx - cx0
      const dy = ty - cy0
      const dist = Math.max(1, Math.hypot(dx, dy))
      const midx = cx0 + dx * 0.5
      const midy = cy0 + dy * 0.5
      const nx = -dy / dist
      const ny = dx / dist
      const sign = Phaser.Math.RND.sign()
      const amp = Math.min(120, Math.max(40, dist * Phaser.Math.FloatBetween(0.35, 0.7)))
      const cpx = midx + nx * amp * sign
      const cpy = midy + ny * amp * sign
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(cx0, cy0),
        new Phaser.Math.Vector2(cpx, cpy),
        new Phaser.Math.Vector2(tx, ty)
      )
      const targetObj = { t: 0 }
      const dur = Phaser.Math.Between(220, 320)
      steps.push({
        targets: targetObj,
        t: 1,
        duration: dur,
        ease: i % 2 === 0 ? 'Sine.inOut' : 'Cubic.inOut',
        onStart: () => {
          // pequeño jitter de escala al inicio de cada curva
          const sc = Phaser.Math.FloatBetween(0.92, 1.12)
          ghost.setScale(sc)
        },
        onUpdate: () => {
          const p = curve.getPoint(targetObj.t)
          ghost.x = p.x
          ghost.y = p.y
          const tan = curve.getTangent(targetObj.t)
          const angRad = Math.atan2(tan.y, tan.x)
          ghost.setAngle(Phaser.Math.RadToDeg(angRad))
        }
      })
      // preparar siguiente curva partiendo del nuevo final
      cx0 = tx
      cy0 = ty
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
      // Detener y limpiar el humo tras un breve retardo (
      try { smoke.stop() } catch {}
      try { s.time.delayedCall(400, () => smoke.destroy()) } catch {}
    })
  }
}
