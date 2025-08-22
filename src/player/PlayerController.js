import Phaser from "phaser";
import PlayerColorManager from "../effects/PlayerColorManager";
import SoundFX from "../audio/SoundFX";

/**
 * Controlador del jugador:
 * - Creación de sprite, input, colisiones, movimiento, salto (con coyote), doble salto,
 *   wrap horizontal y lógica de plataformas especiales (escurridizas, frágiles, hielo, temporizadas).
 */
export default class PlayerController {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.sfx = new SoundFX(scene);


    // Para salto con touch
    this.jumpTouchRequested = false;

    // Entidades / input
    this.player = null;
    this.cursors = null;
    this.jumpKey = null;
    this.jumpKeyUp = null;
    this.jumpKeyW = null;

    // Estado de piso y plataforma actual
    this.lastGroundTime = 0;
    this.currentPlatform = null;
    this._onIceUntil = 0;

    // Entrada táctil
    this.leftPressed = false;
    this.rightPressed = false;

    // Config de plataformas escurridizas
    this.dodgerDx = 80;
    this.dodgerMinDy = 30;
    this.dodgerMaxDy = 160;
    this.dodgerCooldown = 700;

    // Gestor de color
    this.playerColorManager = null;

    // Saltos
    this.maxJumps = 2;        // <- doble salto
    this.remainingJumps = 0;  // se reinicia al aterrizar
  }

  /** Crea sprite, input y colisión con plataformas. */
  create(x, y) {
    const { scene } = this;

    // Jugador
    this.player = scene.physics.add.sprite(x, y, "player");
    this.player.setBounce(0.05);
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(24, 28);

    // Input
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.jumpKey   = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.jumpKeyUp = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.jumpKeyW  = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.leftKeyA  = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKeyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.downKeyS  = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    scene.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.S,
    ]);

    // Toques
    this._setupTouchControls();

    // Color manager
    this.playerColorManager = new PlayerColorManager(scene, this.player);
    this.playerColorManager.applyWhileOverlap(scene.platforms, null, 80);

    // Colisión con plataformas (incluye reinicio de saltos)
    scene.physics.add.collider(
      this.player,
      scene.platforms,
      (_player, plat) => {
        if (!plat || !plat.body) return;

        const pb = this.player.body;
        const sb = plat.body;
        const landing = pb.velocity.y >= 0 && pb.bottom <= sb.top + 8;

        if (landing || pb.touching.down || pb.blocked.down) {
          // Aterrizaje: reinicia ventana coyote y contador de saltos
          this.lastGroundTime = scene.time.now;
          this.currentPlatform = plat;
          this.remainingJumps = this.maxJumps;

          // Temporizadas (desaparecen si sigues encima 2s)
          if (plat.isTimed && !plat._timing) {
            plat._timing = true;
            plat._timer = scene.time.delayedCall(2000, () => {
              if (plat && plat.active && this.currentPlatform === plat) {
                scene.tweens.killTweensOf(plat);
                plat.destroy();
              }
              if (plat) {
                plat._timing = false;
                plat._timer = null;
              }
            });
          }

          // Hielo
          if (plat.isIce) this._onIceUntil = scene.time.now + 350;

          // Insta kill
          if (plat.isDeadly) {
            this.killPlayer('deadly');
          }
        }
      },
      (player, plat) => this._platformProcess(player, plat),
      this
    );
    
   
 
    // Cleanup en shutdown
    scene.events.once("shutdown", () => this.destroy());

    // Estado inicial
    this.remainingJumps = this.maxJumps;
    return this.player;
  }

  /** Update por frame: movimiento, salto, wrap y lógicas asociadas. */
  update() {
    const { scene } = this;
    if (!this.player || !this.player.body) return;

    const width  = scene.scale.width;
    const speed  = 220;
    const onIce  = scene.time.now <= this._onIceUntil;

    // --- Movimiento horizontal (con efecto hielo) ---
    let moveLeft = this.cursors.left.isDown || this.leftPressed || this.leftKeyA.isDown;
    let moveRight = this.cursors.right.isDown || this.rightPressed || this.rightKeyD.isDown;

    // --- Salto táctil automático ---
    // Si se está tocando izquierda o derecha, salta automáticamente
  const jumpTouch = this.jumpTouchRequested;
this.jumpTouchRequested = false; 
    // --- Estado de suelo y coyote ---
    const grounded  = this.player.body.touching.down || this.player.body.blocked.down;
    const canCoyote = scene.time.now - this.lastGroundTime <= 200;

    // --- Detección de salto (una sola vez por frame) ---

    
const jumpPressed =
  Phaser.Input.Keyboard.JustDown(this.jumpKey)   ||
  Phaser.Input.Keyboard.JustDown(this.jumpKeyUp) ||
  Phaser.Input.Keyboard.JustDown(this.jumpKeyW)  ||
  Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
  jumpTouch;

    // --- ÚNICO bloque de salto (incluye doble salto) ---
    if (jumpPressed && (grounded || canCoyote || this.remainingJumps > 0)) {
      this.sfx.jumpPlayer();

      // Consumo del salto
      if (!grounded && !canCoyote) {
        // En el aire: doble salto
        this.remainingJumps -= 1;
      } else {
        // Desde suelo o coyote: deja disponibles los extra
        this.remainingJumps = this.maxJumps - 1;
      }

      // Impulso vertical
      this.player.setVelocityY(-620);

      // Reubicar mejor plataforma escurridiza si conviene
      const candidates = scene.platforms.getChildren().filter(p => p && p.isDodger);
      let best = null, bestDy = Infinity;
      for (const p of candidates) {
        const dx = Math.abs(p.x - this.player.x);
        const dy = p.y - this.player.y;
        const canDodge = dx <= this.dodgerDx && dy >= this.dodgerMinDy && dy <= this.dodgerMaxDy;
        const cooldownOk = !p._lastDodgeTime || scene.time.now - p._lastDodgeTime > this.dodgerCooldown;
        if (canDodge && cooldownOk && dy < bestDy) { best = p; bestDy = dy; }
      }
      if (best) this.relocateDodger(best);

      // Romper frágil al despegar
      if (this.currentPlatform && this.currentPlatform.isFragile && !this.currentPlatform._broken) {
        this.currentPlatform._broken = true;
        scene.time.delayedCall(60, () => {
          if (this.currentPlatform && this.currentPlatform.active) this.currentPlatform.destroy();
        });
      }
      this.currentPlatform = null;
    }

    // --- Movimiento horizontal táctil ---
    if (onIce) {
      this.player.setDragX(60);
      let vx = this.player.body.velocity.x;
      if (moveLeft)
        vx = Phaser.Math.Clamp(vx - 24, -speed, speed);
      else if (moveRight)
        vx = Phaser.Math.Clamp(vx + 24, -speed, speed);
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

    // --- Wrap horizontal ---
    if (this.player.x < 0)       this.player.setX(width);
    else if (this.player.x > width) this.player.setX(0);

    // --- Reubicación escurridizas al ascender ---
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
  }

  /** Reubica una plataforma "escurridiza". */
  relocateDodger(plat) {
    const width = this.scene.scale.width;
    let newX, attempts = 0;
    do {
      newX = Phaser.Math.Between(12, width - 12);
      attempts++;
    } while (Math.abs(newX - plat.x) < 100 && attempts < 8);

    plat.x = newX;
    if (plat.body && plat.body.updateFromGameObject) plat.body.updateFromGameObject();
    plat._lastDodgeTime = this.scene.time.now;

    this.scene.tweens.add({
      targets: plat,
      alpha: { from: 0.4, to: 1 },
      duration: 150,
      ease: "Quad.out",
    });
  }

  /** Limpia listeners y referencias. */
destroy() {
  try { this._deadlyOverlap?.destroy?.(); } catch {}
  try { this.playerColorManager?.destroy?.(); } catch {}
  this._deadlyOverlap = null;
  this.playerColorManager = null;
}
  /**
   * Mata al jugador y ejecuta la lógica de game over.
   * @param {string} [reason] - Motivo de la muerte (opcional).
   */
  killPlayer(reason = '') {
    if (this.player) {
      this.player.setVelocity(0, 0)
      this.player.setAlpha(0.5)
      this.player.setTint(0xff0000)
      this.player.active = false
      if (this.player.body) this.player.body.enable = false
    }
    // Lógica de game over (puedes personalizar)
    if (this.scene?.gameOver) {
      this.scene.gameOver(reason)
    }
    // Puedes agregar efectos, sonidos, etc.
  }

 _setupTouchControls() {
  const { scene } = this;
  const midX = scene.scale.width / 2;
  const fullH = scene.scale.height;

  const leftZone = scene.add.zone(0, 0, midX, fullH).setOrigin(0).setInteractive();
  const rightZone = scene.add.zone(midX, 0, midX, fullH).setOrigin(0).setInteractive();

  // Izquierda
  leftZone.on("pointerdown", () => {
    this.leftPressed = true;
    this._requestJump();   // <<< salto inmediato
  });
  leftZone.on("pointerup", () => (this.leftPressed = false));
  leftZone.on("pointerout", () => (this.leftPressed = false));

  // Derecha
  rightZone.on("pointerdown", () => {
    this.rightPressed = true;
    this._requestJump();   // <<< salto inmediato
  });
  rightZone.on("pointerup", () => (this.rightPressed = false));
  rightZone.on("pointerout", () => (this.rightPressed = false));
}
_requestJump() {
  this.jumpTouchRequested = true;
}

  /**
   * Procesa colisión jugador/plataforma para modo "fantasma":
   * - Ascendiendo: atraviesa plataformas desde abajo.
   * - Descendiendo: solo colisiona si está por encima.
   */
  _platformProcess(player, plat) {
    try {
      const now = this.scene.time.now;
      const pb = player.body;
      const sb = plat.body;
      if (!pb || !sb) return true;

      const ghostActive = !!(player._ghostUntil && now <= player._ghostUntil);
      if (!ghostActive) return true;

      if (pb.velocity.y < 0) return false; // subiendo: sin colisión
      return pb.bottom <= sb.top + 6;       // bajando: solo desde arriba
    } catch {
      return true;
    }
  }
}