export default class TextureFactory {
  static createTextures(scene) {
    // Estado inicial de misiles y freeze
    scene._missilesState = scene?.gameConfig?.lavaMissiles?.enabled ? "on" : "off";
    scene._freezeAt10mFired = false;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // Jugador
    g.fillStyle(0x7dd3fc, 1);
    g.fillRoundedRect(0, 0, 28, 28, 6);
    g.fillStyle(0x0b1020, 1);
    g.fillCircle(9, 11, 3);
    g.fillCircle(19, 11, 3);
    g.fillRect(9, 18, 10, 3);
    g.generateTexture("player", 28, 28);

    // Plataforma
    g.clear();
    g.fillStyle(0x93c5fd, 1);
    g.fillRoundedRect(0, 0, 90, 18, 8);
    g.lineStyle(2, 0x1e293b, 0.3);
    g.strokeRoundedRect(1, 1, 88, 16, 8);
    g.generateTexture("platform", 90, 18);

    // Lava tile (64x32) - líneas onduladas y puntos más aleatorios
    g.clear();
    const w = 64, h = 32;
    g.fillStyle(0xdc2626, 1);
    g.fillRect(0, 0, w, h);
    // Líneas rojas oscuras onduladas
    g.fillStyle(0x991b1b, 1);
    for (let y = 4; y < h; y += 8) {
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const offset = Math.sin((x / w) * Math.PI * 2 + y) * 3;
        if (x === 0) g.moveTo(x, y + offset);
        else g.lineTo(x, y + offset);
      }
      g.lineTo(w, y + 3);
      g.lineTo(0, y + 3);
      g.closePath();
      g.fillPath();
    }
    // Puntos amarillos más aleatorios
    g.fillStyle(0xf5290b, 1);
    for (let i = 0; i < 12; i++) {
      const px = Phaser.Math.Between(4, w - 4) + Phaser.Math.Between(-2, 2);
      const py = Phaser.Math.Between(4, h - 4) + Phaser.Math.Between(-2, 2);
      g.fillCircle(px, py, Phaser.Math.Between(2, 4));
    }
    g.generateTexture("lava", w, h);

    // Pulgar arriba (simple)
    g.clear();
    const hw = 28, hh = 40;
    g.fillStyle(0xffe0b2, 1);
    g.fillRoundedRect(10, 18, 12, 18, 6); // palma
    g.save();
    g.translateCanvas(16, 18);
    g.rotateCanvas(-0.6);
    g.fillRoundedRect(0, -10, 10, 14, 5); // pulgar
    g.restore();
    g.fillRoundedRect(6, 10, 18, 6, 3);
    g.fillRoundedRect(6, 6, 16, 5, 2);
    g.fillRoundedRect(6, 3, 14, 4, 2);
    g.lineStyle(2, 0x8c6239, 0.4);
    g.strokeRoundedRect(10, 18, 12, 18, 6);
    g.generateTexture("thumb_up", hw, hh);

    // Pixel blanco 1x1 (para partículas pixel-art)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("px", 1, 1);

    // Animación idle para el jugador (simple ejemplo: parpadeo)
    scene.anims.create({
      key: "player_idle",
      frames: [{ key: "player", frame: 0 }],
      frameRate: 2,
      repeat: -1,
    });

    g.destroy();
  }
}
