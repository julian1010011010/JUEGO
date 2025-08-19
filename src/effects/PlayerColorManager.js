export default class PlayerColorManager {
  constructor(scene, player = null) {
    this.scene = scene
    this.player = player
    this._watches = new Map() // Map<target, { event, color }>
  }

  setPlayer(player) {
    this.player = player
  }

  applyWhileOverlap(target, color, interval = 80) {
    if (!this.scene || !target || this._watches.has(target)) return
    const ev = this.scene.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => this._recomputeTint()
    })
    this._watches.set(target, { event: ev, color })
    target.once?.('destroy', () => this.stopFor(target, true))
    this._recomputeTint()
  }

  stopFor(target, recalc = true) {
    const meta = this._watches.get(target)
    if (meta) {
      meta.event?.remove(false)
      this._watches.delete(target)
      if (recalc) this._recomputeTint()
    }
  }

  clearAll() {
    for (const { event } of this._watches.values()) event?.remove(false)
    this._watches.clear()
    this.player?.clearTint?.()
  }

  destroy() {
    this.clearAll()
  }

  _recomputeTint() {
    const p = this.player
    const world = this.scene?.physics?.world
    if (!p || !p.active || !world) return
    let color = null
    for (const [target, meta] of this._watches.entries()) {
      if (!target?.active) continue
      if (world.overlap(p, target)) { color = meta.color; break }
    }
    if (color != null) p.setTint?.(color)
    else p.clearTint?.()
  }

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
