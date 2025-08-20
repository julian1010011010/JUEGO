// src/backgrounds/BackgroundFactory.js
// Phaser 3.60+ (funciona con 3.80). Fondos generativos estilo pixel, animación por sprites.

const PALETTES = {
  lava:    ['#1a0f1f','#3b0f21','#7a1c22','#d14a1d','#ff8a1c','#ffd166'],
  neon:    ['#0a0e1a','#141b2f','#1e2c4f','#00e5ff','#ff00e6','#ffe66d'],
  forest:  ['#0a120f','#13341f','#1c5a2a','#89c15b','#c4e86b','#e7ffd1'],
  glacier: ['#0a1020','#0f1b38','#123057','#6fb0ff','#bfe3ff','#ffffff'],
  desert:  ['#2a1a0b','#4a2a12','#8a5a1f','#d8a05a','#ffd17a','#fff1c7'],
  factory: ['#0e0e12','#1c1c24','#2e2e3a','#8a8f9a','#c3c6cc','#ffe66d'],
  volcano: ['#0b0a0e','#17131b','#26191d','#7a1c22','#ff6a1c','#ffd166'],
  // Semi-realista: rocas más frías/densas y luces más cálidas para contraste alto
  volcano_sr: ['#0a0a0d','#15131a','#241b20','#8e1f1e','#ff7a1f','#ffd97a']
};

export default class BackgroundFactory {
  constructor(scene, w=480, h=270, frames=8) {
    this.scene = scene;
    this.w = w; this.h = h; this.frames = frames;
  }

  // ===== API =====
  createAnimated(theme, opts={}) {
    const { fps=12, keyPrefix='bg' } = opts;
    const key = `${keyPrefix}-${theme}-${this.w}x${this.h}-${this.frames}`;
    if (!this.scene.textures.exists(key)) {
      this.#buildSpritesheet(theme, key);
      this.#buildAnim(theme, key, fps);
    }
    const s = this.scene.add.sprite(this.scene.scale.width/2, this.scene.scale.height/2, key, '0')
      .setOrigin(0.5).setDepth(-10).setScrollFactor(0);
    s.play(`${key}-anim`);
    s.displayWidth  = this.scene.scale.width;
    s.displayHeight = this.scene.scale.height;
    return s;
  }

  createParallax(theme, opts={}) {
    const { layers=3, speeds=[0.08,0.2,0.45], keyPrefix='tile' } = opts;
    const baseKey = `${keyPrefix}-${theme}-${this.w}x${this.h}`;
    const ts = [];
    for (let i=0; i<layers; i++){
      const key = `${baseKey}-L${i}`;
      if (!this.scene.textures.exists(key)) this.#buildTileLayer(theme, key, i);
      const t = this.scene.add.tileSprite(0,0,this.scene.scale.width,this.scene.scale.height,key)
        .setOrigin(0,0).setDepth(-10 + i).setScrollFactor(0);
      t.speed = speeds[Math.min(i, speeds.length-1)] ?? (0.1 + i*0.1);
      ts.push(t);
    }
    return { layers: ts, update: (dx=1, dy=0)=> ts.forEach(t=>{ t.tilePositionX += dx*t.speed; t.tilePositionY += dy*t.speed*0.3; }) };
  }

  // ===== Build sheet/anim/layers =====
  #buildSpritesheet(theme, key) {
    const { frames, w, h } = this;
    const canvasTex = this.scene.textures.createCanvas(key, w * frames, h);
    const ctx = canvasTex.getContext();
    for (let f=0; f<frames; f++) this.#paintBackgroundFrame(ctx, theme, w, h, f, frames, f*w);
    canvasTex.refresh();
    const tex = this.scene.textures.get(key);
    for (let f=0; f<frames; f++) tex.add(String(f), 0, f*w, 0, w, h);
  }

  #buildAnim(theme, key, fps) {
    const animKey = `${key}-anim`;
    if (this.scene.anims.exists(animKey)) return;
    const framesArr = Array.from({length: this.frames}, (_,i)=>({ key, frame: String(i) }));
    this.scene.anims.create({ key: animKey, frames: framesArr, frameRate: fps, repeat: -1 });
  }

  #buildTileLayer(theme, key, layerIndex) {
    const w = 256, h = 256;
    const tx = this.scene.textures.createCanvas(key, w, h);
    const ctx = tx.getContext();
    const pal = PALETTES[theme] ?? PALETTES.neon;
    this.#paintTile(ctx, pal, w, h, layerIndex);
    tx.refresh();
  }

  // ===== Paint frames =====
  #paintBackgroundFrame(ctx, theme, w, h, f, frames, ox){
    const pal = PALETTES[theme] ?? PALETTES.neon;
    // Base
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(ox, 0, w, h);

    switch(theme){
      case 'lava':       this.#paintLava(ctx, pal, f, frames, ox, w, h); break;
      case 'neon':       this.#paintNeonCity(ctx, pal, f, frames, ox, w, h); break;
      case 'forest':     this.#paintForest(ctx, pal, f, frames, ox, w, h); break;
      case 'glacier':    this.#paintGlacier(ctx, pal, f, frames, ox, w, h); break;
      case 'desert':     this.#paintDesert(ctx, pal, f, frames, ox, w, h); break;
      case 'factory':    this.#paintFactory(ctx, pal, f, frames, ox, w, h); break;
      case 'volcano':    this.#paintVolcano(ctx, pal, f, frames, ox, w, h); break;
      case 'volcano_sr': this.#paintVolcanoSR(ctx, pal, f, frames, ox, w, h); break;
    }

    // Scanlines sutiles
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#000';
    for (let y=0; y<h; y+=3) ctx.fillRect(ox, y, w, 1);
    ctx.globalAlpha = 1;
  }

  // ===== Paint tile base =====
  #paintTile(ctx, pal, w, h, layerIndex){
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    ctx.globalAlpha = 0.8 - layerIndex*0.2;
    ctx.fillStyle = pal[3] ?? '#888';
    const rnd = (a,b)=> Math.floor(a + Math.random()*(b-a+1));
    for (let i=0;i<120;i++){
      const x = rnd(0,w), y = rnd(0,h);
      if (layerIndex===0) ctx.fillRect(x,y,1,1);
      if (layerIndex===1) ctx.fillRect(x,y,2,2);
      if (layerIndex>=2) ctx.fillRect(x,y,3,2);
    }
    ctx.globalAlpha = 1;
  }

  // ===== THEMES =====
  #paintLava(ctx, pal, f, frames, ox, w, h){
    const t = (f/frames)*Math.PI*2;
    for (let y=h*0.65; y<h; y+=8){
      const amp = 6 + 3*Math.sin(t + y*0.08);
      this.#zigzag(ctx, ox, y, w, 6, amp, pal[3]);
    }
    ctx.globalAlpha = 0.5; ctx.fillStyle = pal[4];
    ctx.fillRect(ox, h*0.8, w, h*0.2); ctx.globalAlpha = 1;
  }

  #paintNeonCity(ctx, pal, f, frames, ox, w, h){
    const baseY = h*0.72; ctx.fillStyle = pal[2];
    for (let i=0;i<12;i++){
      const bw = 20 + (i%3)*12, x = ox + 10 + i*(w/12), bh = 40 + (i%5)*18;
      ctx.fillRect(x, baseY-bh, bw, bh);
      for (let vy = baseY-bh+6; vy<baseY-4; vy+=8){
        for (let vx = x+3; vx < x+bw-3; vx+=6){
          const blink = ((vx+vy+f*7)%19)<8;
          ctx.fillStyle = blink ? pal[4] : pal[3];
          ctx.fillRect(vx, vy, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 0.15; ctx.fillStyle = pal[4];
    ctx.fillRect(ox, baseY-4, w, 8); ctx.globalAlpha = 1;
  }

  #paintForest(ctx, pal, f, frames, ox, w, h){
    const baseY = h*0.75;
    for (let layer=0; layer<3; layer++){
      const shade = pal[2+layer]; ctx.fillStyle = shade;
      const offset = Math.sin((f/frames)*Math.PI*2 + layer)*4;
      for (let x=0; x<w; x+=12){
        const th = 10 + (x%24) + layer*6;
        ctx.fillRect(ox+x+offset, baseY - th, 8, th);
      }
    }
  }

  #paintGlacier(ctx, pal, f, frames, ox, w, h){
    const baseY = h*0.8;
    for (let i=0;i<8;i++){
      const iw = 26, ih = 12 + (i%3)*6, x = ox + 20 + i*(w/8);
      const bob = Math.sin(((f+i)/frames)*Math.PI*2)*2;
      ctx.fillStyle = pal[4]; ctx.fillRect(x, baseY-ih+bob, iw, ih);
      ctx.fillStyle = pal[5]; ctx.fillRect(x+2, baseY-ih+2+bob, iw-4, ih-4);
    }
    ctx.globalAlpha = 0.1; ctx.fillStyle = pal[3];
    ctx.fillRect(ox, 0, w, h*0.5); ctx.globalAlpha = 1;
  }

  #paintDesert(ctx, pal, f, frames, ox, w, h){
    const t = (f/frames)*Math.PI*2;
    for (let y=h*0.65; y<h; y+=10){
      const amp = 8 + 4*Math.sin(t + y*0.05);
      this.#wavy(ctx, ox, y, w, 10, amp, pal[3+(y/10)%2|0]);
    }
    ctx.globalAlpha = 0.25; ctx.fillStyle = pal[5];
    ctx.beginPath(); ctx.arc(ox+w*0.8, h*0.25, 26, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  #paintFactory(ctx, pal, f, frames, ox, w, h){
    const t = (f/frames)*Math.PI*2; ctx.fillStyle = pal[2];
    for (let x=0; x<w; x+=30) ctx.fillRect(ox+x, h*0.55, 8, h*0.5);
    for (let i=0;i<5;i++){
      const cx = ox + 30 + i*(w/5), cy = h*0.45 + (i%2)*10, r = 12 + (i%3)*6;
      this.#gear(ctx, cx, cy, r, 8, pal[4], t + i*0.6);
    }
  }

  // ===== Volcano clásico =====
  #paintVolcano(ctx, pal, f, frames, ox, w, h){
    const t = (f/frames) * Math.PI * 2, baseY = Math.floor(h*0.74);

    // roca + ladrillos irregulares
    ctx.fillStyle = pal[2];
    for (let y=20; y<baseY-16; y+=12){
      const shift = Math.floor(4*Math.sin(t + y*0.15));
      for (let x=0; x<w; x+=16) ctx.fillRect(ox+x+shift, y, 14, 10);
    }

    // grietas glow
    for (let i=0;i<12;i++){
      const cx = ox + 10 + i*(w/12), phase = t + i*0.7;
      const glow = 0.35 + 0.25*Math.sin(phase);
      ctx.globalAlpha = glow; ctx.fillStyle = pal[5];
      let yy = 28 + (i%3)*6;
      for (let k=0;k<10;k++){
        const len = 6 + (k%3)*3, dx = ((k%2)?2:-2);
        ctx.fillRect(cx + dx, yy, 2, len); yy += len + 2;
      }
      ctx.globalAlpha = 1;
    }

    // goteos
    for (let i=0;i<10;i++){
      const x = ox + ((i*97) % (w-8)) + 4, top = 14 + (i%3)*6;
      const drop = (1 - Math.cos(t + i))*16;
      ctx.fillStyle = pal[4]; ctx.fillRect(x, top + drop, 2, 6);
      ctx.fillStyle = pal[3]; ctx.fillRect(x, top + drop + 6, 2, 2);
    }

    // lava
    for (let y=baseY; y<h; y+=8){
      const amp = 6 + 3*Math.sin(t + y*0.08);
      this.#wavy(ctx, ox, y, w, 6, amp, pal[3]);
    }
    ctx.globalAlpha = 0.6; this.#zigzag(ctx, ox, baseY-2, w, 6, 3 + 2*Math.sin(t), pal[4]); ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.35; ctx.fillStyle = pal[4]; ctx.fillRect(ox, baseY, w, h-baseY); ctx.globalAlpha = 1;

    // chispas
    for (let i=0;i<38;i++){
      const px = ox + ((i*53) % (w-4)) + 2;
      const rise = 24 + 18*Math.sin(t + i*0.5), py = baseY - (i%24) - rise;
      ctx.fillStyle = (i%3===0) ? pal[5] : pal[4]; ctx.fillRect(px, py, 2, 2);
    }

    // humo
    for (let i=0;i<6;i++){
      const cx = ox + 30 + i*(w/6), base = baseY - 8 - (i%2)*6;
      const yy = base - 18*(1 - Math.cos(t + i*0.9));
      this.#puff(ctx, cx, yy, 6, '#2b2b2b', 0.18);
      this.#puff(ctx, cx+6, yy-8, 4, '#444', 0.14);
    }
  }

  // ===== Volcano semi-realista (volcano_sr) =====
  // Objetivo: más contraste, olas de lava "pesadas" y distorsión de aire (heat haze) encima de la lava.
  #paintVolcanoSR(ctx, pal, f, frames, ox, w, h){
    const t = (f/frames) * Math.PI * 2;
    const baseY = Math.floor(h*0.76);

    // 1) Pared de roca con textura granular y micro-dither
    // banda rocosa
    ctx.fillStyle = pal[2];
    for (let y=18; y<baseY-14; y+=10){
      const shift = Math.floor(5*Math.sin(t*0.9 + y*0.12));
      for (let x=0; x<w; x+=14) ctx.fillRect(ox+x+shift, y, 12, 8);
    }
    // dither oscuro (ruido cuadriculado)
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#000';
    for (let y=22; y<baseY-16; y+=4) for (let x=ox; x<ox+w; x+=4) if (((x+y)>>2)&1) ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;

    // 2) Grietas con brillo pulsante y ribete naranja
    for (let i=0;i<14;i++){
      const cx = ox + 8 + i*(w/14);
      const pulse = 0.4 + 0.3*Math.sin(t*1.1 + i*0.65); // 0.1..0.7
      // borde naranja
      ctx.globalAlpha = 0.6*pulse; ctx.fillStyle = pal[4];
      let yy = 28 + (i%4)*5;
      for (let k=0;k<11;k++){
        const len = 6 + (k%3)*3, dx = ((k%2)?2:-2);
        ctx.fillRect(cx + dx, yy, 2, len); yy += len + 2;
      }
      // núcleo amarillo
      ctx.globalAlpha = 0.35*pulse; ctx.fillStyle = pal[5];
      yy = 30 + (i%4)*5;
      for (let k=0;k<11;k++){
        const len = 4 + (k%3)*2, dx = ((k%2)?1:-1);
        ctx.fillRect(cx + dx, yy, 1, len); yy += len + 2;
      }
      ctx.globalAlpha = 1;
    }

    // 3) Goteos de magma desde el techo (loop perfecto)
    for (let i=0;i<12;i++){
      const x = ox + ((i*83) % (w-10)) + 5, top = 14 + (i%3)*6;
      const drop = (1 - Math.cos(t*1.2 + i))*18;
      ctx.fillStyle = pal[4]; ctx.fillRect(x, top + drop, 2, 7);
      ctx.fillStyle = pal[3]; ctx.fillRect(x, top + drop + 7, 2, 2);
    }

    // 4) Superficie de lava con olas gruesas y reflejos escalonados
    for (let y=baseY; y<h; y+=7){
      const amp = 7 + 4*Math.sin(t*0.9 + y*0.07);
      this.#wavy(ctx, ox, y, w, 6, amp, pal[3]); // rojo oscuro
    }
    // cresta luminosa "grasa"
    ctx.globalAlpha = 0.7; this.#zigzag(ctx, ox, baseY-2, w, 6, 3 + 2*Math.sin(t), pal[4]); ctx.globalAlpha = 1;
    // reflejo cálido en banda inferior
    ctx.globalAlpha = 0.38; ctx.fillStyle = pal[4]; ctx.fillRect(ox, baseY, w, h-baseY); ctx.globalAlpha = 1;

    // 5) Efecto de distorsión del aire (heat haze) sobre la lava
    // Bandas verticales semitransparentes con leve desplazamiento y alternancia de alpha
    const hazeTop = baseY - 22, hazeBottom = baseY - 2;
    for (let x=0; x<w; x+=4){
      const phase = Math.sin(t*1.3 + x*0.12);
      const colAlpha = 0.06 + 0.06 * (0.5+0.5*phase); // 0.06..0.12
      const yShift = Math.floor(2 * phase);           // -2..2
      ctx.globalAlpha = colAlpha; ctx.fillStyle = '#ffefe0';
      ctx.fillRect(ox + x, hazeTop + yShift, 2, hazeBottom - hazeTop);
    }
    ctx.globalAlpha = 1;

    // 6) Ondas de calor horizontales (shimmer) ascendiendo
    for (let i=0;i<6;i++){
      const yy = hazeTop - 6*i + 4*Math.sin(t*1.2 + i*0.6);
      ctx.globalAlpha = 0.08 + 0.02*(i%2);
      this.#shimmerLine(ctx, ox, yy, w);
    }
    ctx.globalAlpha = 1;

    // 7) Chispas finas y humo sutil
    for (let i=0;i<46;i++){
      const px = ox + ((i*47) % (w-4)) + 2;
      const rise = 28 + 16*Math.sin(t*1.1 + i*0.45);
      const py = baseY - (i%26) - rise;
      ctx.fillStyle = (i%4===0) ? pal[5] : pal[4];
      ctx.fillRect(px, py, 2, 2);
    }
    for (let i=0;i<7;i++){
      const cx = ox + 26 + i*(w/7);
      const base = baseY - 10 - (i%2)*6;
      const yy = base - 16*(1 - Math.cos(t*1.05 + i*0.9));
      this.#puff(ctx, cx, yy, 6, '#2b2b2b', 0.16);
      this.#puff(ctx, cx+6, yy-7, 4, '#474747', 0.12);
    }
  }

  // ===== Utils =====
  #zigzag(ctx, ox, y, w, step, amp, color){
    ctx.fillStyle = color;
    for (let x=0; x<w; x+=step){
      const off = Math.sin((x/16))*amp;
      ctx.fillRect(ox+x, y+off, step, step);
    }
  }

  #wavy(ctx, ox, y, w, step, amp, color){
    ctx.fillStyle = color;
    for (let x=0; x<w; x+=step){
      const off = Math.sin((x/24))*amp;
      ctx.fillRect(ox+x, y+off, step, step);
    }
  }

  #shimmerLine(ctx, ox, y, w){
    // línea “refractada”: tramos alternos claros/transparentes
    for (let x=0; x<w; x+=6){
      ctx.fillRect(ox+x, y + Math.sin(x*0.25)*1.5, 4, 1);
    }
  }

  #gear(ctx, cx, cy, r, teeth, color, rot){
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.fillStyle = color;
    for (let i=0;i<teeth;i++){
      const a = (i/teeth)*Math.PI*2, x = Math.cos(a)*(r+4), y = Math.sin(a)*(r+4);
      ctx.fillRect(x-2, y-2, 4, 4);
    }
    ctx.fillStyle = '#000'; ctx.fillRect(-2,-2,4,4); ctx.restore();
  }

  #puff(ctx, x, y, r, color, alpha=0.2){
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (let i=-r; i<=r; i+=2){
      for (let j=-r; j<=r; j+=2){
        if (i*i + j*j <= r*r) ctx.fillRect(x+i, y+j, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}
