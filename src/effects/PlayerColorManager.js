export default class PlayerColorManager {
  constructor(scene, player = null) {
    this.scene = scene
    this.player = player
    this._watches = new Map() // Map<target, { event, color, interval }>
  }

  setPlayer(player) {
    this.player = player
  }

  // Registra un watch: mientras haya solape con el target, aplica 'color'
  applyWhileOverlap(target, color, interval = 80) {
    if (!target || !this.scene) return
    if (this._watches.has(target)) return

    const ev = this.scene.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => this._recomputeTint()
    })

    this._watches.set(target, { event: ev, color, interval })

    // Limpieza automática si el target se destruye
    target.once?.('destroy', () => this.stopFor(target, true))

    // Recalcular de inmediato
    this._recomputeTint()
  }

  stopFor(target, clear = true) {
    const meta = this._watches.get(target)
    if (meta) {
      meta.event?.remove(false)
      this._watches.delete(target)
      if (clear) this._recomputeTint()
    }
  }

  setColor(color) {
    this.player?.setTint?.(color)
  }

  clearColor() {
    this.player?.clearTint?.()
  }

  destroy() {
    for (const { event } of this._watches.values()) event?.remove(false)
    this._watches.clear()
    this.clearColor()
  }

  // Determina si hay algún target en solape y aplica el primer color encontrado
  _recomputeTint() {
    const p = this.player
    if (!p || !p.active) return

    let chosen = null
    for (const [target, meta] of this._watches.entries()) {
      if (!target?.active) continue
      if (this.scene.physics.world.overlap(p, target)) {
        chosen = meta.color
        break
      }
    }
    if (chosen != null) p.setTint?.(chosen)
    else p.clearTint?.()
  }
}
