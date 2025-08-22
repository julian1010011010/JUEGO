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
// PlayerController.js
create(x, y, {
  texture = 'player_cat_1',
  animKey = 'player_cat_idle',
  body = { w: 24, h: 28 }
} = {}) {
  const { scene } = this;

  this.player = scene.physics.add.sprite(x, y, texture);
  this.player.setOrigin(0.5, 1);
  this.player.setBounce(0.05);
  this.player.setCollideWorldBounds(false);

  // Hitbox compacto y centrado
  this.player.body.setSize(body.w, body.h, true);
  this.player.body.setOffset(
    Math.round((this.player.width  - body.w) / 2),
    Math.round((this.player.height - body.h))
  );

  // Input
  this.cursors  = scene.input.keyboard.createCursorKeys();
  this.jumpKey  = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.jumpKeyUp= scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
  this.jumpKeyW = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  this.leftKeyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  this.rightKeyD= scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  this.downKeyS = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  scene.input.keyboard.addCapture([32,38,87,65,68,83]);

  this._setupTouchControls();

  // Collider + reinicio de saltos (igual a tu código actual)
  scene.physics.add.collider(this.player, scene.platforms, (p, plat) => { /* … */ },
                             (p, plat) => this._platformProcess(p, plat),
                             this);

  // Reaplica hitbox en cada frame por si el frame de la anim cambia dimensiones
  this.player.on('animationupdate', () => {
    this.player.body.setSize(body.w, body.h, true);
    this.player.body.setOffset(
      Math.round((this.player.width  - body.w) / 2),
      Math.round((this.player.height - body.h))
    );
  });

  if (scene.anims.exists(animKey))
    this.player.play({ key: animKey, ignoreIfPlaying: true });

  this.remainingJumps = this.maxJumps;
  scene.events.once('shutdown', () => this.destroy());
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
    // Verifica que this.cursors existe antes de acceder a sus propiedades
    let moveLeft = false, moveRight = false;
    if (this.cursors) {
      moveLeft = (this.cursors.left?.isDown || this.leftPressed || this.leftKeyA?.isDown);
      moveRight = (this.cursors.right?.isDown || this.rightPressed || this.rightKeyD?.isDown);
    }

    // --- Salto táctil automático ---
    // Si se está tocando izquierda o derecha, salta automáticamente
  const jumpTouch = this.jumpTouchRequested;
this.jumpTouchRequested = false; 
    // --- Estado de suelo y coyote ---
    const grounded  = this.player.body.touching.down || this.player.body.blocked.down;
    const canCoyote = scene.time.now - this.lastGroundTime <= 200;

    // --- Detección de salto (una sola vez por frame) ---

    
const jumpPressed =
  (this.jumpKey   && Phaser.Input.Keyboard.JustDown(this.jumpKey))   ||
  (this.jumpKeyUp && Phaser.Input.Keyboard.JustDown(this.jumpKeyUp)) ||
  (this.jumpKeyW  && Phaser.Input.Keyboard.JustDown(this.jumpKeyW))  ||
  (this.cursors && this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
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