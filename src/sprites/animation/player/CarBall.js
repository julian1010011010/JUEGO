// Phaser 3.60+ — Rueda de carro con rines en forma de estrella (idle, walk, jump, fall).
// Procedural, sin assets. Mantiene anti-bleed (extrusión=2), offset vertical en NO-idle,
// pixel-perfect por defecto y sombra dinámica.
//
// Uso típico:
// const wheelFactory = new ProceduralWheelFactory(this, { fw:64, fh:64 }).spawn(x, y, { anim:"idle" });
//
import Phaser from "phaser";

const WHEEL_PAL = {
  tire:      "#2b2b2b", // caucho
  tireDark:  "#1b1b1b", // sombra caucho
  rim:       "#cfd3da", // metal claro
  rimDark:   "#9aa2ad", // metal sombra
  star:      "#b6bec9", // estrella (spokes)
  bolt:      "#6c757f", // tuercas
  highlight: "#ffffff", // brillos
  shadow:    "#000000"  // sombra en el piso
};

export default class PlayerCharacterd {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.fw=64]  Ancho frame
   * @param {number} [opts.fh=64]  Alto frame
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string}  [opts.keyPrefix="wheel"]
   * @param {Partial<typeof WHEEL_PAL>} [opts.palette]
   * @param {number}  [opts.bodyYOffsetNonIdle=-2] ΔY cuando state !== "idle"
   * @param {boolean} [opts.moveShadowWithBody=true] Sombra acompaña ΔY
   * @param {number}  [opts.extrude=2] Extrusión px
   * @param {number}  [opts.pad=2]     Padding px entre celdas
   * @param {number}  [opts.walkTurnsPerCycle=1]  Vueltas completas del rin por ciclo de walk (8 frames por defecto)
   * @param {number}  [opts.dir=1] Dirección de giro (1 o -1)
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "wheel",
    palette = {},
    bodyYOffsetNonIdle = -2,
    moveShadowWithBody = true,
    extrude = 2,
    pad = 2,
    walkTurnsPerCycle = 1,
    dir = 1
  } = {}) {
    this.scene = scene;
    this.fw = fw;
    this.fh = fh;

    this.bodyYOffsetNonIdle = bodyYOffsetNonIdle;
    this.moveShadowWithBody = moveShadowWithBody;
    this.walkTurnsPerCycle = walkTurnsPerCycle;
    this.dir = (dir >= 0) ? 1 : -1;

    this.EXTRUDE = Math.max(1, extrude);
    this.PAD = Math.max(1, pad);

    this.pal = { ...WHEEL_PAL, ...palette };

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
      `-wt${this.walkTurnsPerCycle}-d${this.dir > 0 ? 'R' : 'L'}`;
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

    // Registrar frames (sin extrusión)
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
    fps = { idle: 8, walk: 14, jump: 12, fall: 12 },
    repeat = { idle: -1, walk: -1, jump: 0,  fall: 0 }
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
    // t: 0..2π por ciclo
    const t = (i / Math.max(1, n)) * Math.PI * 2;

    // ΔY: subir 2px en NO-idle
    const yOff = (state !== "idle") ? (this.bodyYOffsetNonIdle ?? -2) : 0;

    const oyBody   = oy + yOff;
    const oyShadow = (this.moveShadowWithBody && state !== "idle") ? oyBody : oy;

    this.#shadow(ctx, ox, oyShadow, state, i, n);
    this.#wheel(ctx, ox, oyBody, state, t, i, n);
    this.#specular(ctx, ox, oyBody, state, t);
  }

  // Sombra en piso dependiente del squash vertical
  #shadow(ctx, ox, oy, state, i, n) {
    const w = this.fw, h = this.fh;
    const by = oy + h - 2;
    const cx = ox + (w >> 1);

    const { sx, sy } = this.#poseStretch(state, i, n);
    const base = 0.30;
    const rx = Math.max(6, Math.floor(w * (base + (1 - sy) * 0.14))); // más ancha cuando hay squash
    const ry = Math.max(2, Math.floor(h * 0.06));

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = this.pal.shadow;
    ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Dibujo de la rueda + rin en forma de estrella (spokes)
  #wheel(ctx, ox, oy, state, t, i, n) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1);
    const baseY = oy + Math.floor(h * 0.78);

    // Pose (squash/stretch + bob) y ángulo
    const { sx, sy, bobY, ang } = this.#pose(state, t, i, n);
    const cy = baseY + bobY;

    // Radios base
    const R_outer = Math.floor(Math.min(w, h) * 0.30); // radio exterior del caucho
    const R_tire  = Math.floor(R_outer * 1.00);
    const R_rim   = Math.floor(R_outer * 0.72);        // disco interior (metal)
    const R_hub   = Math.floor(R_outer * 0.28);        // cubo central

    // Deformación por squash/stretch (anisotrópica)
    const Rx_tire = Math.max(6, Math.floor(R_tire * sx));
    const Ry_tire = Math.max(6, Math.floor(R_tire * sy));
    const Rx_rim  = Math.max(4, Math.floor(R_rim  * sx));
    const Ry_rim  = Math.max(4, Math.floor(R_rim  * sy));
    const Rx_hub  = Math.max(2, Math.floor(R_hub  * sx));
    const Ry_hub  = Math.max(2, Math.floor(R_hub  * sy));

    // --- Capa 1: caucho exterior ---
    ctx.fillStyle = pal.tireDark;
    ctx.beginPath(); ctx.ellipse(cx + 1, cy + 2, Rx_tire, Ry_tire, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = pal.tire;
    ctx.beginPath(); ctx.ellipse(cx, cy, Rx_tire, Ry_tire, 0, 0, Math.PI * 2); ctx.fill();

    // “flat spot” leve en fall avanzado (simula compresión de contacto)
    if (state === "fall" && n > 1 && i === n - 1) {
      ctx.fillStyle = pal.tireDark;
      const wFlat = Math.max(4, Math.floor(Rx_tire * 0.9));
      ctx.fillRect(cx - wFlat, cy + Ry_tire - 1, wFlat * 2, 2);
    }

    // --- Capa 2: disco de rim ---
    ctx.fillStyle = pal.rimDark;
    ctx.beginPath(); ctx.ellipse(cx + 1, cy + 1, Rx_rim, Ry_rim, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = pal.rim;
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.floor(Rx_rim * 0.98), Math.floor(Ry_rim * 0.98), 0, 0, Math.PI * 2); ctx.fill();

    // --- Capa 3: estrella (spokes) rotando ---
    // La estrella se dibuja como un polígono de 5 puntas; rotamos por 'ang'
    ctx.fillStyle = pal.star;
    this.#starSpokes(ctx, cx, cy, Math.floor(Rx_rim * 0.95), Math.floor(Ry_rim * 0.95), Math.floor(Math.min(Rx_rim, Ry_rim) * 0.46), ang);
    ctx.fill();

    // --- Capa 4: hub central + tuercas ---
    ctx.fillStyle = pal.rimDark;
    ctx.beginPath(); ctx.ellipse(cx + 1, cy + 1, Rx_hub, Ry_hub, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = pal.rim;
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.floor(Rx_hub * 0.96), Math.floor(Ry_hub * 0.96), 0, 0, Math.PI * 2); ctx.fill();

    // Tuercas (5) sobre el hub, giran con la estrella
    ctx.fillStyle = pal.bolt;
    const bolts = 5, boltR = Math.max(1, Math.floor(Math.min(Rx_hub, Ry_hub) * 0.30));
    for (let k = 0; k < bolts; k++) {
      const a = ang + (k * 2 * Math.PI / bolts);
      const bx = cx + Math.cos(a) * Math.floor(Rx_hub * 0.7);
      const by = cy + Math.sin(a) * Math.floor(Ry_hub * 0.7);
      ctx.beginPath(); ctx.ellipse(Math.round(bx), Math.round(by), boltR, boltR, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Estrella 5 puntas deformada en X/Y (para squash) usada como “spokes”
  #starSpokes(ctx, cx, cy, Rx, Ry, rInner, rotRad) {
    ctx.beginPath();
    const points = 5;
    for (let k = 0; k < points * 2; k++) {
      const a = rotRad + (Math.PI / points) * k; // alterna punta/valle
      const useR = (k % 2 === 0) ? { rx: Rx, ry: Ry } : { rx: rInner, ry: Math.floor(rInner * (Ry / Rx)) };
      const x = cx + Math.cos(a) * useR.rx;
      const y = cy + Math.sin(a) * useR.ry;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Brillos sutiles
  #specular(ctx, ox, oy, state, t) {
    const w = this.fw, h = this.fh, pal = this.pal;
    const cx = ox + (w >> 1), cy = oy + Math.floor(h * 0.72);
    ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 1.3);
    ctx.fillStyle = pal.highlight;
    ctx.beginPath(); ctx.ellipse(cx - 10, cy - 6, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Pose por estado: stretch + bob + ángulo de giro
  #pose(state, t, i, n) {
    // Wobble base muy leve
    const wob = Math.sin(t) * 0.04;
    let sx = 1 + wob, sy = 1 - wob, bobY = 0, ang = 0;

    if (state === "idle") {
      bobY = Math.round(Math.sin(t) * 1);
      ang = Math.sin(t * 0.6) * 0.12; // balanceo mínimo del rin
      return { sx, sy, bobY, ang };
    }

    if (state === "walk") {
      // Rotación continua: turnos por ciclo (walkTurnsPerCycle) distribuidos en n frames
      const k = i / Math.max(1, n); // [0..1)
      ang = this.dir * (k * this.walkTurnsPerCycle * Math.PI * 2);
      // Squash ligero rítmico para dar peso
      const phase = Math.sin(t * 2);
      sx = 1 + 0.08 * phase;
      sy = 1 - 0.08 * phase;
      bobY = Math.round(Math.sin(t * 2) * 1);
      return { sx, sy, bobY, ang };
    }

    if (state === "jump") {
      const k = i / Math.max(1, n - 1);
      const up = Math.sin(k * Math.PI);
      sx = 1 - 0.12 * up;  // estira vertical
      sy = 1 + 0.16 * up;
      bobY = -2;
      ang = this.dir * (up * Math.PI * 0.6); // leve giro en aire
      return { sx, sy, bobY, ang };
    }

    // fall
    {
      const k = i / Math.max(1, n - 1);
      const down = Math.sin(k * Math.PI);
      sx = 1 + 0.14 * down;   // squash horizontal
      sy = 1 - 0.12 * down;
      if (k > 0.8) {
        const f = (k - 0.8) / 0.2;
        sx += 0.08 * f; sy -= 0.08 * f; // splash final
      }
      bobY = 1;
      ang = this.dir * (down * Math.PI * 0.8);
      return { sx, sy, bobY, ang };
    }
  }

  // Solo para sombra
  #poseStretch(state, i, n) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;
    if (state === "idle") {
      const wob = Math.sin(t) * 0.04; return { sx: 1 + wob, sy: 1 - wob };
    }
    if (state === "walk") {
      const phase = Math.sin(t * 2);  return { sx: 1 + 0.08 * phase, sy: 1 - 0.08 * phase };
    }
    if (state === "jump") {
      const k = i / Math.max(1, n - 1), up = Math.sin(k * Math.PI);
      return { sx: 1 - 0.12 * up, sy: 1 + 0.16 * up };
    }
    const k = i / Math.max(1, n - 1), down = Math.sin(k * Math.PI);
    let sx = 1 + 0.14 * down, sy = 1 - 0.12 * down;
    if (k > 0.8) { const f = (k - 0.8) / 0.2; sx += 0.08 * f; sy -= 0.08 * f; }
    return { sx, sy };
  }
}
