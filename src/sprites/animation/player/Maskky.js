// Phaser 3.60+ — WraithMaskCharacter (inspirado en la imagen adjunta)
// Sprite sheet procedural 64x64 por fila (idle, walk, jump, fall)
// Frames: idle 12, walk 8, jump 4, fall 2. Fondo transparente.
// Paleta: máscara marfil, ojos negros huecos, sonrisa roja, capucha + manto oscuro.
// Anti-bleed (EXTRUDE=2), PAD=2, filtro NEAREST y roundPixels.

import Phaser from "phaser";

export default class PlayerCharacter {
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "wraith",
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

        // Extrusión anti-bleed
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
    fps = { idle: 10, walk: 12, jump: 10, fall: 8 },
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
    mk("wraith-idle", r++, 0, this.count.idle - 1, fps.idle, repeat.idle);
    mk("wraith-walk", r++, 0, this.count.walk - 1, fps.walk, repeat.walk);
    mk("wraith-jump", r++, 0, this.count.jump - 1, fps.jump, repeat.jump);
    mk("wraith-fall", r++, 0, this.count.fall - 1, fps.fall, repeat.fall);
    return key;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {{anim?:string, display?:{w:number,h:number}}} [opts]
   */
  spawn(x, y, { anim = "wraith-idle", display = { w: 64, h: 64 } } = {}) {
    const key = this.createAnimations();
    const s = this.scene.physics.add.sprite(x, y, key, 0)
      .setOrigin(0.5, 1)
      .setBounce(0.02);

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

    // Parámetros base
    const w = this.fw, h = this.fh;
    const cx = ox + (w >> 1);
    const cy = oy + Math.floor(h * 0.60); // la cabeza algo arriba

    // Paleta
    const MASK   = "#efeedd"; // marfil
    const OUTL   = "#0b0e12"; // borde/negro profundo
    const HOOD   = "#0c1318"; // capucha
    const CLOAK  = "#0a1116"; // manto (ligeramente distinto)
    const MOUTH  = "#b43a3a"; // sonrisa roja oscura
    const SHINE  = "#ffffff"; // toques mínimos

    // Movimiento por estado
    let sx = 1, sy = 1, by = 0, rot = 0;
    if (state === "idle") {
      by = Math.round(Math.sin(t) * 2);
      sx = 1 + Math.sin(t) * 0.02;
      sy = 1 - Math.sin(t) * 0.02;
      rot = Math.sin(t) * 0.02;
    } else if (state === "walk") {
      // deslizamiento etéreo
      const k = Math.sin(t * 2);
      by = Math.round(Math.sin(t) * 1.5);
      sx = 1 + k * 0.04; sy = 1 - k * 0.04;
      rot = k * 0.03;
    } else if (state === "jump") {
      const phase = i / Math.max(1, n - 1);
      if (phase < 0.25) { sx = 1.10; sy = 0.90; by = 2; }
      else if (phase < 0.50) { sx = 0.92; sy = 1.12; by = -4; }
      else if (phase < 0.75) { sx = 1.00; sy = 1.00; by = -2; }
      else { sx = 1.05; sy = 0.95; by = 1; }
      rot = -0.02;
    } else if (state === "fall") {
      if (i === 0) { sx = 0.98; sy = 1.02; by = 0; rot = 0.01; }
      else { sx = 1.06; sy = 0.94; by = 2; rot = 0.02; }
    }

    // Helpers
    const drawEllipse = (x, y, rx, ry, fill, a=1) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2);
      ctx.fillStyle = fill; ctx.fill(); ctx.restore();
    };
    const drawMaskOval = () => {
      // borde oscuro fino
      drawEllipse(cx, cy + by, Math.floor(w*0.20), Math.floor(h*0.24), OUTL, 1);
      // cara marfil
      ctx.save();
      ctx.translate(cx, cy + by);
      ctx.rotate(rot);
      ctx.scale(sx, sy);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.floor(w*0.19), Math.floor(h*0.23), 0, 0, Math.PI*2);
      ctx.fillStyle = MASK; ctx.fill();
      ctx.restore();
    };
    const drawEyesAndMouth = () => {
      ctx.save();
      ctx.translate(cx, cy - 2 + by);
      ctx.rotate(rot);
      ctx.scale(sx, sy);

      // ojos negros (cuadrados pixelados)
      ctx.fillStyle = OUTL;
      ctx.fillRect(-10, -6, 8, 8);
      ctx.fillRect( +2, -6, 8, 8);

      // leve parpadeo/latido (oscurecer) en idle
      if (state === "idle" && Math.sin(t*1.3) > 0.85) {
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-10, -6, 8, 8);
        ctx.fillRect( +2, -6, 8, 8);
        ctx.globalAlpha = 1.0;
      }

      // sonrisa roja dentada
      ctx.fillStyle = MOUTH;
      // curva con píxeles “escalonados”
      const y0 = 6;
      ctx.fillRect(-12, y0+0, 4, 2);
      ctx.fillRect(-8,  y0+1, 4, 2);
      ctx.fillRect(-4,  y0+2, 4, 2);
      ctx.fillRect( 0,  y0+2, 4, 2);
      ctx.fillRect( 4,  y0+1, 4, 2);
      ctx.fillRect( 8,  y0+0, 4, 2);

      // brillo tenue en pómulo
      drawEllipse(-8 + 0, -4, 2, 2, SHINE, 0.25);

      ctx.restore();
    };
    const drawHoodAndCloak = () => {
      // capucha (envolviendo la máscara)
      ctx.save();
      ctx.translate(0, by);
      ctx.fillStyle = HOOD;

      // contorno capucha
      const px = cx - 22, py = cy - 28;
      ctx.fillRect(px, py, 44, 6);           // parte superior
      ctx.fillRect(px-2, py+6, 48, 6);       // segundo anillo

      // laterales curvos a base de rects escalonados
      for (let k=0; k<6; k++) {
        ctx.fillRect(px - 4 + k, py + 12 + k*3, 6, 3);           // izquierda
        ctx.fillRect(px + 42 - k, py + 12 + k*3, 6, 3);          // derecha
      }

      // manto (flecos irregulares)
      ctx.fillStyle = CLOAK;
      const baseY = oy + h - 8;
      for (let x= -14; x<=14; x+=4) {
        const jitter = (state==="idle" ? Math.round(Math.sin(t + x)*1.5) : 0)
                     + (state==="walk" ? Math.round(Math.sin(t*2 + x)*1.5) : 0);
        const len = 10 + ((x%8===0)?6:0) + (i%2===0?1:0);
        ctx.fillRect(cx + x, baseY + jitter, 3, len);
      }
      ctx.restore();
    };
    const drawShadow = () => {
      // sombra elíptica
      ctx.save();
      ctx.globalAlpha = 0.20;
      ctx.beginPath();
      ctx.ellipse(cx, oy + h - 3, Math.floor(w*0.24), Math.floor(h*0.06), 0, 0, Math.PI*2);
      ctx.fillStyle = "#000000";
      ctx.fill(); ctx.restore();
    };

    // Orden de pintura
    drawShadow();
    drawHoodAndCloak();
    drawMaskOval();
    drawEyesAndMouth();
  }
}
