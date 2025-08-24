// Phaser 3.60+ — Estrella procedimental (idle, walk, jump, fall) sin assets.
// Mantiene: anti-bleed (extrusión), offset vertical en NO-idle, pixel-perfect,
// sombra dinámica y "twinkle" (parpadeo/brillo).
//
// Uso típico:
// const starFactory = new ProceduralStarFactory(this, { fw:64, fh:64 }).spawn(x, y, { anim:"idle" });

import Phaser from "phaser";

const STAR_PAL = {
  core:     "#ffd54a", // amarillo principal
  mid:      "#ffb300", // tono medio
  dark:     "#c98200", // sombra
  glow:     "#fff7c2", // brillo alto
  shadow:   "#000000", // sombra suelo
  eye:      "#1b1b1b", // (opcional) ojos
  mouth:    "#3a2a2a"  // (opcional) boca
};

export default class PlayerCharacter {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.fw=64]  Ancho frame
   * @param {number} [opts.fh=64]  Alto frame
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string}  [opts.keyPrefix="star"]
   * @param {Partial<typeof STAR_PAL>} [opts.palette]
   * @param {number}  [opts.bodyYOffsetNonIdle=-2] ΔY cuando state !== "idle"
   * @param {boolean} [opts.moveShadowWithBody=true] Sombra acompaña ΔY
   * @param {number}  [opts.extrude=2] Extrusión px
   * @param {number}  [opts.pad=2]     Padding entre celdas
   * @param {boolean} [opts.face=false] Dibuja ojos/boca
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "star",
    palette = {},
    bodyYOffsetNonIdle = -2,
    moveShadowWithBody = true,
    extrude = 2,
    pad = 2,
    face = false
  } = {}) {
    this.scene = scene;
    this.fw = fw;
    this.fh = fh;

    this.bodyYOffsetNonIdle = bodyYOffsetNonIdle;
    this.moveShadowWithBody = moveShadowWithBody;

    this.EXTRUDE = Math.max(1, extrude);
    this.PAD = Math.max(1, pad);

    this.pal = { ...STAR_PAL, ...palette };
    this.face = face;

    // Defaults alineados a tu controller
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
      `-yo${this.bodyYOffsetNonIdle}-${this.moveShadowWithBody ? 'smove' : 'sfixed'}-ex${this.EXTRUDE}-pd${this.PAD}` +
      `${this.face ? '-face' : ''}`;
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

        // Extrusión (anti-bleed)
        ctx.drawImage(tex.getSourceImage(), ox, oy, this.fw, 1, ox, oy - EX, this.fw, EX);                         // top
        ctx.drawImage(tex.getSourceImage(), ox, oy + this.fh - 1, this.fw, 1, ox, oy + this.fh, this.fw, EX);       // bottom
        ctx.drawImage(tex.getSourceImage(), ox, oy, 1, this.fh, ox - EX, oy, EX, this.fh);                          // left
        ctx.drawImage(tex.getSourceImage(), ox + this.fw - 1, oy, 1, this.fh, ox + this.fw, oy, EX, this.fh);       // right
      }
      rowIndex++;
    }

    tex.refresh();

    // Registra frames (sin extrusión)
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

    // ΔY: subir 2px en NO-idle
    const yOff = (state !== "idle") ? (this.bodyYOffsetNonIdle ?? -2) : 0;

    const oyBody   = oy + yOff;
    const oyShadow = (this.moveShadowWithBody && state !== "idle") ? oyBody : oy;

    this.#shadow(ctx, ox, oyShadow, state, i, n);
    this.#star(ctx, ox, oyBody, state, t, i, n);
 
  }

  // Sombra dependiente del squash
  #shadow(ctx, ox, oy, state, i, n) {
    const w = this.fw, h = this.fh;
    const by = oy + h - 2;
    const cx = ox + (w >> 1);
    const { sx, sy } = this.#poseStretch(state, i, n);
    const base = 0.30;
    const rx = Math.max(6, Math.floor(w * (base + (1 - sy) * 0.12)));
    const ry = Math.max(2, Math.floor(h * 0.06));
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Estrella de 5 puntas con capas y “twinkle”
  #star(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.78);

    const { sx, sy, bobY, rot } = this.#pose(state, t, i, n);

    // Radios base
    const R = Math.floor(Math.min(w, h) * 0.28);   // radio exterior
    const r = Math.floor(R * 0.46);                // radio interior
    const Rx = Math.max(6, Math.floor(R * sx));
    const Ry = Math.max(6, Math.floor(R * sy));
    const cx2 = cx, cy2 = baseY + bobY;

    // Capa sombra (ligeramente desplazada)
    ctx.fillStyle = pal.dark;
    this.#starPath(ctx, cx2 + 1, cy2 + 2, Rx, Ry, r, rot);
    ctx.fill();

    // Capa media (tono medio)
    ctx.fillStyle = pal.mid;
    this.#starPath(ctx, cx2, cy2, Math.floor(Rx * 0.98), Math.floor(Ry * 0.98), Math.floor(r * 0.98), rot);
    ctx.fill();

    // Capa clara
    ctx.fillStyle = pal.core;
    this.#starPath(ctx, cx2, cy2 - 1, Math.floor(Rx * 0.92), Math.floor(Ry * 0.92), Math.floor(r * 0.92), rot);
    ctx.fill();

    // Highlight central suave
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = pal.glow;
    ctx.beginPath(); ctx.ellipse(cx2 - 6, cy2 - Math.floor(Ry * 0.4), Math.floor(Rx * 0.30), Math.floor(Ry * 0.20), 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Dibuja la estrella de 5 puntas (deformada en X/Y para squash)
  #starPath(ctx, cx, cy, Rx, Ry, r, rotRad) {
    ctx.beginPath();
    const points = 5;
    for (let k = 0; k < points * 2; k++) {
      const angle = rotRad + (Math.PI / points) * k;
      const radius = (k % 2 === 0) ? 1 : (r / Math.max(Rx, Ry));
      // convertimos a coordenadas con squash distinto en X/Y
      const rr = (k % 2 === 0) ? 1 : (r / Math.max(Rx, Ry));
      const Ruse = (k % 2 === 0) ? 1 : rr;
      const x = cx + Math.cos(angle) * (k % 2 === 0 ? Rx : r);
      const y = cy + Math.sin(angle) * (k % 2 === 0 ? Ry : Math.floor(r * (Ry / Rx)));
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Brillo “twinkle” perimetral
  #glow(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.70);
    const amp = 0.12 + 0.06 * Math.sin(t * 2.3);
    ctx.globalAlpha = 0.18 + 0.10 * Math.abs(Math.sin(t * 1.8));
    ctx.fillStyle = pal.glow;
    ctx.beginPath(); ctx.ellipse(cx - 10, cy - 8, Math.floor(w * 0.10 * (1 + amp)), Math.floor(h * 0.06 * (1 + amp)), 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Carita (opcional)
  #face(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.64);
    const blink = (state === "idle") ? (0.8 + 0.2 * Math.sin(t * 2.1)) : 1;

    // Ojos
    ctx.fillStyle = pal.eye;
    ctx.beginPath(); ctx.ellipse(cx - 6, cy, Math.max(1, Math.floor(2 * blink)), Math.max(1, Math.floor(2 * blink)), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 6, cy, Math.max(1, Math.floor(2 * blink)), Math.max(1, Math.floor(2 * blink)), 0, 0, Math.PI * 2); ctx.fill();

    // Boca
    ctx.fillStyle = pal.mouth;
    ctx.fillRect(cx - 3, cy + 4, 6, 1);
  }

  // Pose por estado: stretch + bob + rotación sutil
  #pose(state, t, i, n) {
    // Wobble base (twinkle)
    const wob = Math.sin(t) * 0.06; // ±6%
    let sx = 1 + wob;
    let sy = 1 - wob;
    let bobY = 0;
    let rot = 0;

    if (state === "idle") {
      bobY = Math.round(Math.sin(t) * 1);
      rot = Math.sin(t * 0.8) * 0.05; // ~3°
      return { sx, sy, bobY, rot };
    }

    if (state === "walk") {
      const phase = Math.sin(t * 2);
      sx = 1 + 0.12 * phase;
      sy = 1 - 0.12 * phase;
      bobY = Math.round(Math.sin(t * 2) * 1);
      rot = phase * 0.08; // ~5°
      return { sx, sy, bobY, rot };
    }

    if (state === "jump") {
      const k = i / Math.max(1, n - 1);
      const up = Math.sin(k * Math.PI);
      sx = 1 - 0.16 * up;
      sy = 1 + 0.20 * up;
      bobY = -2;
      rot = up * 0.10; // leve giro en el aire
      return { sx, sy, bobY, rot };
    }

    // fall
    {
      const k = i / Math.max(1, n - 1);
      const down = Math.sin(k * Math.PI);
      sx = 1 + 0.18 * down;
      sy = 1 - 0.16 * down;
      if (k > 0.8) {
        const f = (k - 0.8) / 0.2;
        sx += 0.08 * f; sy -= 0.08 * f; // splash horizontal
      }
      bobY = 1;
      rot = -down * 0.06;
      return { sx, sy, bobY, rot };
    }
  }

  // Solo para sombra
  #poseStretch(state, i, n) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;
    if (state === "idle") {
      const wob = Math.sin(t) * 0.06; return { sx: 1 + wob, sy: 1 - wob };
    }
    if (state === "walk") {
      const phase = Math.sin(t * 2);  return { sx: 1 + 0.12 * phase, sy: 1 - 0.12 * phase };
    }
    if (state === "jump") {
      const k = i / Math.max(1, n - 1), up = Math.sin(k * Math.PI);
      return { sx: 1 - 0.16 * up, sy: 1 + 0.20 * up };
    }
    const k = i / Math.max(1, n - 1), down = Math.sin(k * Math.PI);
    let sx = 1 + 0.18 * down, sy = 1 - 0.16 * down;
    if (k > 0.8) { const f = (k - 0.8) / 0.2; sx += 0.08 * f; sy -= 0.08 * f; }
    return { sx, sy };
  }
}
