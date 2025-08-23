// src/player/PlayerController.js
import Phaser from "phaser";
import PlayerColorManager from "../effects/PlayerColorManager";
import SoundFX from "../audio/SoundFX";

/**
 * Controlador del jugador:
 * - Input, colisiones, movimiento, salto (coyote), doble salto, wrap,
 *   plataformas especiales y animación por estado usando un spritesheet por FILAS.
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
    const base = tex.frames.__BASE;
    const fw = base?.width ?? this.frameWidth;
    const cols = Math.max(1, Math.floor(img.width / fw));

    for (const r of rows) {
      if (!r?.name) continue;
      if (this.scene.anims.exists(r.name)) continue;

      const start = r.row * cols + r.from;
      const end = r.row * cols + r.to;
      const frames = this.scene.anims.generateFrameNumbers(this.sheetKey, { start, end });
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

  // ===== Attach / Create =====
  attach(sprite, { body = { w: 24, h: 28 }, animKey = "idle" } = {}) {
    const { scene } = this;
    this.player = sprite;

    this.player.setOrigin(0.5, 1);
    this.player.setBounce(0.05);
    this.player.setCollideWorldBounds(false);

    if (this.player.body?.setSize) {
      this.player.body.setSize(body.w, body.h, true);
      this.player.body.setOffset(
        Math.round((this.player.width - body.w) / 2),
        Math.round(this.player.height - body.h)
      );
    }

    // Input teclado
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.jumpKeyUp = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.jumpKeyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.leftKeyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKeyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.downKeyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    scene.input.keyboard.addCapture([32, 38, 87, 65, 68, 83]);

    // Touch zones
    this._setupTouchControls();

    // Collider con plataformas
    scene.physics.add.collider(
      this.player,
      scene.platforms,
      (p, plat) => {
        if (p.body?.touching?.down || p.body?.blocked?.down) {
          this.lastGroundTime = scene.time.now;
          this.currentPlatform = plat || null;
        }
      },
      (p, plat) => this._platformProcess(p, plat),
      this
    );

    // Reaplicar hitbox si cambia frame
    this.player.on?.("animationupdate", () => {
      if (!this.player?.body) return;
      this.player.body.setSize(body.w, body.h, true);
      this.player.body.setOffset(
        Math.round((this.player.width - body.w) / 2),
        Math.round(this.player.height - body.h)
      );
    });

    this.remainingJumps = this.maxJumps;
    if (animKey) this._play(animKey);

    scene.events.once("shutdown", () => this.destroy());
    return this.player;
  }

  create(x, y, { texture = "player_sheet", animKey = "idle", body = { w: 24, h: 28 } } = {}) {
    const { scene } = this;

    this.player = scene.physics.add.sprite(x, y, texture);
    this.player.setOrigin(0.5, 1);
    this.player.setBounce(0.05);
    this.player.setCollideWorldBounds(false);

    this.player.body.setSize(body.w, body.h, true);
    this.player.body.setOffset(
      Math.round((this.player.width - body.w) / 2),
      Math.round(this.player.height - body.h)
    );

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

    // Collider + reinicio de saltos
    scene.physics.add.collider(
      this.player,
      scene.platforms,
      () => {},
      (p, plat) => this._platformProcess(p, plat),
      this
    );

    this.player.on("animationupdate", () => {
      this.player.body.setSize(body.w, body.h, true);
      this.player.body.setOffset(
        Math.round((this.player.width - body.w) / 2),
        Math.round(this.player.height - body.h)
      );
    });

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
    const speed = 220;
    const onIce = scene.time.now <= this._onIceUntil;

    // Movimiento horizontal
    let moveLeft = false,
      moveRight = false;
    if (this.cursors) {
      moveLeft = this.cursors.left?.isDown || this.leftPressed || this.leftKeyA?.isDown;
      moveRight = this.cursors.right?.isDown || this.rightPressed || this.rightKeyD?.isDown;
    }

    // Touch: salto si pidió
    const jumpTouch = this.jumpTouchRequested;
    this.jumpTouchRequested = false;

    // Suelo/coyote
    const grounded = this.player.body.touching.down || this.player.body.blocked.down;
    const canCoyote = scene.time.now - this.lastGroundTime <= 200;

    // Detección de salto
    const jumpPressed =
      (this.jumpKey && Phaser.Input.Keyboard.JustDown(this.jumpKey)) ||
      (this.jumpKeyUp && Phaser.Input.Keyboard.JustDown(this.jumpKeyUp)) ||
      (this.jumpKeyW && Phaser.Input.Keyboard.JustDown(this.jumpKeyW)) ||
      (this.cursors && this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
      jumpTouch;

    if (jumpPressed && (grounded || canCoyote || this.remainingJumps > 0)) {
      this.sfx.jumpPlayer();

      if (!grounded && !canCoyote) {
        this.remainingJumps -= 1; // doble salto
      } else {
        this.remainingJumps = this.maxJumps - 1;
      }
      this.player.setVelocityY(-620);

      // Escurridizas
      const candidates = scene.platforms.getChildren().filter((p) => p && p.isDodger);
      let best = null,
        bestDy = Infinity;
      for (const p of candidates) {
        const dx = Math.abs(p.x - this.player.x);
        const dy = p.y - this.player.y;
        const canDodge =
          dx <= this.dodgerDx && dy >= this.dodgerMinDy && dy <= this.dodgerMaxDy;
        const cooldownOk = !p._lastDodgeTime || scene.time.now - p._lastDodgeTime > this.dodgerCooldown;
        if (canDodge && cooldownOk && dy < bestDy) {
          best = p;
          bestDy = dy;
        }
      }
      if (best) this.relocateDodger(best);

      // Frágil
      if (this.currentPlatform && this.currentPlatform.isFragile && !this.currentPlatform._broken) {
        this.currentPlatform._broken = true;
        scene.time.delayedCall(60, () => {
          if (this.currentPlatform && this.currentPlatform.active) this.currentPlatform.destroy();
        });
      }
      this.currentPlatform = null;
    }

    // Movimiento X
    if (onIce) {
      this.player.setDragX(60);
      let vx = this.player.body.velocity.x;
      if (moveLeft) vx = Phaser.Math.Clamp(vx - 24, -speed, speed);
      else if (moveRight) vx = Phaser.Math.Clamp(vx + 24, -speed, speed);
      this.player.setVelocityX(vx);
      this.player.setFlipX(vx < 0);
    } else {
      this.player.setDragX(0);
      if (moveLeft) {
        this.player.setVelocityX(-speed);
        this.player.setFlipX(true);
      } else if (moveRight) {
        this.player.setVelocityX(speed);
        this.player.setFlipX(false);
      } else {
        this.player.setVelocityX(0);
      }
    }

    // Wrap
    if (this.player.x < 0) this.player.setX(width);
    else if (this.player.x > width) this.player.setX(0);

    // Reubicar escurridizas al ascender
    if (this.player.body.velocity.y < -50) {
      scene.platforms.children.iterate((plat) => {
        if (!plat || !plat.isDodger) return;
        const dx = Math.abs(plat.x - this.player.x);
        const dy = plat.y - this.player.y;
        const cooldownOk = !plat._lastDodgeTime || scene.time.now - plat._lastDodgeTime > this.dodgerCooldown;
        if (dx <= this.dodgerDx && dy >= this.dodgerMinDy && dy <= this.dodgerMaxDy && cooldownOk) {
          this.relocateDodger(plat);
        }
      });
    }

    // Animación por estado
    const vy = this.player.body.velocity.y;
    const movingX = moveLeft || moveRight || Math.abs(this.player.body.velocity.x) > 2;

    if (!grounded) this._play(vy < 0 ? "jump" : "fall");
    else if (movingX) this._play("walk");
    else this._play("idle");
  }

  // ===== Utilidades =====
  relocateDodger(plat) {
    const width = this.scene.scale.width;
    let newX,
      attempts = 0;
    do {
      newX = Phaser.Math.Between(12, width - 12);
      attempts++;
    } while (Math.abs(newX - plat.x) < 100 && attempts < 8);

    plat.x = newX;
    if (plat.body?.updateFromGameObject) plat.body.updateFromGameObject();
    plat._lastDodgeTime = this.scene.time.now;

    this.scene.tweens.add({
      targets: plat,
      alpha: { from: 0.4, to: 1 },
      duration: 150,
      ease: "Quad.out",
    });
  }

  destroy() {
    try {
      this._deadlyOverlap?.destroy?.();
    } catch {}
    try {
      this.playerColorManager?.destroy?.();
    } catch {}
    this._deadlyOverlap = null;
    this.playerColorManager = null;
  }

  killPlayer(reason = "") {
    if (this.player) {
      this.player.setVelocity(0, 0);
      this.player.setAlpha(0.5);
      this.player.setTint(0xff0000);
      this.player.active = false;
      if (this.player.body) this.player.body.enable = false;
    }
    if (this.scene?.gameOver) this.scene.gameOver(reason);
  }

  _setupTouchControls() {
    const { scene } = this;
    const midX = scene.scale.width / 2;
    const fullH = scene.scale.height;

    const leftZone = scene.add.zone(0, 0, midX, fullH).setOrigin(0).setInteractive();
    const rightZone = scene.add.zone(midX, 0, midX, fullH).setOrigin(0).setInteractive();

    leftZone.on("pointerdown", () => {
      this.leftPressed = true;
      this._requestJump();
    });
    leftZone.on("pointerup", () => (this.leftPressed = false));
    leftZone.on("pointerout", () => (this.leftPressed = false));

    rightZone.on("pointerdown", () => {
      this.rightPressed = true;
      this._requestJump();
    });
    rightZone.on("pointerup", () => (this.rightPressed = false));
    rightZone.on("pointerout", () => (this.rightPressed = false));
  }
  _requestJump() {
    this.jumpTouchRequested = true;
  }

  _platformProcess(player, plat) {
    try {
      const now = this.scene.time.now;
      const pb = player.body;
      const sb = plat.body;
      if (!pb || !sb) return true;

      const ghostActive = !!(player._ghostUntil && now <= player._ghostUntil);
      if (!ghostActive) return true;

      if (pb.velocity.y < 0) return false; // subiendo: atraviesa
      return pb.bottom <= sb.top + 6; // bajando: solo desde arriba
    } catch {
      return true;
    }
  }
}
