// Phaser 3.60+ — ProceduralPinkBuddyFactory
// Sprite sheet pixel-art 64x64 por fila (idle, walk, jump, fall).
// Frames: idle 12, walk 8, jump 4, fall 2. Fondo transparente.
// Incluye squash & stretch, ojos expresivos, brillos y chispas en idle.
// Anti-bleed (EXTRUDE=2), PAD=2, filtro NEAREST y roundPixels.
// Uso: ver al final (spawn + createAnimations).

import Phaser from "phaser";

export default class PlayerCharacter {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} [opts]
   * @param {number} [opts.fw=64] Frame width
   * @param {number} [opts.fh=64] Frame height
   * @param {{idle?:number,walk?:number,jump?:number,fall?:number}} [opts.frames]
   * @param {string} [opts.keyPrefix="pinkbuddy"] Texture key prefix
   * @param {number} [opts.extrude=2]   Extrusión anti-bleed
   * @param {number} [opts.pad=2]       Padding entre celdas
   * @param {boolean} [opts.pixelPerfect=true] fuerza escala entera
   */
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "pinkbuddy",
    extrude = 2,
    pad = 2,
    pixelPerfect = true
  } = {}) {
    this.scene = scene;
    this.fw = fw; this.fh = fh;
    this.EXTRUDE = Math.max(1, extrude);
    this.PAD = Math.max(1, pad);
    this.pixelPerfect = pixelPerfect;

    this.count = {
      idle: frames?.idle ?? 12,
      walk: frames?.walk ?? 8,
      jump: frames?.jump ?? 4,
      fall: frames?.fall ?? 2
    };
    this.rows = ["idle", "walk", "jump", "fall"];
    this._cols = Math.max(this.count.idle, this.count.walk, this.count.jump, this.count.fall);

    this.key = `${keyPrefix}-${fw}x${fh}-i${this.count.idle}-w${this.count.walk}-j${this.count.jump}-f${this.count.fall}-ex${this.EXTRUDE}-pd${this.PAD}`;
  }

  // ───────────────────────── Sheet + Animations ─────────────────────────
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

    let r = 0;
    for (const state of this.rows) {
      const n = this.count[state];
      for (let i = 0; i < cols; i++) {
        const cellX = PAD + i * cellW;
        const cellY = PAD + r * cellH;
        const ox = cellX + EX;
        const oy = cellY + EX;

        const frameIdx = Math.min(i, n - 1);
        this.#paintFrame(ctx, state, frameIdx, n, ox, oy);

        // extrusión
        ctx.drawImage(tex.getSourceImage(), ox, oy, this.fw, 1, ox, oy - EX, this.fw, EX);
        ctx.drawImage(tex.getSourceImage(), ox, oy + this.fh - 1, this.fw, 1, ox, oy + this.fh, this.fw, EX);
        ctx.drawImage(tex.getSourceImage(), ox, oy, 1, this.fh, ox - EX, oy, EX, this.fh);
        ctx.drawImage(tex.getSourceImage(), ox + this.fw - 1, oy, 1, this.fh, ox + this.fw, oy, EX, this.fh);
      }
      r++;
    }

    tex.refresh();

    // registrar subframes (solo el rect del frame real)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = PAD + col * cellW;
        const cellY = PAD + row * cellH;
        const fx = cellX + EX;
        const fy = cellY + EX;
        const index = row * cols + col;
        tex.add(String(index), 0, fx, fy, this.fw, this.fh);
      }
    }
    try { this.scene.textures.get(this.key).setFilter(Phaser.Textures.FilterMode.NEAREST); } catch {}

    return this.key;
  }

  createAnimations({
    fps = { idle: 12, walk: 12, jump: 12, fall: 10 },
    repeat = { idle: -1, walk: -1, jump: 0, fall: -1 }
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
   * @param {{anim?:string, display?:{w:number,h:number}}} [opts]
   */
  spawn(x, y, { anim = "idle", display = { w: 64, h: 64 } } = {}) {
    const key = this.createAnimations();
    const s = this.scene.physics.add.sprite(x, y, key, 0)
      .setOrigin(0.5, 1)
      .setBounce(0.05);

    if (this.pixelPerfect) {
      const sx = Math.max(1, Math.round(display.w / this.fw));
      const sy = Math.max(1, Math.round(display.h / this.fh));
      s.setScale(sx, sy);
      if (this.scene.cameras?.main) this.scene.cameras.main.roundPixels = true;
    } else {
      s.displayWidth = display.w; s.displayHeight = display.h;
    }

    if (this.scene.anims.exists(anim)) s.play(anim);
    return { sprite: s, sheetKey: key, cols: this._cols };
  }

  // ───────────────────────── Frame painter ─────────────────────────
  #paintFrame(ctx, state, i, n, ox, oy) {
    // t de 0..2π dentro de la fila
    const t = (i / Math.max(1, n)) * Math.PI * 2;

    // Parámetros base del cuerpo redondo
    const w = this.fw, h = this.fh;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.70);

    // Colores
    const PINK   = "#f597c8";  // base
    const PINK2  = "#ffb4da";  // luz
    const PINKD  = "#d86aa4";  // sombra
    const OUTL   = "#231b2a";  // contorno
    const WHITE  = "#ffffff";
    const EYE    = "#2b2630";
    const SHINE  = "#ffffff";
    const SPARK1 = "#ffd8f2";
    const SPARK2 = "#ffecae";

    // Squash & stretch y bob según estado
    let sx = 1, sy = 1, by = 0, faceTilt = 0;

    if (state === "idle") {
      by = Math.round(Math.sin(t) * 1.5);
      sx = 1 + Math.sin(t) * 0.03;
      sy = 1 - Math.sin(t) * 0.03;
    } else if (state === "walk") {
      // pasitos elásticos
      const k = Math.sin(t * 2);
      sx = 1 + k * 0.10;      // estira horizontal al apoyar
      sy = 1 - k * 0.10;
      by = Math.round(-Math.abs(Math.sin(t * 2)) * 2) + 1;
      faceTilt = k * 0.08;
    } else if (state === "jump") {
      // 0: squash previo, 1: stretch subida, 2: apex, 3: anticipación caída
      const phase = i / Math.max(1, n - 1);
      if (phase < 0.25) { sx = 1.18; sy = 0.82; by = 2; }
      else if (phase < 0.50) { sx = 0.86; sy = 1.18; by = -3; }
      else if (phase < 0.75) { sx = 1.00; sy = 1.00; by = -1; }
      else { sx = 1.06; sy = 0.94; by = 1; }
      faceTilt = -0.06;
    } else if (state === "fall") {
      // 2 frames: lento con brazos arriba, rápido con squash
      if (i === 0) { sx = 0.96; sy = 1.04; by = 0; faceTilt = 0.03; }
      else { sx = 1.08; sy = 0.92; by = 2; faceTilt = 0.05; }
    }

    // Función para dibujar un óvalo escalado (cuerpo)
    const drawScaledEllipse = (cx, cy, rx, ry, sx, sy, rot = 0, fill = "#fff", alpha=1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy + by);
      ctx.rotate(rot);
      ctx.scale(sx, sy);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };

    // Sombra del suelo (ovalito)
    const shadowY = oy + h - 3;
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.beginPath();
    ctx.ellipse(cx, shadowY, Math.floor(w*0.26), Math.floor(h*0.05), 0, 0, Math.PI*2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();

    // Contorno: dibuja un donut (contour fake) con OUTL y luego relleno rosa
    // Cuerpo (base)
    drawScaledEllipse(cx, cy, Math.floor(w*0.22), Math.floor(h*0.19), sx, sy, 0, OUTL, 1);
    drawScaledEllipse(cx, cy, Math.floor(w*0.21), Math.floor(h*0.18), sx, sy, 0, PINK, 1);

    // Shading lateral (sombra derecha)
    drawScaledEllipse(cx+6, cy+2, Math.floor(w*0.13), Math.floor(h*0.13), sx, sy, 0, PINKD, 0.6);
    // Iluminación superior izquierda
    drawScaledEllipse(cx-6, cy-6, Math.floor(w*0.11), Math.floor(h*0.09), sx, sy, 0, PINK2, 0.9);

    // Highlight especular
    drawScaledEllipse(cx-10, cy-12, 6, 4, sx, sy, 0, SHINE, 0.55);
    drawScaledEllipse(cx-6, cy-8, 3, 2, sx, sy, 0, SHINE, 0.35);

    // Brazos y pies simples (pixel-art blocks redondeados)
    const drawLimb = (x, y, wpx, hpx) => {
      ctx.fillStyle = OUTL; ctx.fillRect(x-1, y-1, wpx+2, hpx+2);
      ctx.fillStyle = PINK2; ctx.fillRect(x, y, wpx, hpx);
    };
    // Animación de brazos según estado
    let armSwing = 0;
    if (state === "walk") armSwing = Math.sin(t*2) * 4;
    if (state === "idle") armSwing = Math.sin(t) * 1.5;

    // Pies (ligero desplazamiento en walk)
    drawLimb(cx - 10 + (state==="walk"? -2:0), cy + 14 + by, 10, 5);
    drawLimb(cx +  2 + (state==="walk"? +2:0), cy + 14 + by, 10, 5);

    // Brazos
    drawLimb(cx - 20, cy + 2 + by + Math.round(-armSwing), 8, 6);
    drawLimb(cx + 12, cy + 2 + by + Math.round(armSwing), 8, 6);

    // Cara (ojos grandes expresivos)
    ctx.save();
    ctx.translate(cx, cy - 6 + by);
    ctx.rotate(faceTilt);
    // blancos
    ctx.fillStyle = WHITE;
    ctx.fillRect(-10, -8, 7, 10);
    ctx.fillRect(+3,  -8, 7, 10);
    // iris/negrita
    ctx.fillStyle = EYE;
    // expresiones exageradas según estado
    const blink = (state==="idle") ? (Math.sin(t*1.5) > 0.85) : false;
    if (blink) {
      // parpadeo
      ctx.fillRect(-10, -3, 7, 2);
      ctx.fillRect( +3, -3, 7, 2);
    } else {
      // pupilas
      ctx.fillRect(-7, -3, 3, 6);
      ctx.fillRect(+6, -3, 3, 6);
    }

    // boca
    ctx.fillStyle = EYE;
    if (state === "jump") {
      // alegría/sorpresa
      ctx.fillRect(-2, 3, 4, 4);
    } else if (state === "fall") {
      ctx.fillRect(-3, 3, 6, 2);
    } else {
      ctx.fillRect(-4, 4, 8, 2);
    }
    ctx.restore();

    // Chispitas en idle (de vez en cuando)
    if (state === "idle") {
      const sparkChance = (i % 3 === 0);
      if (sparkChance) {
        const sx1 = cx + Math.round(Math.sin(t)*10) + 8;
        const sy1 = cy - 18 + Math.round(Math.cos(t)*4);
        const sx2 = cx - 12 + Math.round(Math.cos(t)*7);
        const sy2 = cy - 10 + Math.round(Math.sin(t)*3);
        const drawSpark = (x,y,col) => {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 2, 2);
          ctx.fillRect(x+3, y, 1, 2);
          ctx.fillRect(x-2, y, 1, 2);
          ctx.fillRect(x, y-2, 2, 1);
          ctx.fillRect(x, y+3, 2, 1);
        };
        drawSpark(sx1, sy1, SPARK1);
        drawSpark(sx2, sy2, SPARK2);
      }
    }
  }
}
