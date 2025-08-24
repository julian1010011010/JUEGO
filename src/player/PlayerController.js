// src/player/PlayerController.js
import Phaser from "phaser";
import PlayerColorManager from "../effects/PlayerColorManager";
import SoundFX from "../audio/SoundFX";

/**
 * Controlador del jugador:
 * - Input, colisiones, movimiento, salto (coyote), doble salto, wrap,
 *   plataformas especiales y animación por estado usando un spritesheet por FILAS.
 *
 * Mejoras aplicadas:
 * - Animaciones por fila robustas (índices correctos + clamp).
 * - Collider unificado para coyote/doble salto.
 * - Reset de saltos al aterrizar.
 * - Zonas táctiles con cleanup en destroy().
 * - Movimiento con aceleración/drag consistente en suelo/hielo.
 * - Hitbox estable con ajuste al flipX.
 */
export default class PlayerController {
  constructor(scene) {
    this.scene = scene;
    this.sfx = new SoundFX(scene);

    // Estado básico
    this.player = null;
    this.cursors = null;
    this.jumpKey = null;
    this.jumpKeyUp = null;
    this.jumpKeyW = null;
    this.leftKeyA = null;
    this.rightKeyD = null;
    this.downKeyS = null;

    // Saltos y piso
    this.maxJumps = 2;
    this.remainingJumps = 0;
    this.lastGroundTime = 0;
    this.currentPlatform = null;
    this._onIceUntil = 0;

    // Touch
    this.jumpTouchRequested = false;
    this.leftPressed = false;
    this.rightPressed = false;

    // Escurridizas
    this.dodgerDx = 80;
    this.dodgerMinDy = 30;
    this.dodgerMaxDy = 160;
    this.dodgerCooldown = 700;

    // Sheet/anim
    this.sheetKey = "player_sheet";
    this.frameWidth = 64;
    this.frameHeight = 64;
    this._lastAnim = null;

    // Limpieza
    this._deadlyOverlap = null;
    this.playerColorManager = null;

    // Touch zones
    this._leftZone = null;
    this._rightZone = null;

    // Caja de colisión base
    this._bodyBox = { w: 24, h: 28 };
  }

  // ===== Sheet y animaciones =====
  configureSheet({ sheetKey = "player_sheet", frameWidth = 64, frameHeight = 64 } = {}) {
    this.sheetKey = sheetKey;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
  }

  createRowAnimations({ rows = [], frameRate = 12, repeat = -1 } = {}) {
    const tex = this.scene.textures.get(this.sheetKey);
    if (!tex) throw new Error(`[PlayerController] Falta textura ${this.sheetKey}.`);

    const img = tex.getSourceImage();
    const frameW = this.frameWidth || 32;
    const cols = Math.max(1, Math.floor(img.width / frameW));
    const totalFrames = Object.keys(tex.frames).filter(k => k !== "__BASE").length;

    for (const r of rows) {
      if (!r?.name || r.row == null || r.from == null || r.to == null) continue;
      if (this.scene.anims.exists(r.name)) continue;

      const startIdx = r.row * cols + r.from;
      const endIdx = r.row * cols + r.to;
      const startClamped = Phaser.Math.Clamp(startIdx, 0, totalFrames - 1);
      const endClamped = Phaser.Math.Clamp(endIdx, 0, totalFrames - 1);

      const frames = this.scene.anims.generateFrameNumbers(this.sheetKey, {
        start: startClamped,
        end: endClamped,
      });

      this.scene.anims.create({
        key: r.name,
        frames,
        frameRate: r.frameRate ?? frameRate,
        repeat: r.repeat ?? repeat,
      });
    }
  }

  _play(key) {
    if (!key || !this.player?.anims) return;
    if (this._lastAnim === key) return;
    if (!this.scene.anims.exists(key)) return;
    this.player.play({ key, ignoreIfPlaying: true });
    this._lastAnim = key;
  }

  // ===== Utilidades de colisión y hitbox =====
  _onLand(p, plat) {
    if (p.body?.touching?.down || p.body?.blocked?.down) {
      this.lastGroundTime = this.scene.time.now;
      this.currentPlatform = plat || null;
    }
  }

  _addPlatformCollider() {
    const { scene } = this;
    return scene.physics.add.collider(
      this.player,
      scene.platforms,
      (p, plat) => this._onLand(p, plat),
      (p, plat) => this._platformProcess(p, plat),
      this
    );
  }

  _applyBodyBox() {
    if (!this.player?.body) return;
    const { w, h } = this._bodyBox;
    const baseOffsetX = Math.round((this.player.width - w) / 2);
    const baseOffsetY = Math.round(this.player.height - h);
    const flip = !!this.player.flipX;
    const ox = flip ? (this.player.width - w - baseOffsetX) : baseOffsetX;
    this.player.body.setSize(w, h, true);
    this.player.body.setOffset(ox, baseOffsetY);
  }

  _updateJumpReset(grounded) {
    if (grounded && this.player._wasGrounded === false) {
      this.remainingJumps = this.maxJumps;
    }
    this.player._wasGrounded = grounded;
  }

  // ===== Attach / Create =====
  attach(sprite, { body = { w: 24, h: 28 }, animKey = "idle" } = {}) {
    const { scene } = this;
    this.player = sprite;
    this.player.setOrigin(0.5, 1).setBounce(0.05).setCollideWorldBounds(false);

    this._bodyBox = { w: body.w, h: body.h };
    if (this.player.body?.setSize) this._applyBodyBox();

    // Input teclado
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.jumpKeyUp = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.jumpKeyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.leftKeyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKeyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.downKeyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    scene.input.keyboard.addCapture([32, 38, 87, 65, 68, 83]);

    // Touch
    this._setupTouchControls();

    // Collider
    this._addPlatformCollider();

    // Hitbox por frame
    this.player.on?.("animationupdate", () => this._applyBodyBox());

    this.remainingJumps = this.maxJumps;
    if (animKey) this._play(animKey);
    scene.events.once("shutdown", () => this.destroy());
    return this.player;
  }

  create(x, y, { texture = "player_sheet", animKey = "idle", body = { w: 24, h: 28 } } = {}) {
    const { scene } = this;
    this.player = scene.physics.add.sprite(x, y, texture);
    this.player.setOrigin(0.5, 1).setBounce(0.05).setCollideWorldBounds(false);

    this._bodyBox = { w: body.w, h: body.h };
    this._applyBodyBox();

    // Input
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.jumpKeyUp = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.jumpKeyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.leftKeyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKeyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.downKeyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    scene.input.keyboard.addCapture([32, 38, 87, 65, 68, 83]);

    this._setupTouchControls();
    this._addPlatformCollider();

    this.player.on("animationupdate", () => this._applyBodyBox());

    this._play(animKey);
    this.remainingJumps = this.maxJumps;
    scene.events.once("shutdown", () => this.destroy());
    return this.player;
  }

  // ===== Update =====
  setOnIceUntil(timestampMs) {
    this._onIceUntil = timestampMs;
  }

  update() {
    const { scene } = this;
    if (!this.player || !this.player.body) return;

    const width = scene.scale.width;
    const onIce = scene.time.now <= this._onIceUntil;

    let moveLeft = false, moveRight = false;
    if (this.cursors) {
      moveLeft = this.cursors.left?.isDown || this.leftPressed || this.leftKeyA?.isDown;
      moveRight = this.cursors.right?.isDown || this.rightPressed || this.rightKeyD?.isDown;
    }

    const jumpTouch = this.jumpTouchRequested;
    this.jumpTouchRequested = false;

    const grounded = this.player.body.touching.down || this.player.body.blocked.down;
    const canCoyote = scene.time.now - this.lastGroundTime <= 200;
    this._updateJumpReset(grounded);

    const jumpPressed =
      (this.jumpKey && Phaser.Input.Keyboard.JustDown(this.jumpKey)) ||
      (this.jumpKeyUp && Phaser.Input.Keyboard.JustDown(this.jumpKeyUp)) ||
      (this.jumpKeyW && Phaser.Input.Keyboard.JustDown(this.jumpKeyW)) ||
      (this.cursors && this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
      jumpTouch;

    if (jumpPressed && (grounded || canCoyote || this.remainingJumps > 0)) {
      this.sfx.jumpPlayer();
      if (!grounded && !canCoyote) this.remainingJumps -= 1;
      else this.remainingJumps = this.maxJumps - 1;
      this.player.setVelocityY(-620);
      this.currentPlatform = null;
    }

    // Movimiento X (aceleración homogénea)
    const maxSpeed = 220;
    const accel = onIce ? 240 : 1200;
    const dragX = onIce ? 300 : 1200;
    this.player.setDragX(dragX);

    if (moveLeft) this.player.setAccelerationX(-accel);
    else if (moveRight) this.player.setAccelerationX(accel);
    else this.player.setAccelerationX(0);

    const clampedVx = Phaser.Math.Clamp(this.player.body.velocity.x, -maxSpeed, maxSpeed);
    this.player.setVelocityX(clampedVx);
    this.player.setFlipX(clampedVx < 0);
    this._applyBodyBox();

    // Wrap
    if (this.player.x < 0) this.player.setX(width);
    else if (this.player.x > width) this.player.setX(0);

    // Animación por estado
    const vy = this.player.body.velocity.y;
    const movingX = moveLeft || moveRight || Math.abs(this.player.body.velocity.x) > 2;
    if (!grounded) this._play(vy < 0 ? "jump" : "fall");
    else if (movingX) this._play("walk");
    else this._play("idle");
  }

  // ===== Utilidades =====
  destroy() {
    try { this._deadlyOverlap?.destroy?.(); } catch {}
    try { this.playerColorManager?.destroy?.(); } catch {}
    try { this._leftZone?.destroy?.(); } catch {}
    try { this._rightZone?.destroy?.(); } catch {}
    this._deadlyOverlap = null;
    this.playerColorManager = null;
    this._leftZone = this._rightZone = null;
  }

  _setupTouchControls() {
    const { scene } = this;
    const midX = scene.scale.width / 2;
    const fullH = scene.scale.height;

    this._leftZone = scene.add.zone(0, 0, midX, fullH).setOrigin(0).setInteractive();
    this._rightZone = scene.add.zone(midX, 0, midX, fullH).setOrigin(0).setInteractive();
    this._leftZone.setScrollFactor?.(0);
    this._rightZone.setScrollFactor?.(0);

    this._leftZone.on("pointerdown", () => { this.leftPressed = true; this._requestJump(); });
    this._leftZone.on("pointerup", () => (this.leftPressed = false));
    this._leftZone.on("pointerout", () => (this.leftPressed = false));

    this._rightZone.on("pointerdown", () => { this.rightPressed = true; this._requestJump(); });
    this._rightZone.on("pointerup", () => (this.rightPressed = false));
    this._rightZone.on("pointerout", () => (this.rightPressed = false));
  }

  _requestJump() {
    this.jumpTouchRequested = true;
  }

  _platformProcess(player, plat) {
    try {
      const now = this.scene.time.now;
      const pb = player.body, sb = plat.body;
      if (!pb || !sb) return true;

      const ghostActive = !!(player._ghostUntil && now <= player._ghostUntil);
      if (!ghostActive) return true;

      if (pb.velocity.y < 0) return false;
      return pb.bottom <= sb.top + 6;
    } catch { return true; }
  }
}
