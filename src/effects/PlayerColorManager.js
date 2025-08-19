export default class PlayerColorManager {
  constructor(scene, player = null) {
    this.scene = scene
    this.player = player
  this._watches = new Map() // Map<target, { event, color }>
  this._footZone = null // sensor bajo los pies, como la estela
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
  try { this._footZone?.destroy?.() } catch {}
  this._footZone = null
  }

  destroy() {
    this.clearAll()
  }

  // Unifica la lógica y toma color del target si no fue provisto en applyWhileOverlap,
  // y resuelve Groups hijo por hijo.
  _recomputeTint() {
    const scene = this.scene
    const player = this.player
    const world = scene?.physics?.world
    if (!scene || !player || !player.active || !player.body || !world) return

    // Asegurar textura px para el sensor si es necesario
    this._ensurePxTexture()
    this._ensureFootZone()

    // Dimensionar y posicionar sensor bajo los pies (mismo enfoque que la estela)
    const fh = 6
    this._footZone.setDisplaySize?.(player.displayWidth, fh)
    if (this._footZone.body?.setSize) {
      this._footZone.body.setSize(this._footZone.displayWidth, fh, true)
    } else {
      this._footZone.setSize?.(player.displayWidth, fh)
    }
    const pb = player.body
    const cx = pb.center?.x ?? player.x
    const bottom = pb.bottom ?? (player.y + player.displayHeight / 2)
    if (this._footZone.body?.reset) {
      this._footZone.body.reset(cx, bottom + fh / 2 + 1)
    } else {
      this._footZone.setPosition?.(cx, bottom + fh / 2 + 1)
    }

    // Recorrer los targets vigilados (p. ej., el staticGroup de plataformas)
    let chosen = null
    for (const [target] of this._watches.entries()) {
      if (!target) continue
      // Busca la primera plataforma bajo el sensor y usa su typeColor (fallback blanco)
      let hit = null
      scene.physics.overlap(this._footZone, target, (_z, other) => {
        if (hit) return
        hit = other
      })
      if (hit) {
        const c = (typeof hit.typeColor === 'number' && hit.typeColor >= 0)
          ? hit.typeColor
          : this._extractColorFrom(hit)
        chosen = (c != null ? c : 0xffffff)
        break
      }
    }

    // Sin plataforma bajo el pie: blanco como la estela
    if (chosen == null) chosen = 0xffffff
    player.setTint?.(chosen)
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

  // --- helpers privados ---
  _ensurePxTexture() {
    const scene = this.scene
    if (!scene || scene.textures?.exists('px')) return
    const g = scene.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, 1, 1)
    g.generateTexture('px', 1, 1)
    g.destroy()
  }

  _ensureFootZone() {
    const scene = this.scene
    if (this._footZone && this._footZone.body) return this._footZone
    try { this._footZone?.destroy?.() } catch {}
    if (!scene?.physics?.add) return null
    this._footZone = scene.physics.add.image(0, 0, 'px')
      .setVisible(false)
      .setAlpha(0)
      .setImmovable(true)
    if (this._footZone.body) this._footZone.body.allowGravity = false
    return this._footZone
  }
}
