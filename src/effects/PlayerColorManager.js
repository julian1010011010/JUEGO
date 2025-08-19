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

  // Unifica la lógica y toma color del target si no fue provisto en applyWhileOverlap,
  // y resuelve Groups hijo por hijo.
  _recomputeTint() {
    const p = this.player
    const world = this.scene?.physics?.world
    if (!p || !p.active || !world) return

    let chosen = null
    for (const [target, meta] of this._watches.entries()) {
      if (target && target.active === false) continue
      const inferred = this._resolveOverlapColor(p, target, meta, world)
      if (inferred != null) {
        chosen = inferred
        break
      }
    }
    if (chosen != null) p.setTint?.(chosen)
    else p.clearTint?.()
  }

  // Devuelve el color del objeto (o del hijo del Group) que realmente está solapando
  _resolveOverlapColor(p, target, meta, world = this.scene?.physics?.world) {
    if (!target || !world) return null

    // Si ya hay color forzado y hay solape, úsalo
    if (meta?.color != null && world.overlap(p, target)) return meta.color

    // Si es un Group (o tiene hijos), buscar el hijo que solapa
    const getChildren = typeof target.getChildren === 'function' ? target.getChildren.bind(target) : null
    if (getChildren) {
      const children = getChildren() || []
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (!child || child.active === false) continue
        if (world.overlap(p, child)) {
          const c = this._extractColorFrom(child)
          if (c != null) return c
          // fallback: si no se pudo inferir del hijo y había color en meta, úsalo
          return meta?.color ?? null
        }
      }
      return null
    }

    // Objeto individual
    if (world.overlap(p, target)) {
      const c = this._extractColorFrom(target)
      return c != null ? c : (meta?.color ?? null)
    }

    return null
  }

  // Intenta extraer el color de distintos tipos de GameObjects de Phaser
  _extractColorFrom(target) {
    // Datos personalizados
    const fromData =
      (typeof target.getData === 'function' && (
        target.getData('tintColor') ??
        target.getData('color') ??
        target.getData('tint')
      )) ?? null
    if (typeof fromData === 'number') return fromData

    // Figuras (p.ej., Rectangle) usan fillColor
    if (typeof target.fillColor === 'number') return target.fillColor

    // Sprites/Images: propiedades de tint
    const tints = [
      target.tintTopLeft,
      target.tintTopRight,
      target.tintBottomLeft,
      target.tintBottomRight,
      target.tint
    ].filter(v => typeof v === 'number')
    if (tints.length > 0) return tints[0]

    return null
  }
}
