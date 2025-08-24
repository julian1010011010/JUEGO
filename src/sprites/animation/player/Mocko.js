// Phaser 3.60+ — Slime gelatinoso procedimental (idle, walk, jump, fall).
// Sin assets: se pinta en un canvas de textura con extrusión y padding anti-bleed.
// Características:
//  - Squash & Stretch por estado (idle wobble suave; walk balanceo lateral; jump estira; fall comprime y "aterriza").
//  - Offset vertical: sube 2 px en TODOS los estados EXCEPTO idle (como tu gato).
//  - Escala entera (pixelPerfect) para evitar “pixel fantasma”.
//  - Extrusión = 2 px; PAD = 2 px.
//  - Sombra dinámica según squash.
// Uso: new ProceduralSlimeFactory(scene, {...}).spawn(x, y, { anim: "walk" });

import Phaser from "phaser";

// Paleta verde brillante tipo gel
const SLIME_PAL = {
  body:    "#17d21f", // verde principal
  body2:   "#0fb51a", // sombra interna
  edge:    "#0b7d12", // borde/contorno sutil
  glow:    "#a6ff9f", // brillo alto
  core:    "#0a8a10", // núcleo
  shadow:  "#000000"  // sombra suelo
};

export default class PlayerMocko {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.fw=64]  Ancho frame
   * @param {number} [opts.fh=64]  Alto  frame
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string}  [opts.keyPrefix="slime"]
   * @param {Partial<typeof SLIME_PAL>} [opts.palette]
   * @param {number}  [opts.bodyYOffsetNonIdle=-2] ΔY cuando state !== "idle"
   * @param {boolean} [opts.moveShadowWithBody=true] Sombra acompaña ΔY
   * @param {number}  [opts.extrude=2] Extrusión px
   * @param {number}  [opts.pad=2]     Padding entre celdas
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "slime",
    palette = {},
    bodyYOffsetNonIdle = -2,
    moveShadowWithBody = true,
    extrude = 2,
    pad = 2
  } = {}) {
    this.scene = scene;
    this.fw = fw;
    this.fh = fh;

    this.bodyYOffsetNonIdle = bodyYOffsetNonIdle;
    this.moveShadowWithBody = moveShadowWithBody;

    this.EXTRUDE = Math.max(1, extrude);
    this.PAD = Math.max(1, pad);

    this.pal = { ...SLIME_PAL, ...palette };

    this.count = {
      idle: frames?.idle ?? 6,
      walk: frames?.walk ?? 8,
      jump: frames?.jump ?? 6,
      fall: frames?.fall ?? 6
    };

    this.rows = ["idle", "walk", "jump", "fall"];
    this._cols = Math.max(this.count.idle, this.count.walk, this.count.jump, this.count.fall);

    this.key =
      `${keyPrefix}-${fw}x${fh}-i${this.count.idle}-w${this.count.walk}-j${this.count.jump}-f${this.count.fall}` +
      `-yo${this.bodyYOffsetNonIdle}-${this.moveShadowWithBody ? 'smove' : 'sfixed'}-ex${this.EXTRUDE}-pd${this.PAD}`;
  }

  // ───────────────────────── Sheet & anims ─────────────────────────
  buildSheet() {
    if (this.scene.textures.exists(this.key)) return this.key;

    const cols = this._cols, rows = this.rows.length;
    const PAD = this.PAD, EX = this.EXTRUDE;

    const cellW = this.fw + PAD + EX * 2;
    const cellH = this.fh + PAD + EX * 2;
    const sheetW = cols * cellW + PAD;
    const sheetH = rows * cellH + PAD;

    const tex = this.scene.textures.createCanvas(this.key, sheetW, sheetH);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;

    let rowIndex = 0;
    for (const state of this.rows) {
      const n = this.count[state];
      for (let i = 0; i < cols; i++) {
        const cellX = PAD + i * cellW;
        const cellY = PAD + rowIndex * cellH;

        const ox = cellX + EX;
        const oy = cellY + EX;

        const frameIdx = Math.min(i, n - 1);
        this.#paintFrame(ctx, state, frameIdx, n, ox, oy);

        // Extrusión 2D
        // top
        ctx.drawImage(tex.getSourceImage(), ox, oy, this.fw, 1, ox, oy - EX, this.fw, EX);
        // bottom
        ctx.drawImage(tex.getSourceImage(), ox, oy + this.fh - 1, this.fw, 1, ox, oy + this.fh, this.fw, EX);
        // left
        ctx.drawImage(tex.getSourceImage(), ox, oy, 1, this.fh, ox - EX, oy, EX, this.fh);
        // right
        ctx.drawImage(tex.getSourceImage(), ox + this.fw - 1, oy, 1, this.fh, ox + this.fw, oy, EX, this.fh);
      }
      rowIndex++;
    }

    tex.refresh();

    // Registra los frames (sin extrusión)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellX = PAD + c * cellW;
        const cellY = PAD + r * cellH;
        const fx = cellX + EX;
        const fy = cellY + EX;
        const index = r * cols + c;
        tex.add(String(index), 0, fx, fy, this.fw, this.fh);
      }
    }

    try { this.scene.textures.get(this.key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}
    return this.key;
  }

  createAnimations({
    fps = { idle: 8, walk: 12, jump: 12, fall: 12 },
    repeat = { idle: -1, walk: -1, jump: 0, fall: 0 }
  } = {}) {
    const key = this.buildSheet();
    const cols = this._cols;

    const mk = (name, row, from, to, fr, rep) => {
      if (this.scene.anims.exists(name)) return;
      const frames = this.scene.anims.generateFrameNumbers(key, { start: row * cols + from, end: row * cols + to });
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
    display = { w: 64, h: 64 },
    pixelPerfect = true
  } = {}) {
    const key = this.createAnimations();
    const s = this.scene.physics.add.sprite(x, y, key, 0)
      .setOrigin(0.5, 1)
      .setCollideWorldBounds(false)
      .setBounce(0.05);

    if (pixelPerfect) {
      const sx = Math.max(1, Math.round(display.w / this.fw));
      const sy = Math.max(1, Math.round(display.h / this.fh));
      s.setScale(sx, sy);
    } else {
      s.displayWidth  = display.w;
      s.displayHeight = display.h;
    }

    if (this.scene?.cameras?.main) this.scene.cameras.main.roundPixels = true;

    if (this.scene.anims.exists(anim)) s.play(anim);
    return { sprite: s, sheetKey: key, cols: this._cols };
  }

  // ───────────────────────── Render por frame ─────────────────────────
  #paintFrame(ctx, state, i, n, ox, oy) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;

    // ΔY: subir 2px en todo menos idle
    const yOff = (state !== "idle") ? (this.bodyYOffsetNonIdle ?? -2) : 0;

    const oyBody   = oy + yOff;
    const oyShadow = (this.moveShadowWithBody && state !== "idle") ? oyBody : oy;

    this.#shadow(ctx, ox, oyShadow, state, i, n);
    this.#slimeBody(ctx, ox, oyBody, state, t, i, n);
    this.#speculars(ctx, ox, oyBody, state, t);
  }

  // Sombra elíptica dinámica
  #shadow(ctx, ox, oy, state, i, n) {
    const w = this.fw, h = this.fh;
    const by = oy + h - 2;
    const cx = ox + (w >> 1);

    // La sombra se estrecha cuando hay stretch vertical y se ensancha cuando hay squash
    const stateStretch = this.#stretchFactor(state, i, n); // {sx, sy}
    const base = 0.32;
    const rx = Math.max(6, Math.floor(w * (base + (1 - stateStretch.sy) * 0.10))); // más ancho si sy < 1 (squash)
    const ry = Math.max(2, Math.floor(h * 0.06));

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Cuerpo gelatinoso con squash & stretch + wobble retardado
  #slimeBody(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.78);

    // Stretch/squash por estado
    const { sx, sy, bobY, tiltX } = this.#slimePose(state, t, i, n);

    // Dimensiones base
    const rw = Math.floor(w * 0.30);
    const rh = Math.floor(h * 0.26);

    // Contorno / base deformada (aplico scale no afín: simulo con anchos/altos)
    const bodyW = Math.max(6, Math.floor(rw * 2 * sx));
    const bodyH = Math.max(6, Math.floor(rh * 2 * sy));
    const cy = baseY + bobY;

    // Capa base (gel)
    ctx.fillStyle = pal.body2;
    ctx.beginPath();
    ctx.ellipse(cx + tiltX, cy, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Capa media (color principal)
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1, Math.floor(bodyW * 0.94) / 2, Math.floor(bodyH * 0.94) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Volúmenes laterales tipo “brazos” gelatinosos (relativos a tilt)
    const armY = cy - Math.floor(bodyH * 0.15);
    const armR = Math.max(2, Math.floor(bodyW * 0.16));
    ctx.fillStyle = pal.body;
    // izquierdo
    ctx.beginPath();
    ctx.ellipse(cx - Math.floor(bodyW * 0.45) + Math.round(tiltX * 0.4), armY, armR, Math.floor(armR * 0.7), 0, 0, Math.PI * 2);
    ctx.fill();
    // derecho
    ctx.beginPath();
    ctx.ellipse(cx + Math.floor(bodyW * 0.45) + Math.round(tiltX * 0.4), armY + 1, armR, Math.floor(armR * 0.7), 0, 0, Math.PI * 2);
    ctx.fill();

    // “Pico” superior (como en la referencia) — pequeño lóbulo
    ctx.beginPath();
    ctx.ellipse(cx - Math.floor(bodyW * 0.18), cy - Math.floor(bodyH * 0.55), Math.floor(bodyW * 0.18), Math.floor(bodyH * 0.18), 0, 0, Math.PI * 2);
    ctx.fill();

    // Borde inferior ligeramente más oscuro
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pal.edge;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 2, Math.floor(bodyW * 0.92) / 2, Math.floor(bodyH * 0.86) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Núcleo más denso (sugiere profundidad)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.ellipse(cx + Math.floor(bodyW * 0.10), cy + Math.floor(bodyH * -0.12), Math.floor(bodyW * 0.45) / 2, Math.floor(bodyH * 0.40) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Brillos y highlights animados
  #speculars(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.60);

    // Highlight principal
    ctx.globalAlpha = 0.28 + 0.06 * Math.sin(t * 1.7);
    ctx.fillStyle = pal.glow;
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy - 6, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Burbujas internas sutiles
    ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.ellipse(cx + 6, cy - 10, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 2, cy - 2,  1, 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 4, cy - 12, 1, 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Factores de estiramiento por estado + bob y tilt
  #slimePose(state, t, i, n) {
    // Wobble base
    const wob = Math.sin(t) * 0.08; // ±8%
    let sx = 1 + wob;
    let sy = 1 - wob;

    // Ajustes por estado
    if (state === "idle") {
      // Wobble suave vertical
      const bobY = Math.round(Math.sin(t) * 1);
      return { sx, sy, bobY, tiltX: 0 };
    }

    if (state === "walk") {
      // Balanceo lateral y bob más rápido
      const phase = Math.sin(t * 2);
      sx = 1 + 0.12 * phase;   // se ensancha y estrecha
      sy = 1 - 0.12 * phase;
      const bobY = Math.round(Math.sin(t * 2) * 1);
      const tiltX = Math.round(phase * 2); // ligero “inclinadito”
      return { sx, sy, bobY, tiltX };
    }

    if (state === "jump") {
      // Estira vertical al despegar
      const k = i / Math.max(1, n - 1); // 0→1
      const up = Math.sin(k * Math.PI); // campana
      sx = 1 - 0.18 * up;
      sy = 1 + 0.25 * up;
      const bobY = -2; // sube un toquecito
      const tiltX = 0;
      return { sx, sy, bobY, tiltX };
    }

    // fall
    {
      // Comprime vertical al caer (y se “aplana” en los últimos frames)
      const k = i / Math.max(1, n - 1);
      const down = Math.sin(k * Math.PI);
      sx = 1 + 0.20 * down;
      sy = 1 - 0.18 * down;
      // En el último 20% añade “splash”
      if (k > 0.8) {
        const f = (k - 0.8) / 0.2; // 0→1
        sx += 0.10 * f;
        sy -= 0.10 * f;
      }
      const bobY = 1; // cae un pelín
      const tiltX = 0;
      return { sx, sy, bobY, tiltX };
    }
  }

  // Utilidad solo para sombra (si la quisieras usar fuera)
  #stretchFactor(state, i, n) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;
    if (state === "idle") {
      const wob = Math.sin(t) * 0.08;
      return { sx: 1 + wob, sy: 1 - wob };
    }
    if (state === "walk") {
      const phase = Math.sin(t * 2);
      return { sx: 1 + 0.12 * phase, sy: 1 - 0.12 * phase };
    }
    if (state === "jump") {
      const k = i / Math.max(1, n - 1);
      const up = Math.sin(k * Math.PI);
      return { sx: 1 - 0.18 * up, sy: 1 + 0.25 * up };
    }
    // fall
    const k = i / Math.max(1, n - 1);
    const down = Math.sin(k * Math.PI);
    let sx = 1 + 0.20 * down;
    let sy = 1 - 0.18 * down;
    if (k > 0.8) { // splash final
      const f = (k - 0.8) / 0.2;
      sx += 0.10 * f;
      sy -= 0.10 * f;
    }
    return { sx, sy };
  }
}
