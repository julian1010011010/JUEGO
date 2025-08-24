// src/sprites/procedural/ProceduralPlayerFactory.js
// Phaser 3.60+ — Gato “persa” pixel-art procedimental (idle, walk, jump, fall). Sin assets.
// Ajustes:
//  - Subir el personaje 2 px en TODOS los estados EXCEPTO idle (bodyYOffsetNonIdle = -2).
//  - Escala entera por defecto para evitar "pixel fantasma" al caminar (pixelPerfect = true).
//  - Extrusión de bordes = 2 px para mayor seguridad (EXTRUDE = 2).
//  - Opción para que la sombra acompañe o no el desplazamiento vertical (moveShadowWithBody).

import Phaser from "phaser"; // Si tu bundler lo inyecta global, puedes remover esta línea.

const CAT_PAL = {
  furMid:   "#8f8683", // pelaje medio
  furDark:  "#5a4f4c", // sombra pelaje
  furLight: "#cfc7c4", // luces / pecho
  eye:      "#1b1b1b", // contorno/iris oscuro
  iris:     "#e0a21a", // ámbar
  nose:     "#6a4a48", // nariz
  mouth:    "#2a2222",
  whisker:  "#e8e3df",
  earIn:    "#423434ff",
  glow:     "#ffffff"
};

export default class RockoPlayer {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.fw=64]  Ancho del frame (px)
   * @param {number} [opts.fh=64]  Alto del frame (px)
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string}  [opts.keyPrefix="cat"] Prefijo para la clave de textura
   * @param {Partial<typeof CAT_PAL>} [opts.palette]  Paleta opcional
   * @param {boolean} [opts.angryEyes=true]  Ojos más cerrados (look “grumpy”)
   * @param {number}  [opts.bodyYOffsetNonIdle=-2]  ΔY aplicado SOLO si state !== "idle"
   * @param {boolean} [opts.moveShadowWithBody=true] Si true, la sombra acompaña el ΔY
   * @param {number}  [opts.extrude=2]  Extrusión (px) alrededor de cada frame en el atlas
   * @param {number}  [opts.pad=2]      Padding (px) entre celdas del atlas
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "cat",
    palette = {},
    angryEyes = true,
    bodyYOffsetNonIdle = -2,
    moveShadowWithBody = true,
    extrude = 2,
    pad = 2
  } = {}) {
    this.scene = scene;
    this.fw = fw;
    this.fh = fh;
    this.angryEyes = angryEyes;
    this.bodyYOffsetNonIdle = bodyYOffsetNonIdle;
    this.moveShadowWithBody = moveShadowWithBody;

    this.EXTRUDE = Math.max(1, extrude); // más seguro = 2
    this.PAD = Math.max(1, pad);         // separación entre celdas

    this.pal = { ...CAT_PAL, ...palette };

    this.count = {
      idle: frames?.idle ?? 6,
      walk: frames?.walk ?? 8,
      jump: frames?.jump ?? 4,
      fall: frames?.fall ?? 2
    };

    this.rows = ["idle", "walk", "jump", "fall"];
    this._cols = Math.max(this.count.idle, this.count.walk, this.count.jump, this.count.fall);

    this.key =
      `${keyPrefix}-${fw}x${fh}-i${this.count.idle}-w${this.count.walk}-j${this.count.jump}-f${this.count.fall}` +
      `-${this.angryEyes ? 'angry' : 'neutral'}-yo${this.bodyYOffsetNonIdle}` +
      `-${this.moveShadowWithBody ? 'smove' : 'sfixed'}-ex${this.EXTRUDE}-pd${this.PAD}`;
  }

  // ───────────────────────── Sheet & anims ─────────────────────────
  buildSheet() {
    if (this.scene.textures.exists(this.key)) return this.key;

    const cols = this._cols, rows = this.rows.length;
    const PAD = this.PAD;
    const EXTRUDE = this.EXTRUDE;

    // tamaño total del canvas (con gutters)
    const cellW = this.fw + PAD + EXTRUDE * 2;
    const cellH = this.fh + PAD + EXTRUDE * 2;
    const sheetW = cols * cellW + PAD; // PAD extra al final
    const sheetH = rows * cellH + PAD;

    const tex = this.scene.textures.createCanvas(this.key, sheetW, sheetH);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;

    let rowIndex = 0;
    for (const state of this.rows) {
      const n = this.count[state];
      for (let i = 0; i < cols; i++) {
        // origen de la “celda”
        const cellX = PAD + i * cellW;
        const cellY = PAD + rowIndex * cellH;

        // origen del frame real (dejando EXTRUDE alrededor)
        const ox = cellX + EXTRUDE;
        const oy = cellY + EXTRUDE;

        // pinta frame real (si i >= n, repite el último)
        const frameIdx = Math.min(i, n - 1);
        this.#paintFrame(ctx, state, frameIdx, n, ox, oy);

        // === extrusión de bordes (duplica borde) ===
        // top
        ctx.drawImage(tex.getSourceImage(), ox, oy, this.fw, 1, ox, oy - EXTRUDE, this.fw, EXTRUDE);
        // bottom (usa this.fh, no this.fw)
        ctx.drawImage(tex.getSourceImage(), ox, oy + this.fh - 1, this.fw, 1, ox, oy + this.fh, this.fw, EXTRUDE);
        // left
        ctx.drawImage(tex.getSourceImage(), ox, oy, 1, this.fh, ox - EXTRUDE, oy, EXTRUDE, this.fh);
        // right
        ctx.drawImage(tex.getSourceImage(), ox + this.fw - 1, oy, 1, this.fh, ox + this.fw, oy, EXTRUDE, this.fh);
      }
      rowIndex++;
    }

    tex.refresh();

    // Registrar frames usando SOLO el rectángulo del frame real (sin extrusión)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellX = PAD + c * cellW;
        const cellY = PAD + r * cellH;
        const fx = cellX + EXTRUDE;
        const fy = cellY + EXTRUDE;
        const index = r * cols + c;
        tex.add(String(index), 0, fx, fy, this.fw, this.fh);
      }
    }

    try {
      this.scene.textures.get(this.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    } catch {}
    return this.key;
  }

  createAnimations({
    fps = { idle: 6, walk: 12, jump: 10, fall: 10 },
    repeat = { idle: -1, walk: -1, jump: 0,  fall: 0  }
  } = {}) {
    const key = this.buildSheet();
    const cols = this._cols;

    const mk = (name, row, from, to, fr, rep) => {
      if (this.scene.anims.exists(name)) return;
      const frames = this.scene.anims.generateFrameNumbers(key, {
        start: row * cols + from,
        end:   row * cols + to
      });
      this.scene.anims.create({ key: name, frames, frameRate: fr, repeat: rep });
    };

    let r = 0;
    mk("idle", r++, 0, this.count.idle - 1, fps.idle, repeat.idle);
    mk("walk", r++, 0, this.count.walk - 1, fps.walk, repeat.walk);
    mk("jump", r++, 0, this.count.jump - 1, fps.jump, repeat.jump);
    mk("fall", r++, 0, this.count.fall - 1, fps.fall, repeat.fall);
    return key;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {{
   *   anim?: string,
   *   display?: {w:number, h:number},
   *   pixelPerfect?: boolean
   * }} [opts]
   */
  spawn(x, y, {
    anim = "idle",
    display = { w: 64, h: 64 }, // por defecto: tamaño nativo
    pixelPerfect = true         // escala entera por defecto (evita "pixel fantasma")
  } = {}) {
    const key = this.createAnimations();
    const s = this.scene.physics.add.sprite(x, y, key, 0)
      .setOrigin(0.5, 1)          // pivote en los pies
      .setCollideWorldBounds(false)
      .setBounce(0.05);

    if (pixelPerfect) {
      // Escala entera a partir del tamaño nativo del frame (fw, fh)
      const sx = Math.max(1, Math.round(display.w / this.fw));
      const sy = Math.max(1, Math.round(display.h / this.fh));
      s.setScale(sx, sy);
    } else {
      // Si realmente necesitas un tamaño específico (no recomendado para pixel art),
      // esto puede reintroducir artefactos de sampling:
      s.displayWidth  = display.w;
      s.displayHeight = display.h;
    }

    // Sugerencia extra: asegura roundPixels en la cámara (por si la escena no lo hizo)
    if (this.scene?.cameras?.main) {
      this.scene.cameras.main.roundPixels = true;
    }

    if (this.scene.anims.exists(anim)) s.play(anim);
    return { sprite: s, sheetKey: key, cols: this._cols };
  }

  // ───────────────────────── Render de frames ─────────────────────────
  #paintFrame(ctx, state, i, n, ox, oy) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;

    // ΔY SOLO cuando state !== "idle" (sube 2 px por defecto)
    const yOff = (state !== "idle") ? (this.bodyYOffsetNonIdle ?? -2) : 0;

    // El cuerpo y rasgos se dibujan con oyBody; la sombra puede acompañar o no.
    const oyBody   = oy + yOff;
    const oyShadow = (this.moveShadowWithBody && state !== "idle") ? oyBody : oy;

    // Dibujo en orden (sombra debajo)
    this.#shadow(ctx, ox, oyShadow, state, i, n);
    this.#catSilhouette(ctx, ox, oyBody, state, t);
    this.#face(ctx, ox, oyBody, state, t);
    this.#paws(ctx, ox, oyBody, state, t);
    this.#tail(ctx, ox, oyBody, state, t);
    this.#highlights(ctx, ox, oyBody, state, t);
  }

  // Sombra (contacto suelo)
  #shadow(ctx, ox, oy, state, i, n) {
    const w = this.fw, h = this.fh;
    const by = oy + h - 2;
    const cx = ox + (w >> 1);
    const phase =
      state === "walk" ? 1.0 :
      state === "idle" ? 0.92 + 0.08 * Math.sin((i / Math.max(1,n)) * Math.PI * 2) :
      0.85;
    const rx = Math.floor(w * 0.34 * phase);
    const ry = Math.max(2, Math.floor(h * 0.065));
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Cuerpo con “pelos”: bloque principal + pecho + bordes dentados + orejas
  #catSilhouette(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh;
    const pal = this.pal;

    const baseY = oy + Math.floor(h * 0.78); // base del cuerpo
    const cx = ox + (w >> 1);

    // leve bob
    const bob =
      state === "idle" ? Math.round(Math.sin(t) * 1) :
      state === "walk" ? Math.round(Math.sin(t * 2) * 1) :
      state === "jump" ? -2 : 1;

    // cuerpo ovoide
    const rw = Math.floor(w * 0.34);
    const rh = Math.floor(h * 0.28);

    // capa media
    ctx.fillStyle = pal.furMid;
    ctx.beginPath(); ctx.ellipse(cx, baseY + bob, rw, rh, 0, 0, Math.PI * 2); ctx.fill();

    // sombra inferior
    ctx.globalAlpha = 0.5; ctx.fillStyle = pal.furDark;
    ctx.beginPath(); ctx.ellipse(cx + 2, baseY + bob + 2, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // pecho claro
    ctx.globalAlpha = 0.85; ctx.fillStyle = pal.furLight;
    ctx.beginPath(); ctx.arc(cx - 2, baseY + bob - Math.floor(rh * 0.4), Math.floor(rh * 0.85), 0, Math.PI * 2);
    ctx.fill(); ctx.globalAlpha = 1;

    // “pelos” dentados (bordes)
    ctx.fillStyle = pal.furMid;
    const spikes = 8;
    for (let s = 0; s < spikes; s++) {
      const sx = cx - rw + 2 + Math.floor((2 * rw - 4) * (s / (spikes - 1)));
      const sy = baseY + bob - rh + 2 + ((s & 1) ? 2 : 0);
      ctx.fillRect(sx, sy, 2, 3);
    }

    // orejas (triángulos)
    this.#ears(ctx, cx, baseY + bob, rw, rh);
  }

  #ears(ctx, cx, baseY, rw, rh) {
    const pal = this.pal;
    const earH = Math.max(4, Math.floor(rh * 0.9));
    const earW = Math.max(4, Math.floor(rw * 0.7));
    const topY = baseY - rh - 4;

    // izquierda
    ctx.fillStyle = pal.furMid;
    ctx.beginPath();
    ctx.moveTo(cx - rw + 4, topY + 2);
    ctx.lineTo(cx - rw + 4 + earW, topY - earH);
    ctx.lineTo(cx - rw + 6 + earW, topY + 2);
    ctx.closePath(); ctx.fill();

    // derecha
    ctx.beginPath();
    ctx.moveTo(cx + rw - 4, topY + 2);
    ctx.lineTo(cx + rw - 4 - earW, topY - earH);
    ctx.lineTo(cx + rw - 6 - earW, topY + 2);
    ctx.closePath(); ctx.fill();

    // interior orejas
    ctx.fillStyle = pal.earIn;
    ctx.fillRect(cx - rw + 6, topY - Math.floor(earH * 0.55), Math.max(2, earW - 4), 3);
    ctx.fillRect(cx + rw - 6 - Math.max(2, earW - 4), topY - Math.floor(earH * 0.55), Math.max(2, earW - 4), 3);
  }

  #face(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.63);

    // ojos (forma “enojada”)
    const squint = this.angryEyes ? 1 : 0;
    const eyeDx = 9, eyeH = 3 - squint, eyeW = 6 + squint;

    ctx.fillStyle = pal.eye;
    ctx.fillRect(cx - eyeDx - eyeW + 1, cy - 2, eyeW, eyeH);
    ctx.fillRect(cx + eyeDx - 1,         cy - 2, eyeW, eyeH);

    // iris ámbar
    ctx.fillStyle = pal.iris;
    ctx.fillRect(cx - eyeDx - 2, cy - 1, 3, 2 - squint);
    ctx.fillRect(cx + eyeDx + 0, cy - 1, 3, 2 - squint);

    // ceño
    ctx.fillStyle = pal.furDark;
    ctx.fillRect(cx - eyeDx - eyeW + 1, cy - 3, eyeW, 1);
    ctx.fillRect(cx + eyeDx - 1,         cy - 3, eyeW, 1);

    // nariz y boca
    ctx.fillStyle = pal.nose;  ctx.fillRect(cx - 1, cy + 0, 2, 1);
    ctx.fillStyle = pal.mouth; ctx.fillRect(cx - 1, cy + 2, 2, 1);

    // bigotes
    ctx.fillStyle = pal.whisker;
    for (let k = -1; k <= 1; k++) {
      ctx.fillRect(cx - 12, cy + 1 + k, 6, 1);
      ctx.fillRect(cx + 6,  cy + 1 + k, 6, 1);
    }
  }

  #paws(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const baseY = oy + Math.floor(h * 0.86);
    const swing = (state === "walk") ? Math.sin(t * 2) * 3 : 0;

    ctx.fillStyle = pal.furDark;
    // patas delanteras
    ctx.fillRect(ox + Math.floor(w * 0.30) - Math.round(swing), baseY, 5, 3);
    ctx.fillRect(ox + Math.floor(w * 0.58) + Math.round(swing), baseY, 5, 3);
    // traseras (ligeramente separadas)
    ctx.fillRect(ox + Math.floor(w * 0.22) + Math.round(swing*0.5), baseY, 5, 3);
    ctx.fillRect(ox + Math.floor(w * 0.68) - Math.round(swing*0.5), baseY, 5, 3);
  }

  #tail(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const base = { x: ox + Math.floor(w * 0.78), y: oy + Math.floor(h * 0.70) };

    // oscilación
    const phase =
      state === "idle" ? Math.sin(t) * 2 :
      state === "walk" ? Math.sin(t * 2) * 4 :
      state === "jump" ? -3 : 1;

    // segmento 1
    ctx.fillStyle = pal.furMid;
    ctx.fillRect(base.x, base.y - 2, 6, 2);
    // segmento 2 (curva)
    ctx.fillRect(base.x + 5, base.y - 3 - Math.round(phase * 0.5), 5, 2);
    // punta
    ctx.fillStyle = pal.furLight;
    ctx.fillRect(base.x + 9, base.y - 4 - Math.round(phase * 0.8), 3, 2);
  }

  #highlights(ctx, ox, oy, _state, _t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    ctx.globalAlpha = 0.22; ctx.fillStyle = pal.glow;
    ctx.beginPath(); ctx.arc(cx - 10, oy + Math.floor(h * 0.58), 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
