// Phaser 3.60+ (funciona con 3.80)
// Tema "night" con: cielo gradiente + luna con halo + estrellas titilantes +
// cometa ocasional + SATURNO "realista" (bandas, Cassini, oclusión, sombras).
// Modo "animated" (spritesheet en canvas) y "parallax" (tileSprites).
// Usa SOLO la paleta night. No requiere assets externos.

const PALETTES = {
  night: ['#0a0e1a', '#0f1525', '#1a2138', '#ffffff', '#cdd9ff', '#ffeabf'],
};

export default class BackgroundFactory {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} w     ancho de frame lógico (ej. this.scale.width)
   * @param {number} h     alto  de frame lógico (ej. this.scale.height)
   * @param {number} frames cantidad de frames (8–12 recomendado)
   */
  constructor(scene, w = 480, h = 270, frames = 10) {


    this.starOptions = { fixed: 40, twinkle: 32, jitter: false };


    this.scene = scene;
    this.w = w; this.h = h; this.frames = frames;

    this.bgSprite = null;
    this.parallax = null;
    this._bgMode  = null;

    // partículas
    this.starsEmitter = null;
    this.cometTimer   = null;

    // Opciones Saturno (en proporciones del frame y escala relativa)
    this.saturn = {
      enabled: true,
      pos: { x: 0.22, y: 0.63 }, // esquina inferior izquierda-ish
      scale: 1.0,                // 1.0 => radio ~22 px en 480×270
      tilt: 18 * Math.PI/180,    // inclinación del sistema de anillos
    };

    this.showMoon = true; // puedes poner false si quieres solo Saturno


      this._starField = null; // { fixed: [{x,y,sz,a}], twinkle: [{x,y,sz,phase}] }
     
  }

  /**
   * Crea el fondo "night".
   * @param {'night'} theme
   * @param {{mode?:'animated'|'parallax', fps?:number, layers?:number, speeds?:number[], saturn?:Partial<this['saturn']>, showMoon?:boolean}} opts
   */
createBackground(theme = 'night', opts = {}) {
  const {
    mode = 'animated', fps = 12, layers = 3, speeds = [0.06, 0.14, 0.3],
    saturn, showMoon, stars
  } = opts;
if (stars) this.starOptions = { ...this.starOptions, ...stars };
  if (saturn) this.saturn = { ...this.saturn, ...saturn };
  if (typeof showMoon === 'boolean') this.showMoon = showMoon;

  this.destroy();

  if (mode === 'animated') {
    // genera el starfield una sola vez para este spritesheet
    this.#ensureStarField(this.w, this.h, this.starOptions);

    this.bgSprite = this.#createAnimated(theme, { fps, keyPrefix: 'bg' })
      .setDepth(-20).setScrollFactor(0);
    this._bgMode = 'animated';
  } else {
    this.parallax = this.#createParallax(theme, { layers, speeds, keyPrefix: 'tile' });
    this.parallax.layers.forEach((l, i) => l.setDepth(-20 + i));
    this._bgMode = 'parallax';
  }
}


  /** Atajo */
  createNightBackground(opts = {}) { this.createBackground('night', { mode: 'animated', fps: 12, ...opts }); }

  /** Update para parallax */
  updateParallax(dx = 1, dy = 0) {
    if (this._bgMode === 'parallax' && this.parallax?.update) this.parallax.update(dx, dy);
  }

  /** Partículas ambientales */
  createNightAmbientParticles() {
    this.#ensurePixelTexture();
    const keyPx = 'px';

    // destellos sutiles
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

    // cometas aleatorios
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
      this.scene.time.delayedCall(280, () => group.destroy(), null, this.scene);
    };

    this.cometTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(3000, 6000),
      loop: true,
      callback: () => {
        spawnComet();
        this.cometTimer.delay = Phaser.Math.Between(3000, 6000);
      }
    });
  }

  /** Limpieza */
  destroy() {
    if (this.bgSprite?.anims) this.bgSprite.anims.stop();
    this.bgSprite?.destroy?.(); this.bgSprite = null;

    if (this.parallax?.layers) this.parallax.layers.forEach(l => l.destroy?.());
    this.parallax = null;

    this.starsEmitter?.destroy?.(); this.starsEmitter = null;
    this.cometTimer?.remove?.();    this.cometTimer   = null;

    this._bgMode = null;
  }

  // ======== Internos: creación =========

  #createAnimated(theme, { fps = 12, keyPrefix = 'bg' } = {}) {
    const key = `${keyPrefix}-${theme}-${this.w}x${this.h}-${this.frames}`;
    if (!this.scene.textures.exists(key)) {
      this.#buildSpritesheet(theme, key);
      this.#buildAnim(key, fps);
    }
    const s = this.scene.add.sprite(this.scene.scale.width/2, this.scene.scale.height/2, key, '0')
      .setOrigin(0.5).setScrollFactor(0);
    s.play(`${key}-anim`);
    s.displayWidth  = this.scene.scale.width;
    s.displayHeight = this.scene.scale.height;
    return s;
  }

  #createParallax(theme, { layers = 3, speeds = [0.06, 0.14, 0.3], keyPrefix = 'tile' } = {}) {
    const baseKey = `${keyPrefix}-${theme}-${this.w}x${this.h}`;
    const ts = [];
    for (let i = 0; i < layers; i++) {
      const key = `${baseKey}-L${i}`;
      if (!this.scene.textures.exists(key)) this.#buildTileLayer(theme, key, i);
      const t = this.scene.add.tileSprite(0, 0, this.scene.scale.width, this.scene.scale.height, key)
        .setOrigin(0, 0).setScrollFactor(0);
      t.speed = speeds[Math.min(i, speeds.length - 1)] ?? (0.08 + i * 0.08);
      ts.push(t);
    }
    return {
      layers: ts,
      update: (dx = 1, dy = 0) => ts.forEach((t) => {
        t.tilePositionX += dx * t.speed;
        t.tilePositionY += dy * t.speed * 0.25;
      })
    };
  }


  #ensureStarField(w, h, { fixed = 40, twinkle = 32 } = {}) {
  if (this._starField) return;

  // LCG simple para aleatoriedad determinista (seed por tamaño y frames)
  const seed = (w * 73856093) ^ (h * 19349663) ^ (this.frames * 83492791);
  let s = (seed >>> 0) || 123456789;
  const rand = () => (s = (1664525 * s + 1013904223) >>> 0) / 0x100000000;

  const mkStar = () => {
    const x = Math.floor(rand() * (w - 4)) + 2;                 // margen 2 px
    const y = Math.floor(rand() * Math.floor(h * 0.78)) + 2;    // 0..~78% alto
    const sz = (rand() < 0.12) ? 2 : 1;                          // 12% estrellas “brillantes”
    return { x, y, sz };
  };

  // Fijas: alpha constante (ligera variación al crear)
  const fixedStars = [];
  for (let i = 0; i < fixed; i++) {
    const s = mkStar();
    const a = 0.65 + rand() * 0.25; // 0.65..0.90
    fixedStars.push({ ...s, a });
  }

  // Twinkle: fase inicial distinta para cada estrella
  const twinkleStars = [];
  for (let i = 0; i < twinkle; i++) {
    const s_ = mkStar();
    const phase = rand() * Math.PI * 2;
    twinkleStars.push({ ...s_, phase });
  }

  this._starField = { fixed: fixedStars, twinkle: twinkleStars };
}


  #buildSpritesheet(theme, key) {
    const { frames, w, h } = this;
    const canvasTex = this.scene.textures.createCanvas(key, w * frames, h);
    const ctx = canvasTex.getContext();
    for (let f = 0; f < frames; f++) this.#paintBackgroundFrame(ctx, theme, w, h, f, frames, f * w);
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
    const w = 256, h = 256;
    const tx = this.scene.textures.createCanvas(key, w, h);
    const ctx = tx.getContext();
    const pal = PALETTES[theme] ?? PALETTES.night;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

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

  // ======== Pintura de frames =========

  #paintBackgroundFrame(ctx, theme, w, h, f, frames, ox) {
    const pal = PALETTES[theme] ?? PALETTES.night;

    // cielo
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(ox, 0, w, h);

    // escena "night"
    this.#paintNight(ctx, pal, f, frames, ox, w, h);

    // scanlines retro
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) ctx.fillRect(ox, y, w, 1);
    ctx.globalAlpha = 1;
  }

  /** Noche: luna + estrellas + cometa + Saturno detallado */
  #paintNight(ctx, pal, f, frames, ox, w, h) {
    const t = (f / frames) * Math.PI * 2;
 
// 🌙 Luna (se dibuja solo si showMoon = true)
if (this.showMoon) {
  // Posición de la luna (arriba a la derecha del frame)
  const moonX = ox + Math.floor(w * 0.9); // 90% del ancho
  const moonY = Math.floor(h * 0.1);      // 10% de la altura

  // Radio del halo: varía levemente con un seno para simular pulsación
  const haloR = 26 + Math.sin(t * 1.2) * 2;

  // --- Halo luminoso alrededor de la luna ---
  ctx.globalAlpha = 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(t * 2)); // alpha pulsante
  ctx.fillStyle = pal[5];                                        // tono cálido/amarillento
  ctx.beginPath(); ctx.arc(moonX, moonY, haloR, 0, Math.PI * 2);
  ctx.fill();

  // --- Disco principal de la luna ---
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal[4]; // color claro
  ctx.beginPath(); ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
  ctx.fill();

  // --- Recorte de sombra para simular fase creciente ---
  ctx.fillStyle = pal[1]; // color oscuro (sombra)
  ctx.beginPath(); ctx.arc(moonX + 6, moonY, 18, 0, Math.PI * 2);
  ctx.fill();
}


 

    // Cometa ocasional
    if (f === 1 || f === Math.floor(frames / 2)) {
      const progress = f === 1 ? 0.3 : 0.6;
      const baseX = ox + Math.floor(w * progress);
      const baseY = Math.floor(h * (0.28 + 0.04 * Math.sin(t)));
      ctx.fillStyle = pal[5];
      ctx.fillRect(baseX, baseY, 3, 3);
      for (let i = 1; i <= 10; i++) {
        ctx.globalAlpha = 0.22 - i * 0.018;
        ctx.fillStyle = (i % 2 === 0) ? pal[5] : pal[3];
        ctx.fillRect(baseX - i * 5, baseY - i * 2, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
// === Estrellas: fijas y titilantes ===
if (this._starField) {
  // fijas
  for (const st of this._starField.fixed) {
    const jx = (this.starOptions.jitter) ? ((Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 1 : 0)) : 0;
    const jy = (this.starOptions.jitter) ? ((Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 1 : 0)) : 0;
    ctx.globalAlpha = st.a;
    ctx.fillStyle = (st.sz === 2) ? pal[4] : pal[3];
    ctx.fillRect(ox + st.x + jx, st.y + jy, st.sz, st.sz);
  }

  // twinkle
  const t = (f / frames) * Math.PI * 2;
  for (let i = 0; i < this._starField.twinkle.length; i++) {
    const st = this._starField.twinkle[i];
    const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3 + st.phase + i * 0.23));
    const jx = (this.starOptions.jitter) ? Math.round(Math.sin(t*2 + st.phase) * 1) : 0;
    const jy = (this.starOptions.jitter) ? Math.round(Math.cos(t*2 + st.phase) * 1) : 0;
    ctx.globalAlpha = blink;
    ctx.fillStyle = (st.sz === 2) ? pal[4] : pal[3];
    ctx.fillRect(ox + st.x + jx, st.y + jy, st.sz, st.sz);
  }
  ctx.globalAlpha = 1;
}


    // SATURNO (detallado) — siempre dibujar DESPUÉS del cielo/estrellas
    if (this.saturn.enabled) {
      const cx = ox + Math.floor(w * this.saturn.pos.x);
      const cy = Math.floor(h * this.saturn.pos.y);

      // radio base con escala y micro-animación (breathing)
      const baseR = Math.floor(22 * this.saturn.scale);
      const r = baseR + Math.floor(Math.sin(t * 0.6) * 1);

      // anillos: parámetros (usamos night palette)
      const ringTilt = this.saturn.tilt;            // inclinación
      const rot = t * 0.25;                         // leve rotación por frame
      const innerR = Math.floor(r * 1.5);
      const outerR = Math.floor(r * 2.4);

      // 1) Anillos parte lejana (detrás del planeta)
      this.#drawRings(ctx, pal, cx, cy, innerR, outerR, ringTilt, rot, /*front*/ false);

      // 2) Planeta (cuerpo + bandas + terminador + luz especular)
      this.#drawSaturnBody(ctx, pal, cx, cy, r, rot);

      // 3) Sombra del planeta sobre los anillos (oclusiones suaves)
      this.#drawRingShadow(ctx, pal, cx, cy, r, innerR, outerR, ringTilt, rot);

      // 4) Anillos parte cercana (delante del planeta)
      this.#drawRings(ctx, pal, cx, cy, innerR, outerR, ringTilt, rot, /*front*/ true);
    }
  }

  // ======== Saturno helpers =========

  /**
   * Cuerpo del planeta con bandas "dither", terminador y highlight.
   */
  #drawSaturnBody(ctx, pal, cx, cy, r, rot) {
    // disco base
    ctx.fillStyle = pal[4];
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // sombreado lateral (terminador / noche)
    ctx.fillStyle = pal[1];
    ctx.globalAlpha = 0.65;
    ctx.beginPath(); ctx.arc(cx + r*0.32, cy + r*0.08, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // bandas ecuatoriales con dither/tramas
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const frac = (i + 0.5) / bands; // 0..1
      const y = cy - r + Math.floor(frac * 2 * r);
      const bandH = Math.max(1, Math.floor(r * 0.12));
      const phase = Math.sin(rot + i * 0.6);
      const intensity = 0.15 + 0.25 * (0.5 + 0.5 * phase);

      // color de banda: mezcla entre pal[4] (claro) y pal[5] (cálido)
      const useLight = (i % 2 === 0);
      ctx.globalAlpha = 0.55 * intensity;
      ctx.fillStyle = useLight ? pal[5] : pal[4];

      // trazar solo la sección dentro del disco (rects de 2×2 con máscara simple)
      for (let x = cx - r; x <= cx + r; x += 2) {
        // ecuación del círculo para limitar al disco
        const dy = y - cy;
        if ((x - cx) * (x - cx) + dy * dy <= r * r) {
          // trama: patrón alterno para “dither”
          if (((x + i) & 3) === 0) ctx.fillRect(x, y + ((x >> 1) & 1), 2, bandH);
        }
      }
      ctx.globalAlpha = 1;
    }

    // highlight especular sutil (brillo)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = pal[3];
    ctx.beginPath();
    ctx.arc(cx - r*0.3, cy - r*0.2, Math.max(2, Math.floor(r*0.35)), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Dibuja los anillos con Cassini y gradiente radial, en dos pasadas:
   * - front=false: parte lejana (detrás del planeta)
   * - front=true : parte cercana (delante del planeta)
   */
  #drawRings(ctx, pal, cx, cy, innerR, outerR, tilt, rot, front) {
    // parámetros visuales
    const thickness = outerR - innerR;
    if (thickness <= 0) return;

    // “Cassini division”: gap oscuro entre ~0.78–0.86 de la corona
    const cassiniStart = innerR + Math.floor(thickness * 0.78);
    const cassiniEnd   = innerR + Math.floor(thickness * 0.86);

    // recorremos varias “coronas” radiales finas para crear gradiente pixelado
    const steps = Math.max(16, Math.floor(thickness * 0.8));
    for (let s = 0; s <= steps; s++) {
      const r = innerR + Math.floor((s / steps) * thickness);

      // decidir si esta corona cae en Cassini (oscurecer/omitir)
      let alpha = 0.85;
      if (r >= cassiniStart && r <= cassiniEnd) alpha = 0.25;

      // color según radial (mezcla fría/blanca)
      const cold = s / steps;
      ctx.strokeStyle = (cold < 0.5) ? pal[4] : pal[3];
      ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(rot + s * 0.15));

      // Para separar “frente/detrás”:
      // calculamos el lado cercano en función del tilt:
      // si front=false, solo trazamos semielipse “trasera”; si front=true, la “delantera”.
      const startAngle = front ? Math.PI : 0;
      const endAngle   = front ? 2*Math.PI : Math.PI;

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        cx, cy,
        r * 1.0,               // radio mayor (X)
        Math.max(1, r * 0.42), // radio menor (Y) — aplanamiento
        tilt, startAngle, endAngle
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Sombra del planeta sobre los anillos (atenuación progresiva).
   */
  #drawRingShadow(ctx, pal, cx, cy, planetR, innerR, outerR, tilt, rot) {
    const steps = 18;
    for (let s = 0; s < steps; s++) {
      const r = innerR + Math.floor((s / steps) * (outerR - innerR));
      const alpha = 0.22 * (1 - s / steps);
      ctx.strokeStyle = pal[1];
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      // sombrear solo la zona “trasera”: simulamos penumbra proyectada
      ctx.beginPath();
      ctx.ellipse(
        cx + planetR*0.15,           // pequeño offset para sugerir dirección de luz
        cy + planetR*0.05,
        r * 1.0,
        Math.max(1, r * 0.42),
        tilt, 0, Math.PI
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ======== Utils ========

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
