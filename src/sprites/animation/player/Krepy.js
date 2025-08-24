// Phaser 3.60+ — ProceduralHorrorShadeFactory
// Sprite sheet 64x64 por fila (idle, walk, jump, fall).
// Estilo: silueta negra, cara roja, ojos cyan glitcheados.
// Incluye: jitter, parpadeo, sonrisa que se abre, goteo/partículas,
// squash & stretch (terror viscoso). Fondo transparente.

import Phaser from "phaser";

export default class PlayerCharacter {
  constructor(scene, {
    fw = 64, fh = 64,
    frames,
    keyPrefix = "horrorShade",
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
    this.rows = ["idle","walk","jump","fall"];
    this._cols = Math.max(this.count.idle, this.count.walk, this.count.jump, this.count.fall);
    this.key = `${keyPrefix}-${fw}x${fh}-i${this.count.idle}-w${this.count.walk}-j${this.count.jump}-f${this.count.fall}-ex${this.EXTRUDE}-pd${this.PAD}`;
  }

  // ───────────────── Sheet ─────────────────
  buildSheet() {
    if (this.scene.textures.exists(this.key)) return this.key;

    const cols = this._cols, rows = this.rows.length;
    const cellW = this.fw + this.PAD + this.EXTRUDE*2;
    const cellH = this.fh + this.PAD + this.EXTRUDE*2;
    const sheetW = cols*cellW + this.PAD;
    const sheetH = rows*cellH + this.PAD;

    const tex = this.scene.textures.createCanvas(this.key, sheetW, sheetH);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;

    let r = 0;
    for (const state of this.rows) {
      const n = this.count[state];
      for (let i=0;i<cols;i++){
        const cellX = this.PAD + i*cellW;
        const cellY = this.PAD + r*cellH;
        const ox = cellX + this.EXTRUDE;
        const oy = cellY + this.EXTRUDE;

        const idx = Math.min(i, n-1);
        this.#paintFrame(ctx, state, idx, n, ox, oy);

        // extrude anti-bleed
        ctx.drawImage(tex.getSourceImage(), ox, oy, this.fw, 1, ox, oy - this.EXTRUDE, this.fw, this.EXTRUDE);
        ctx.drawImage(tex.getSourceImage(), ox, oy + this.fh - 1, this.fw, 1, ox, oy + this.fh, this.fw, this.EXTRUDE);
        ctx.drawImage(tex.getSourceImage(), ox, oy, 1, this.fh, ox - this.EXTRUDE, oy, this.EXTRUDE, this.fh);
        ctx.drawImage(tex.getSourceImage(), ox + this.fw - 1, oy, 1, this.fh, ox + this.fw, oy, this.EXTRUDE, this.fh);
      }
      r++;
    }
    tex.refresh();

    // registrar frames reales
    for (let row=0; row<rows; row++){
      for (let col=0; col<cols; col++){
        const cellX = this.PAD + col*cellW;
        const cellY = this.PAD + row*cellH;
        const fx = cellX + this.EXTRUDE;
        const fy = cellY + this.EXTRUDE;
        const index = row*cols + col;
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
    const mk = (name,row,from,to,fr,rep)=>{
      if (this.scene.anims.exists(name)) return;
      const frames = this.scene.anims.generateFrameNumbers(key,{start: row*cols+from, end: row*cols+to});
      this.scene.anims.create({ key: name, frames, frameRate: fr, repeat: rep });
    };
    let r = 0;
    mk("idle", r++, 0, this.count.idle-1, fps.idle, repeat.idle);
    mk("walk", r++, 0, this.count.walk-1, fps.walk, repeat.walk);
    mk("jump", r++, 0, this.count.jump-1, fps.jump, repeat.jump);
    mk("fall", r++, 0, this.count.fall-1, fps.fall, repeat.fall);
    return key;
  }

  spawn(x, y, { anim="idle", display={w:64,h:64} } = {}) {
    const key = this.createAnimations();
    const s = this.scene.physics.add.sprite(x, y, key, 0)
      .setOrigin(0.5, 1)
      .setBounce(0.02);

    // pixel perfect
    const sx = Math.max(1, Math.round(display.w / this.fw));
    const sy = Math.max(1, Math.round(display.h / this.fh));
    s.setScale(sx, sy);
    if (this.scene.cameras?.main) this.scene.cameras.main.roundPixels = true;

    if (this.scene.anims.exists(anim)) s.play(anim);
    return { sprite: s, sheetKey: key, cols: this._cols };
  }

  // ─────────────── painter ───────────────
  #paintFrame(ctx, state, i, n, ox, oy){
    const w=this.fw, h=this.fh;
    const t = (i/Math.max(1,n))*Math.PI*2;

    // Paleta
    const BLACK = "#000000";
    const RED   = "#e11616";
    const RED2  = "#ff3a33";
    const SHADOW= "#0b0b0b";
    const OUT   = "#1a1a1a";
    const CYAN  = "#9bf8ff";
    const CYAN2 = "#3df0ff";
    const WHITE = "#ffffff";

    // Center base
    const cx = ox + (w>>1);
    const cy = oy + Math.floor(h*0.68);

    // Jitter/temblor
    let jitterX=0, jitterY=0;
    const micro = (phase, amp)=> Math.round(Math.sin(phase)*amp);
    if (state==="idle") { jitterX = micro(t*3, 1); jitterY = micro(t*2.2, 1); }
    if (state==="walk") { jitterX = micro(t*6, 1); jitterY = micro(t*3.5, 1); }
    if (state==="jump") { jitterX = 0; jitterY = -1; }
    if (state==="fall") { jitterX = micro(t*5,1); jitterY = 1; }

    // Squash & stretch “viscoso”
    let sx=1, sy=1, bob=0;
    if (state==="idle") { sx=1.03+Math.sin(t)*0.02; sy=0.97-Math.sin(t)*0.02; bob = micro(t,1); }
    if (state==="walk") { const k=Math.sin(t*2);
      sx = 1.08 + k*0.08; sy = 0.92 - k*0.08; bob = -Math.abs(k*2); }
    if (state==="jump") {
      const ph = i / Math.max(1,n-1);
      if (ph<0.25){ sx=1.18; sy=0.82; bob=2; }          // compresión previa
      else if (ph<0.5){ sx=0.86; sy=1.18; bob=-3; }     // estira subida
      else if (ph<0.75){ sx=1.0; sy=1.0; bob=-1; }      // apex
      else { sx=1.06; sy=0.94; bob=1; }                 // anticipación caída
    }
    if (state==="fall"){ if (i===0){ sx=0.96; sy=1.04; } else { sx=1.1; sy=0.9; bob=2; } }

    // Helpers
    const ell = (x,y,rx,ry,fill,alpha=1)=>{
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.ellipse(x,y,rx*sx,ry*sy,0,0,Math.PI*2);
      ctx.fillStyle = fill; ctx.fill(); ctx.restore();
    };
    const rect = (x,y,w,h,fill)=>{ ctx.fillStyle=fill; ctx.fillRect(x,y,w,h); };

    // Sombra suelo
    ctx.save(); ctx.globalAlpha=0.20;
    ctx.beginPath();
    ctx.ellipse(cx+jitterX, oy+h-3, Math.floor(w*0.28), Math.floor(h*0.06), 0, 0, Math.PI*2);
    ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();

    // Manto/silueta (negro con borde tenue)
    ell(cx+jitterX, cy+jitterY+bob, Math.floor(w*0.30), Math.floor(h*0.32), OUT, 1);
    ell(cx+jitterX, cy+jitterY+bob, Math.floor(w*0.29), Math.floor(h*0.31), BLACK, 1);
    // brillo lateral tenue
    ell(cx+10+jitterX, cy+6+jitterY+bob, Math.floor(w*0.16), Math.floor(h*0.16), SHADOW, 0.55);

    // Rostro rojo (inclinado)
    const faceX = cx - 4 + jitterX;
    const faceY = cy - 2 + jitterY + bob;
    ell(faceX, faceY, 16, 13, RED, 1);
    ell(faceX+3, faceY+2, 12, 10, RED2, 0.45);

    // Ojos cyan “CRT glitch”
    const glitch = (state==="idle" ? (Math.sin(t*7)>0.85) : (state==="walk" && Math.sin(t*10)>0.9));
    const eyeOff = glitch ? 1 : 0;
    // orbitas
    rect(faceX-9, faceY-3, 5, 5, WHITE);
    rect(faceX+6, faceY-1, 5, 5, WHITE);
    // pupilas cyan
    rect(faceX-7+eyeOff, faceY-1, 2, 2, CYAN);
    rect(faceX+8-eyeOff, faceY+1, 2, 2, CYAN2);
    // glitch scanline
    if (glitch) {
      rect(faceX-11, faceY-4, 24, 1, CYAN2);
      rect(faceX-11, faceY+4, 24, 1, CYAN);
    }

    // Boca / sonrisa abierta (según estado)
    let mouthH = 3, mouthW = 16, mouthY = faceY+6;
    if (state==="idle"){ mouthH = 3 + Math.round((Math.sin(t*2)+1)*1); }
    if (state==="walk"){ mouthH = 4; }
    if (state==="jump"){ mouthH = 6; mouthY = faceY+5; }
    if (state==="fall"){ mouthH = (i===0?5:7); }

    // borde oscuro
    rect(faceX - (mouthW>>1)-1, mouthY-1, mouthW+2, mouthH+2, OUT);
    // rojo interior
    rect(faceX - (mouthW>>1), mouthY, mouthW, mouthH, RED2);

    // Goteo (chorro) en frames pares de idle y en fall rápido
    const drippy = (state==="idle" && (i%2===0)) || (state==="fall" && i===1);
    if (drippy){
      const dx = faceX + 6 + ((i%4)-1);
      rect(dx, mouthY+mouthH, 2, 3, RED2);
      rect(dx+1, mouthY+mouthH+3, 1, 2, RED);
    }

    // “Hombros” ondulantes (silhueta irregular para look pixel)
    const spikes = 8;
    for (let s=0;s<spikes;s++){
      const sxp = cx - 18 + s*5 + jitterX;
      const syp = cy + 14 + bob + ((s&1)?1:0);
      rect(sxp, syp, 4, 2, BLACK);
    }

    // Partículas fantasma (idle)
    if (state==="idle" && i%3===0){
      const px1 = cx + 16 + micro(t*3,4), py1 = cy - 18 + micro(t*2,2);
      const px2 = cx - 18 + micro(t*2.2,3), py2 = cy - 10 + micro(t*1.7,2);
      rect(px1, py1, 2, 2, CYAN2);
      rect(px2, py2, 2, 2, WHITE);
    }
  }
}
