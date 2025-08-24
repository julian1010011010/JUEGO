// Phaser 3.60+ — "Pinky" procedimental (idle, walk, jump, fall) sin assets.
// Círculo rosado con boca de cuña (chomp), ojo simple y squash & stretch.
// Mantiene: anti-bleed (extrusión), offset vertical en NO-idle, pixel-perfect.

import Phaser from "phaser";

const PINKY_PAL = {
  body:     "#f57fb5", // rosa principal
  bodyDark: "#cc6193", // sombra
  bodyLight:"#ffb7da", // brillo
  eye:      "#1b1b1b", // contorno ojo
  pupil:    "#ffffff", // pupila/blanco
  mouth:    "#2a0f1a", // interior boca
  shadow:   "#000000"
};

export default class ProceduralPinkyFactory {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.fw=64]  Ancho frame
   * @param {number} [opts.fh=64]  Alto frame
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string}  [opts.keyPrefix="pinky"]
   * @param {Partial<typeof PINKY_PAL>} [opts.palette]
   * @param {number}  [opts.bodyYOffsetNonIdle=-2] ΔY cuando state !== "idle"
   * @param {boolean} [opts.moveShadowWithBody=true] Sombra acompaña ΔY
   * @param {number}  [opts.extrude=2] Extrusión px
   * @param {number}  [opts.pad=2]     Padding px entre celdas
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "pinky",
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

    this.pal = { ...PINKY_PAL, ...palette };

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
    this.#pinky(ctx, ox, oyBody, state, t, i, n);
    this.#eye(ctx, ox, oyBody, state, t);
    this.#highlights(ctx, ox, oyBody, state, t);
  }

  // Sombra elíptica dependiente del squash
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

  // Cuerpo circular + boca tipo cuña
  #pinky(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.78);

    const { sx, sy, bobY, mouthOpen, tiltX } = this.#pose(state, t, i, n);

    const radius = Math.floor(Math.min(w, h) * 0.26);
    const rx = Math.max(6, Math.floor(radius * sx * 2)) / 2;
    const ry = Math.max(6, Math.floor(radius * sy * 2)) / 2;
    const cy = baseY + bobY;

    // Sombra interior
    ctx.fillStyle = pal.bodyDark;
    ctx.beginPath(); ctx.ellipse(cx + 1 + tiltX, cy + 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

    // Círculo principal
    ctx.fillStyle = pal.body;
    ctx.beginPath(); ctx.ellipse(cx + tiltX, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

    // Boca tipo cuña: “mordida” en el círculo
    // Ángulo de apertura entre 10° y ~75° según mouthOpen [0..1]
    const ang = (10 + 65 * mouthOpen) * Math.PI / 180;
    // Borramos una cuña (usamos simple “pintar con color de boca” encima)
    ctx.fillStyle = pal.mouth;
    ctx.beginPath();
    ctx.moveTo(cx + tiltX, cy);
    ctx.arc(cx + tiltX, cy, Math.max(rx, ry), -ang, ang, false);
    ctx.closePath(); ctx.fill();
  }

  // Ojo simple
  #eye(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.62);
    const dx = 8; // desplazamiento lateral

    // Parpadeo sutil en idle
    const blink = (state === "idle") ? (0.8 + 0.2 * Math.sin(t * 2.1)) : 1;
    const rW = Math.max(1, Math.floor(3 * blink));
    const rH = Math.max(1, Math.floor(2 * blink));

    // contorno
    ctx.fillStyle = pal.eye;
    ctx.beginPath(); ctx.ellipse(cx + dx, cy, rW + 1, rH + 1, 0, 0, Math.PI * 2); ctx.fill();
    // blanco
    ctx.fillStyle = pal.pupil;
    ctx.beginPath(); ctx.ellipse(cx + dx, cy, rW, rH, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Brillos
  #highlights(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.60);
    ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 1.6);
    ctx.fillStyle = pal.bodyLight;
    ctx.beginPath(); ctx.ellipse(cx - 8, cy - 8, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Pose por estado: stretch + bob + apertura de boca + tilt lateral
  #pose(state, t, i, n) {
    // Wobble base
    const wob = Math.sin(t) * 0.06; // ±6%
    let sx = 1 + wob;
    let sy = 1 - wob;
    let bobY = 0;
    let tiltX = 0;
    let mouthOpen = 0.3; // reposo

    if (state === "idle") {
      bobY = Math.round(Math.sin(t) * 1);
      mouthOpen = 0.35 + 0.10 * (0.5 + 0.5 * Math.sin(t * 1.2)); // abre/cierra suave
      return { sx, sy, bobY, tiltX, mouthOpen };
    }

    if (state === "walk") {
      const phase = Math.sin(t * 2);
      sx = 1 + 0.12 * phase;
      sy = 1 - 0.12 * phase;
      bobY = Math.round(Math.sin(t * 2) * 1);
      tiltX = Math.round(phase * 2);
      // Chomp rítmico con la caminata
      mouthOpen = 0.25 + 0.60 * (0.5 + 0.5 * Math.sin(t * 4));
      return { sx, sy, bobY, tiltX, mouthOpen };
    }

    if (state === "jump") {
      const k = i / Math.max(1, n - 1);
      const up = Math.sin(k * Math.PI);
      sx = 1 - 0.16 * up;
      sy = 1 + 0.20 * up;
      bobY = -2;
      mouthOpen = 0.20 + 0.40 * up; // abre algo en el aire
      return { sx, sy, bobY, tiltX, mouthOpen };
    }

    // fall
    {
      const k = i / Math.max(1, n - 1);
      const down = Math.sin(k * Math.PI);
      sx = 1 + 0.18 * down;
      sy = 1 - 0.16 * down;
      if (k > 0.8) { // splash final
        const f = (k - 0.8) / 0.2;
        sx += 0.08 * f;
        sy -= 0.08 * f;
      }
      bobY = 1;
      mouthOpen = 0.20 + 0.50 * (0.5 + 0.5 * Math.sin(k * Math.PI * 2));
      return { sx, sy, bobY, tiltX, mouthOpen };
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
