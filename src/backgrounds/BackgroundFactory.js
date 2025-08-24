// Phaser 3.60+ (funciona con 3.80)
// Fondo pixel-art de noche con: gradiente, luna creciente con halo pulsante,
// estrellas titilantes y cometa ocasional. Soporta modo "animated" (spritesheet)
// y "parallax" (tileSprites). Incluye partículas ambientales opcionales.

const PALETTES = {
  // night: fríos + blancos/amarillos para estrellas/halo
  night: ['#0a0e1a', '#0f1525', '#1a2138', '#ffffff', '#cdd9ff', '#ffeabf'],
};

export default class BackgroundFactory {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} w     ancho de frame lógico (p.ej. this.scale.width)
   * @param {number} h     alto  de frame lógico (p.ej. this.scale.height)
   * @param {number} frames cantidad de frames de animación (recom. 8–12)
   */
  constructor(scene, w = 480, h = 270, frames = 10) {
    this.scene = scene;
    this.w = w; this.h = h; this.frames = frames;

    // Estado vivo
    this.bgSprite = null;     // sprite de animación por frames
    this.parallax = null;     // { layers: TileSprite[], update(dx,dy) }
    this._bgMode  = null;     // 'animated' | 'parallax' | null

    // Partículas/ambientales
    this.starsEmitter = null; // destellos sutiles
    this.cometTimer   = null; // timer para ráfagas de cometas
  }

  // =============== API PÚBLICA ===============

  /**
   * Crea el fondo nocturno (animado por frames o parallax).
   * @param {'night'} theme  por ahora solo night
   * @param {{ mode?: 'animated'|'parallax', fps?:number, layers?:number, speeds?:number[]}} opts
   */
  createBackground(theme = 'night', opts = {}) {
    const { mode = 'animated', fps = 12, layers = 3, speeds = [0.06, 0.14, 0.3] } = opts;
    this.destroy(); // limpia lo existente

    if (mode === 'animated') {
      this.bgSprite = this.#createAnimated(theme, { fps, keyPrefix: 'bg' })
        .setDepth(-20).setScrollFactor(0);
      this._bgMode = 'animated';
    } else {
      this.parallax = this.#createParallax(theme, { layers, speeds, keyPrefix: 'tile' });
      this.parallax.layers.forEach((l, i) => l.setDepth(-20 + i));
      this._bgMode = 'parallax';
    }
  }

  /** Atajo conveniente */
  createNightBackground(opts = {}) { this.createBackground('night', { mode: 'animated', fps: 12, ...opts }); }

  /** Actualiza parallax (llamar desde update) */
  updateParallax(dx = 1, dy = 0) {
    if (this._bgMode === 'parallax' && this.parallax?.update) {
      this.parallax.update(dx, dy);
    }
  }

  /**
   * Partículas ambientales:
   *  - Estrellas que parpadean (puntos blancos breves).
   *  - Cometas esporádicos como ráfagas (usar timer).
   */
  createNightAmbientParticles() {
    this.#ensurePixelTexture();
    const keyPx = 'px';

    // Destellos sutiles sobre toda la pantalla
    this.starsEmitter = this.scene.add.particles(0, 0, keyPx, {
      x: { min: 0, max: this.scene.scale.width },
      y: { min: 0, max: this.scene.scale.height * 0.75 },
      quantity: 2,
      frequency: 120,
      lifespan: { min: 200, max: 450 },
      scale: { start: 1.5, end: 0.5 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffffff, 0xcdd9ff],
      speedX: { min: -5, max: 5 },
      speedY: { min: -5, max: 5 },
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(-18);

    // Ráfagas de cometas cada ~3–6 s, cruzan diagonalmente
    const spawnComet = () => {
      const startY = Phaser.Math.Between(20, Math.floor(this.scene.scale.height * 0.5));
      const startX = -40;
      const group = this.scene.add.particles(0, 0, keyPx, {
        x: startX,
        y: startY,
        lifespan: 500,
        speedX: { min: 350, max: 420 },
        speedY: { min: -120, max: -80 },
        gravityY: 0,
        scale: { start: 2.5, end: 1 },
        alpha: { start: 1, end: 0 },
        quantity: 1,
        frequency: 28,
        tint: [0xffffff, 0xffeabf],
        blendMode: Phaser.BlendModes.ADD
      }).setDepth(-18);

      // cola extra (trail) como ráfaga rápida
      this.scene.time.delayedCall(280, () => group.destroy(), null, this.scene);
    };

    this.cometTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(3000, 6000),
      loop: true,
      callback: () => {
        spawnComet();
        // siguiente delay aleatorio
        this.cometTimer.delay = Phaser.Math.Between(3000, 6000);
      }
    });
  }

  /** Limpia fondo y partículas */
  destroy() {
    // Animación por frames
    if (this.bgSprite?.anims) this.bgSprite.anims.stop();
    this.bgSprite?.destroy?.();
    this.bgSprite = null;

    // Parallax
    if (this.parallax?.layers) this.parallax.layers.forEach(l => l.destroy?.());
    this.parallax = null;

    // Partículas / timers
    this.starsEmitter?.destroy?.(); this.starsEmitter = null;
    this.cometTimer?.remove?.(); this.cometTimer = null;

    this._bgMode = null;
  }

  // =============== INTERNOS: Creación de fondos ===============

  #createAnimated(theme, { fps = 12, keyPrefix = 'bg' } = {}) {
    const key = `${keyPrefix}-${theme}-${this.w}x${this.h}-${this.frames}`;
    if (!this.scene.textures.exists(key)) {
      this.#buildSpritesheet(theme, key);
      this.#buildAnim(key, fps);
    }
    const s = this.scene.add.sprite(this.scene.scale.width/2, this.scene.scale.height/2, key, '0')
      .setOrigin(0.5).setScrollFactor(0);

    s.play(`${key}-anim`);
    // Escala para cubrir la vista
    s.displayWidth  = this.scene.scale.width;
    s.displayHeight = this.scene.scale.height;
    return s;
  }

  #createParallax(theme, { layers = 3, speeds = [0.06, 0.14, 0.3], keyPrefix = 'tile' } = {}) {
    const baseKey = `${keyPrefix}-${theme}-${this.w}x${this.h}`;
    const ts = [];
    for (let i = 0; i < layers; i++) {
      const key = `${baseKey}-L${i}`;
      if (!this.scene.textures.exists(key)) {
        this.#buildTileLayer(theme, key, i);
      }
      const t = this.scene.add.tileSprite(0, 0, this.scene.scale.width, this.scene.scale.height, key)
        .setOrigin(0, 0).setScrollFactor(0);
      t.speed = speeds[Math.min(i, speeds.length - 1)] ?? (0.08 + i * 0.08);
      ts.push(t);
    }
    return {
      layers: ts,
      update: (dx = 1, dy = 0) => {
        ts.forEach((t) => {
          t.tilePositionX += dx * t.speed;
          t.tilePositionY += dy * t.speed * 0.25;
        });
      }
    };
  }

  #buildSpritesheet(theme, key) {
    const { frames, w, h } = this;
    const canvasTex = this.scene.textures.createCanvas(key, w * frames, h);
    const ctx = canvasTex.getContext();
    for (let f = 0; f < frames; f++) {
      this.#paintBackgroundFrame(ctx, theme, w, h, f, frames, f * w);
    }
    canvasTex.refresh();
    const tex = this.scene.textures.get(key);
    for (let f = 0; f < frames; f++) tex.add(String(f), 0, f * w, 0, w, h);
  }

  #buildAnim(key, fps) {
    const animKey = `${key}-anim`;
    if (this.scene.anims.exists(animKey)) return;
    const framesArr = Array.from({ length: this.frames }, (_, i) => ({ key, frame: String(i) }));
    this.scene.anims.create({ key: animKey, frames: framesArr, frameRate: fps, repeat: -1 });
  }

  #buildTileLayer(theme, key, layerIndex) {
    // Tile básico 256x256 con cielo y estrellas en distintas densidades
    const w = 256, h = 256;
    const tx = this.scene.textures.createCanvas(key, w, h);
    const ctx = tx.getContext();
    const pal = PALETTES[theme] ?? PALETTES.night;

    // Gradiente vertical
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Estrellas “estáticas” por capa (más chicas en fondo)
    const density = [90, 60, 35][Math.min(layerIndex, 2)];
    ctx.globalAlpha = 0.6 - layerIndex * 0.15;
    ctx.fillStyle = pal[3];
    for (let i = 0; i < density; i++) {
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h * 0.8);
      const sz = (layerIndex === 0) ? 1 : (layerIndex === 1 ? 2 : 3);
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
    tx.refresh();
  }

  // =============== PINTURA DE FRAMES (modo animated) ===============

  #paintBackgroundFrame(ctx, theme, w, h, f, frames, ox) {
    const pal = PALETTES[theme] ?? PALETTES.night;

    // Fondo base (gradiente)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(ox, 0, w, h);

    switch (theme) {
      case 'night':
        this.#paintNight(ctx, pal, f, frames, ox, w, h);
        break;
      default:
        this.#paintNight(ctx, pal, f, frames, ox, w, h); // fallback
        break;
    }

    // Scanlines sutiles para look retro
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) ctx.fillRect(ox, y, w, 1);
    ctx.globalAlpha = 1;
  }

  /** Tema Night (cielo estrellado con luna, halo pulsante, titileo y cometa) */
  #paintNight(ctx, pal, f, frames, ox, w, h) {
    const t = (f / frames) * Math.PI * 2;

    // 🌙 Luna creciente con halo pulsante (top-right)
    const moonX = ox + Math.floor(w * 0.85);
    const moonY = Math.floor(h * 0.22);
    const haloR = 26 + Math.sin(t * 1.2) * 2;

    // halo suave
    ctx.globalAlpha = 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(t * 2));
    ctx.fillStyle = pal[5]; // tono cálido
    ctx.beginPath(); ctx.arc(moonX, moonY, haloR, 0, Math.PI * 2); ctx.fill();

    // disco y recorte para "creciente"
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal[4]; // luna clara
    ctx.beginPath(); ctx.arc(moonX, moonY, 18, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = pal[1]; // recorte “sombra”
    ctx.beginPath(); ctx.arc(moonX + 6, moonY, 18, 0, Math.PI * 2); ctx.fill();

    // ✨ Estrellas titilantes (pseudo-determinístico por frame)
    const starCount = 42;
    for (let i = 0; i < starCount; i++) {
      // Distribución reproducible: usa i y f para variar
      const x = ox + ((i * 61 + f * 17) % (w - 3)) + 2;
      const y = (i * 37 + f * 11) % Math.floor(h * 0.78);
      // titileo por seno con fase distinta
      const blink = 0.55 + 0.45 * Math.sin(t * 3 + i * 0.7);
      ctx.globalAlpha = blink;
      ctx.fillStyle = (i % 7 === 0) ? pal[4] : pal[3]; // algunas azuladas
      const sz = (i % 9 === 0) ? 2 : 1;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;

    // 🌠 Cometa ocasional: aparece en ~2 de N frames del loop
    // Aquí lo hacemos aparecer cuando (f % frames) coincide con 1 ó frames/2
    if (f === 1 || f === Math.floor(frames / 2)) {
      const progress = f === 1 ? 0.3 : 0.6; // arranca en distinto tramo
      const baseX = ox + Math.floor(w * progress);
      const baseY = Math.floor(h * (0.28 + 0.04 * Math.sin(t)));
      // cabeza del cometa
      ctx.fillStyle = pal[5];
      ctx.fillRect(baseX, baseY, 3, 3);
      // cola (trail) diagonal hacia atrás
      for (let i = 1; i <= 10; i++) {
        ctx.globalAlpha = 0.22 - i * 0.018;
        ctx.fillStyle = (i % 2 === 0) ? pal[5] : pal[3];
        ctx.fillRect(baseX - i * 5, baseY - i * 2, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  // =============== UTILIDADES ===============

  #ensurePixelTexture() {
    const key = 'px';
    if (this.scene.textures.exists(key)) return;
    const size = 1;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    const ctx = canvas.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
