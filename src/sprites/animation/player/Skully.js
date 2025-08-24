// Phaser 3.60+ — Calavera procedimental (idle, walk, jump, fall) sin assets.
// Mantiene el pipeline: anti-bleed (extrusión), offset vertical en NO-idle, pixel-perfect,
// sombra dinámica y animación de mandíbula (jaw) + glow en ojos.

// Uso típico:
// const skull = new ProceduralSkullFactory(this, { fw:64, fh:64 }).spawn(200, 300, { anim: "idle" });
// skull.sprite.play("walk");

import Phaser from "phaser";

const SKULL_PAL = {
  bone:     "#e8e4da", // hueso base
  boneDark: "#b7b1a4", // sombra hueso
  crack:    "#887f73", // fisuras
  eyeGlow:  "#ff3b30", // brillo de ojos (rojo)
  eyeCore:  "#6b0a0a", // núcleo del ojo
  teeth:    "#f5f2ea", // dientes
  shadow:   "#000000"  // sombra en piso
};

export default class PlayerCharacter {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.fw=64]  Ancho del frame
   * @param {number} [opts.fh=64]  Alto del frame
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string}  [opts.keyPrefix="skull"]
   * @param {Partial<typeof SKULL_PAL>} [opts.palette]
   * @param {number}  [opts.bodyYOffsetNonIdle=-2] ΔY cuando state !== "idle"
   * @param {boolean} [opts.moveShadowWithBody=true] Sombra acompaña ΔY
   * @param {number}  [opts.extrude=2] Extrusión px
   * @param {number}  [opts.pad=2]     Padding entre celdas
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "skull",
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

    this.pal = { ...SKULL_PAL, ...palette };

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

        // Extrusión 2D (anti-bleed)
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
    this.#skull(ctx, ox, oyBody, state, t, i, n);
    this.#eyes(ctx, ox, oyBody, state, t, i, n);
    this.#jaw(ctx, ox, oyBody, state, t, i, n);
    this.#cracks(ctx, ox, oyBody, state, t);
  }

  // Sombra en piso
  #shadow(ctx, ox, oy, state, i, n) {
    const w = this.fw, h = this.fh;
    const by = oy + h - 2;
    const cx = ox + (w >> 1);

    const { sx, sy } = this.#stretchByState(state, i, n);
    const base = 0.30;
    const rx = Math.max(6, Math.floor(w * (base + (1 - sy) * 0.12))); // ensancha cuando hay squash
    const ry = Math.max(2, Math.floor(h * 0.06));

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Cráneo principal (ovoide + pómulos)
  #skull(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.74);

    const pose = this.#pose(state, t, i, n);
    const sx = pose.sx, sy = pose.sy, bobY = pose.bobY ?? 0, tiltX = pose.tiltX ?? 0;

    // Dimensiones base
    const rw = Math.floor(w * 0.30);
    const rh = Math.floor(h * 0.26);

    const skullW = Math.max(8, Math.floor(rw * 2 * sx));
    const skullH = Math.max(8, Math.floor(rh * 2 * sy));
    const cy = baseY + bobY;

    // Sombra interior
    ctx.fillStyle = pal.boneDark;
    ctx.beginPath();
    ctx.ellipse(cx + 1 + tiltX, cy + 2, Math.floor(skullW * 0.98)/2, Math.floor(skullH * 0.98)/2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Volumen hueso
    ctx.fillStyle = pal.bone;
    ctx.beginPath();
    ctx.ellipse(cx + tiltX, cy, skullW/2, skullH/2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pómulos (cheekbones)
    ctx.fillStyle = pal.bone;
    const cheekR = Math.max(2, Math.floor(skullW * 0.18));
    ctx.beginPath(); ctx.ellipse(cx - Math.floor(skullW*0.32), cy + Math.floor(skullH*0.02), cheekR, Math.floor(cheekR*0.8), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + Math.floor(skullW*0.32), cy + Math.floor(skullH*0.02), cheekR, Math.floor(cheekR*0.8), 0, 0, Math.PI * 2); ctx.fill();

    // Cavidad nasal (triángulo invertido/ovalo)
    ctx.fillStyle = pal.boneDark;
    ctx.beginPath();
    ctx.ellipse(cx + tiltX, cy, Math.max(2, Math.floor(skullW*0.07)), Math.max(3, Math.floor(skullH*0.18)), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ojos con glow (brillan + leve latido)
  #eyes(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.60);

    const pulse = 0.85 + 0.15 * Math.sin(t * 2.0);
    const dx = 10;

    // Glow
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = pal.eyeGlow;
    ctx.beginPath(); ctx.ellipse(cx - dx, baseY, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + dx, baseY, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Núcleo
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.eyeCore;
    ctx.beginPath(); ctx.ellipse(cx - dx, baseY, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + dx, baseY, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Mandíbula inferior con vibración/charla en walk y squash en aterrizaje
  #jaw(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.80);

    let vib = 0;
    if (state === "walk") vib = Math.round(Math.sin(t * 8) * 1); // chatter rápido
    if (state === "fall") {
      const k = i / Math.max(1, n - 1);
      if (k > 0.8) vib = Math.round((k - 0.8) * 10); // “temblor” al caer
    }

    // Dientes/mandíbula (rectángulo redondeado simulado con elipse aplastada)
    ctx.fillStyle = pal.teeth;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + vib, Math.floor(w * 0.20), Math.floor(h * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();

    // Separación dentaria (líneas verticales sutiles)
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pal.boneDark;
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(cx + k * 4, baseY + vib - 2, 1, 4);
    }
    ctx.globalAlpha = 1;
  }

  // Fisuras/fallas del hueso
  #cracks(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.68);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pal.crack;

    // fisura diagonal izquierda
    ctx.fillRect(cx - 8, cy - 6, 1, 5);
    ctx.fillRect(cx - 7, cy - 3, 1, 3);
    // fisura derecha
    ctx.fillRect(cx + 7, cy - 5, 1, 4);
    ctx.fillRect(cx + 6, cy - 2, 1, 2);

    ctx.globalAlpha = 1;
  }

  // Postura (squash & stretch + bob + tilt) por estado
  #pose(state, t, i, n) {
    // wobble base
    const wob = Math.sin(t) * 0.06; // ±6%
    let sx = 1 + wob;
    let sy = 1 - wob;
    let bobY = 0, tiltX = 0;

    if (state === "idle") {
      bobY = Math.round(Math.sin(t) * 1);
      return { sx, sy, bobY, tiltX };
    }

    if (state === "walk") {
      const phase = Math.sin(t * 2);
      sx = 1 + 0.10 * phase;
      sy = 1 - 0.10 * phase;
      bobY = Math.round(Math.sin(t * 2) * 1);
      tiltX = Math.round(phase * 1.5);
      return { sx, sy, bobY, tiltX };
    }

    if (state === "jump") {
      const k = i / Math.max(1, n - 1);
      const up = Math.sin(k * Math.PI);
      sx = 1 - 0.14 * up;
      sy = 1 + 0.18 * up;
      bobY = -2;
      return { sx, sy, bobY, tiltX };
    }

    // fall
    {
      const k = i / Math.max(1, n - 1);
      const down = Math.sin(k * Math.PI);
      sx = 1 + 0.16 * down;
      sy = 1 - 0.14 * down;
      if (k > 0.8) {
        const f = (k - 0.8) / 0.2;
        sx += 0.08 * f;   // splash horizontal
        sy -= 0.08 * f;   // squash extra
      }
      bobY = 1;
      return { sx, sy, bobY, tiltX };
    }
  }

  // Simplificado para sombra
  #stretchByState(state, i, n) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;
    if (state === "idle") {
      const wob = Math.sin(t) * 0.06; return { sx: 1 + wob, sy: 1 - wob };
    }
    if (state === "walk") {
      const phase = Math.sin(t * 2);  return { sx: 1 + 0.10 * phase, sy: 1 - 0.10 * phase };
    }
    if (state === "jump") {
      const k = i / Math.max(1, n - 1), up = Math.sin(k * Math.PI);
      return { sx: 1 - 0.14 * up, sy: 1 + 0.18 * up };
    }
    const k = i / Math.max(1, n - 1), down = Math.sin(k * Math.PI);
    let sx = 1 + 0.16 * down, sy = 1 - 0.14 * down;
    if (k > 0.8) { const f = (k - 0.8) / 0.2; sx += 0.08 * f; sy -= 0.08 * f; }
    return { sx, sy };
  }
}
