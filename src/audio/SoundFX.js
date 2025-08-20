// src/audio/soundFX.js
// Gestor simple y reutilizable de efectos de sonido para Phaser 3
export default class SoundFX {
  /**
   * Carga los audios. Llama esto en preload():
   *   SoundFX.preload(this)
   *
   * Si usas Vite y tienes los .mp3 dentro de src/, estas rutas funcionan.
   * Si mueves los audios a /public/audio, cambia a '/audio/archivo.mp3'.
   */
  static preload(scene) {
    // Efectos
    scene.load.audio('sfx-sonar', '../src/audio/lava/sonar.mp3');

    scene.load.audio('game-over', '../src/audio/game/gameOver.mp3');

    scene.load.audio('jump', '../src/audio/player/jump.mp3');

    // Si tienes más efectos, regístralos acá:
    // scene.load.audio('sfx-jump', 'audio/jump.mp3');
    // scene.load.audio('sfx-power', 'audio/Power.mp3');

    // Música de fondo (opcional, por si quieres manejarla desde otra clase)
    scene.load.audio('bgm', '../src/audio/BackGroungSound.mp3');
  }

  /**
   * @param {Phaser.Scene} scene
   * @param {{masterVolume?:number, antispamMs?:number}} [opts]
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.masterVolume = opts.masterVolume ?? 1.0;
    this.antispamMs = opts.antispamMs ?? 80; // evita “metralleta” al spamear
    this._lastPlay = new Map(); // Map<key, timestamp>
    this._instances = new Set(); // para limpiar on destroy
  }

  setMasterVolume(v) {
    this.masterVolume = Phaser.Math.Clamp(v ?? 1, 0, 1);
  }

  mute()  { this.masterVolume = 0; }
  unmute(){ this.masterVolume = 1; }

  stopAll() {
    for (const s of this._instances) {
      try { s.stop(); s.destroy(); } catch {}
    }
    this._instances.clear();
  }

  /**
   * Reproduce un efecto y lo destruye al terminar.
   * @param {string} key - key registrada en el loader (ej: 'sfx-sonar')
   * @param {{volume?:number, rate?:number, detune?:number, loop?:boolean}} [cfg]
   */
  play(key, cfg = {}) {
    // Antispam básico por key
    const now = this.scene.time.now;
    const last = this._lastPlay.get(key) ?? 0;
    if (now - last < this.antispamMs) return null;
    this._lastPlay.set(key, now);

    const sfx = this.scene.sound.add(key, {
      volume: (cfg.volume ?? 1) * this.masterVolume,
      rate: cfg.rate ?? 1,
      detune: cfg.detune ?? 0,
      loop: cfg.loop ?? false
    });

    // Limpieza automática
    sfx.once('complete', () => {
      this._instances.delete(sfx);
      sfx.destroy();
    });
    sfx.once('stop', () => {
      this._instances.delete(sfx);
      sfx.destroy();
    });

    this._instances.add(sfx);
    sfx.play();

    return sfx;
  }

  // ---------- Atajos por sonido (agrega aquí los que necesites) ----------


  /** Sonido de game over (src/audio/game/gameOver.mp3) */

  jumpPlayer() {
    // Pequeña variación aleatoria para que no suene idéntico cada vez
    const rate = Phaser.Math.FloatBetween(0.98, 1.02);
    const detune = Phaser.Math.Between(-20, 20);
    return this.play('jump', { volume: 0.9, rate, detune });
  }

  gameOver() {
    // Pequeña variación aleatoria para que no suene idéntico cada vez
    const rate = Phaser.Math.FloatBetween(0.98, 1.02);
    const detune = Phaser.Math.Between(-20, 20);
    return this.play('game-over', { volume: 0.9, rate, detune });
  }


  /** Sonido de sonar (src/audio/sonar.mp3) */
  sonar() {
    // Pequeña variación aleatoria para que no suene idéntico cada vez
    const rate = Phaser.Math.FloatBetween(0.98, 1.02);
    const detune = Phaser.Math.Between(-20, 20);
    return this.play('sfx-sonar', { volume: 0.9, rate, detune });
  }

  /** Ejemplo para “power up” si lo agregas al preload */
  power() {
    return this.play('sfx-power', { volume: 0.8 });
  }

  /** Ejemplo para salto si lo agregas al preload */
  jump() {
    const rate = Phaser.Math.FloatBetween(1.0, 1.1);
    return this.play('sfx-jump', { volume: 0.7, rate });
  }
}
