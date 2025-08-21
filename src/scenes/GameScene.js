import Phaser from "phaser";
import PlatformFactory from "../platforms/PlatformFactory";
import PowerManager from "../powers/PowerManager";
import PlayerController from "../player/PlayerController";
import gameConfig from "../config/gameConfig";
import LavaParticle from "../effects/LavaParticle";
import { playLavaDeath } from "../effects/playLavaDeath";
import UserInfo from "../user/UserInfo";
import SoundFX from "../audio/SoundFX";
import BackgroundFactory from "../backgrounds/BackgroundFactory";
import {
  preloadLadyLava,
  createLadyLavaAnimation,
} from "../sprites/animation/LadyLava/ladyLava.js";
import { LadyLavaText } from "../ui/LadyLavaText.js";
import { Timer } from "../ui/Timer.js";

// arriba del archivo
export default class GameScene extends Phaser.Scene {
  constructor() {
    super("game");

    //#region Variables
    // Entidades y estado base
    this.player = null;
    this.playerCtrl = null;
    this.platforms = null;
    this.cursors = null;
    this.score = 0;
    this.best = Number(localStorage.getItem("best_score") || 0);

    // Salto / contacto suelo
    this.lastGroundTime = 0;
    this.currentPlatform = null;

    // Lava (visual) y muerte
    this.lavaHeight = 56;
    this.lavaRiseSpeed = 120;
    this.lavaOffset = 0;
    // this.lavaKillMargin = 3
    this.lavaKillMargin = gameConfig?.lava?.killMargin ?? 6;

    // Plataformas escurridizas (que se mueven al intentar alcanzarlas)
    this.dodgerDx = 80;
    this.dodgerMinDy = 30;
    this.dodgerMaxDy = 160;
    this.dodgerCooldown = 700;

    // Estados de juego / animaciones
    this.hasAscended = false;
    this._playedLavaAnim = false;
    this._ended = false;
    // Ventana temporal de resbalón cuando pisas hielo
    this._onIceUntil = 0;

    // Misiles de lava
    this.lavaMissiles = null;
    this._lavaMissileTimer = null;
    // Factor para acelerar la subida de lava dinámicamente (p.ej. durante poderes)
    this.lavaRiseBoost = 1;
    // Flag tiempo de lava congelada
    this.lavaFrozenUntil = 0;
    // Superficie física temporal para caminar sobre lava congelada
    this.lavaSurface = null;
    this.lavaSurfaceCollider = null;

    this.sonidoPower = null; // NUEVO: referencia al sonido de poder

    //#endregion
  }

  /** Devuelve un X aleatorio evitando el eje X de la base según config. */
  pickSpawnX() {
    const width = this.scale.width;
    const baseX = this.platformBaseX ?? width / 2;
    const avoidRadius = Number(gameConfig?.platforms?.avoidBaseXRadius) || 0;
    const minX = 12,
      maxX = width - 12;
    if (avoidRadius <= 0) return Phaser.Math.Between(minX, maxX);
    let x;
    let attempts = 0;
    do {
      x = Phaser.Math.Between(minX, maxX);
      attempts++;
    } while (Math.abs(x - baseX) < avoidRadius && attempts < 16);
    return x;
  }

  preload() {
    // Corrige la carga del fondo
    SoundFX.preload(this);
    this.load.image("bg", "src/sprites/fondo/1.png");
    this.load.audio("sfx-sonar", "audio/sonar.mp3"); // <-- Asegúrate de que el archivo exista en esta ruta
    this.createTextures();
    this.load.image("terminator", "src/effects/images/terminator.png");
    preloadLadyLava(this);
  }

  create() {
    // Preguntar por nombre y edad si es la primera vez
    this.userInfo = new UserInfo();

    // Si no hay datos de usuario, espera el evento antes de continuar
    if (!this.userInfo.data) {
      document.addEventListener(
        "user-info-ready",
        () => {
          // Reinicia la escena para continuar el juego
          this.scene.restart();
        },
        { once: true }
      );
      return; // No inicializar el juego aún
    }

    // Añade el fondo y guarda la referencia
    this.sfx = new SoundFX(this);

    // Usar BackgroundFactory
    // 1) Instancia la fábrica
    this.bg = new BackgroundFactory(
      this,
      this.scale.width,
      this.scale.height,
      8
    );

    // 2) Crea fondo (elige uno)
    // this.bg.createBackground('volcano',    { mode:'animated', fps:12 })
    this.bg.createBackground("volcano_sr", { mode: "animated", fps: 12 });
    // Parallax: this.bg.createBackground('volcano_sr', { mode:'parallax', layers:3 })

    // 3) Partículas ambientales (opcional)
    this.bg.createVolcanoAmbientParticles();
    // Opción 1: fondo animado por sprites

    // 3) Animación de LadyLava (crea si no existe)
    const walkKey = createLadyLavaAnimation(this);
    this.ladyLavaSprite = this.add
      .sprite(
        this.scale.width / 2,
        this.scale.height - this.lavaHeight - 40,
        "ladyLava_1"
      )
      .setDepth(0)
      .setVisible(false);
    this.ladyLavaSprite.play(walkKey);

    // Pausar/Reanudar al cambiar de foco (opcional)
    this.game.events.on(Phaser.Core.Events.BLUR, () => this.music?.pause());
    this.game.events.on(Phaser.Core.Events.FOCUS, () => this.music?.resume());

    // Si quieres mostrar el nombre y edad en consola:
    // console.log(`Usuario: ${this.userInfo.getName()}, Edad: ${this.userInfo.getAge()}`)

    const width = this.scale.width;
    const height = this.scale.height;

    // Reanudar física y resetear estado al reiniciar
    this.physics.resume?.();
    this._ended = false;
    this._playedLavaAnim = false;
    this.hasAscended = false;
    this.score = 0;
    this.lastGroundTime = 0;
    this.currentPlatform = null;
    this._onIceUntil = 0;
    this.lavaRiseBoost = 1;

    // Asegura la textura 1x1 para cualquier uso antes de crear emisores/misiles
    this.ensurePxTexture();

    // Grupo de plataformas y fábrica
    this.platforms = this.physics.add.staticGroup();
    this.platformFactory = new PlatformFactory(this);

    // Crear plataformas iniciales
    const startOffset = Number(gameConfig?.platforms?.startYOffset) || 50;
    const gapAboveBase = Number(gameConfig?.platforms?.minGapAboveBase) || 40;
    const baseY = height - (startOffset + 10);
    const baseX = width / 2;
    this.platformBaseX = baseX;
    const startY = baseY - gapAboveBase;
    for (let i = 0; i < 12; i++) {
      const x = this.pickSpawnX();
      const y = startY - i * 70;
      this.platformFactory.spawn(x, y, this.pickPlatformType());
    }
    // Plataforma base bajo el jugador (siempre normal y sin movimiento)
    this.platformFactory.spawn(baseX, baseY, "normal", {
      noMove: true,
      allowBaseX: true,
      isBase: true,
    });

    // Límite global: no permitir spawns debajo de esta línea (por ejemplo, respawns)
    this.platformSpawnMaxY = baseY - gapAboveBase;

    // Jugador y controlador (inicia justo por encima de la base)
    this.playerCtrl = new PlayerController(this);
    const playerStartY = baseY - 60;
    this.player = this.playerCtrl.create(baseX, playerStartY);
    // Baseline dinámico para el contador de metros (arranca en 0)
    this._metersBaselineY = this.player.y;
    // Reasignar estela para que siga al nuevo player tras restart
    if (this.platformFactory?.constructor?.ensureTrailSystem) {
      this.platformFactory.constructor.ensureTrailSystem(this);
      const trail = this.playerTrail;
      const emitter = trail?.emitter;
      if (emitter) {
        if (emitter.startFollow) emitter.startFollow(this.player);
        emitter.manager?.setDepth?.((this.player.depth ?? 0) - 1);
        if (emitter.setEmitZone) {
          // no-op, solo asegurar API
        }
        emitter.on = true;
        emitter.emitting = true;
        if (emitter.resume) emitter.resume();
        if (emitter.start) emitter.start();
      }
      if (trail) trail.following = true;
    }

    // Poderes temporales (instanciar después de crear al jugador)
    this.powerManager = new PowerManager(this);
    // Generar posibles poderes sobre las plataformas ya creadas
    this.platforms.children.iterate((plat) => {
      try {
        this.powerManager?.maybeSpawnAbovePlatform?.(plat);
        // ...existing code...
      } catch {}
    });

    // Contador de metros ascendidos (texto normal estilo pixel art)
    this.metersText = this.add.text(12, 12, "0 m", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#00e5ff",
      stroke: "#222",
      strokeThickness: 3,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#000",
        blur: 0,
        fill: true,
      },
    });
    this.metersText.setOrigin(0, 0);
    // Fijar a la cámara y por encima
    this.metersText.setScrollFactor(0, 0);
    this.metersText.setDepth(1000);

    // La colisión e input del jugador los maneja PlayerController

    // Cámara: reset al inicio y solo-subida (sin seguir hacia abajo)
    this.cameras.main.stopFollow();
    this.cameras.main.setScroll(0, 0);
    this._cameraMinY = 0;

    // Lava visual (la muerte se decide con borde inferior de cámara)
    const lavaY = height - this.lavaHeight;
    this.lava = this.add
      .tileSprite(0, lavaY, width, this.lavaHeight, "lava")
      .setOrigin(0, 0)
      .setDepth(2);

    // Partículas de lava: fuego y piedritas pixeladas (requiere 'px')
    this.createLavaParticles();

    // Grupo de misiles y overlap (siempre)
    this.lavaMissiles = this.physics.add.group();
    this.physics.add.overlap(
      this.player,
      this.lavaMissiles,
      // Solo mata si hay intersección real (AABB en X y Y) y el misil ya fue lanzado
      (_player, missile) => {
        if (
          this._ended ||
          !this.canLose ||
          !missile ||
          !missile.active ||
          missile._waiting
        )
          return;
        const pb = this.player.body;
        const mb = missile.body;
        if (!pb || !mb) return;
        const overlapX =
          Math.max(pb.left, mb.left) < Math.min(pb.right, mb.right);
        const overlapY =
          Math.max(pb.top, mb.top) < Math.min(pb.bottom, mb.bottom);

        if (gameConfig?.debug?.collisions) {
          this.debugLogMissileOverlap(pb, mb, overlapX, overlapY, missile);
          this.debugDrawMissileOverlap(pb, mb);
        }
        if (overlapX && overlapY) {
          // Si hay escudo, consumirlo y rebotar; si no, game over
          if (this.powerManager?.consumeShieldWithBounce?.("missile", missile))
            return;
          this.gameOver("missile");
        }
      },
      // processCallback: solo evaluar misiles activos y no en espera
      (_player, missile) => !!(missile && missile.active && !missile._waiting),
      this
    );

    // UI DOM
    this.scoreText = document.getElementById("score");
    this.timerEl = document.getElementById("timer");
    this.overlay = document.getElementById("overlay");
    this.finalText = document.getElementById("final");
    if (this.overlay) this.overlay.style.display = "none";
    const restartBtn = document.getElementById("restart");
    if (restartBtn) {
      restartBtn.onclick = () => {
        // Reinicio duro equivalente a F5
        window.location.reload();
      };
    }

    // Gracia inicial
    this.canLose = false;
    this.time.delayedCall(800, () => (this.canLose = true));

    // Iniciar spawner tras el primer frame (evita carreras tras F5/reintentar)
    this.events.once("postupdate", () => {
      if (this.isLavaMissileEnabled()) this.startLavaMissileSpawner();
    });

    // Limpiar al reiniciar/cerrar escena
    this.events.once("shutdown", () => {
      this._lavaMissileTimer?.remove(false);
      this._lavaMissileTimer = null;
      // Limpieza segura del grupo de misiles
      this.clearLavaMissiles();
      this.lavaFlames?.destroy();
      this.lavaRocks?.destroy();
      // Limpieza del controlador de jugador
      this.playerCtrl?.destroy?.();
      this.playerCtrl = null;
      this.powerManager?.deactivate?.();
      this.powerManager = null;
      // Quitar superficie de lava si existiera
      try {
        if (this.lavaSurfaceCollider) {
          this.physics.world.removeCollider(this.lavaSurfaceCollider);
          this.lavaSurfaceCollider = null;
        }
      } catch {}
      try {
        this.lavaSurface?.destroy?.();
        this.lavaSurface = null;
      } catch {}
    });

    // Inicializa estado de cruce de plataformas
    this.platforms.children.iterate((plat) => {
      if (!plat) return;
      plat.lastState = this.player.y < plat.y - 8 ? "above" : "below";
    });

    // Cronómetro
    this.startTime = this.time.now;

    // NUEVO: Instancia de LadyLavaText
    this.ladyLavaText = new LadyLavaText(this);
  }

  update() {
    if (!this.platforms || !this.player) return;

    // Mostrar LadyLava y activar misiles al pasar 100 metros
    if (this.metersText && this.player) {
      const baseY = this._metersBaselineY ?? this.scale.height - 120;
      const metros = Math.max(0, Math.round((baseY - this.player.y) / 10));
      this.metersText.setText(`${metros} m`);

      if (metros > 100 && !this.ladyLavaSprite.visible) {
        this.ladyLavaSprite.setVisible(true);

        // Pausa el juego
        this.physics.pause();

        // Muestra el overlay y reanuda al cerrar
        this.ladyLavaText.showIntro(() => {
          this.physics.resume();
          // Activa los misiles de lava en la config global
          import("../config/gameConfig.js").then((mod) => {
            mod.default.lavaMissiles.enabled = true;
            mod.default.platforms.weights.fragile = 10;
            mod.default.platforms.weights.normal = 0;
            if (!this._lavaMissileTimer) this.startLavaMissileSpawner();
          });
        }); 
      }
    }

    if (this.ladyLavaSprite && this.lava && this.ladyLavaSprite.visible) {
      this.ladyLavaSprite.y = this.lava.y - 40;
    }

    // Animar lava cayendo y humo del volcán
    if (this.volcanoSprite && this.textures.exists("volcano_bg")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const w = 128,
        h = 128;
      // Fondo
      g.fillStyle(0x181825, 1);
      g.fillRect(0, 0, w, h);
      // Volcán base pixel-art
      g.fillStyle(0x3b2f1e, 1);
      g.fillRect(32, 96, 64, 32);
      g.fillStyle(0x6b4226, 1);
      g.fillRect(40, 64, 48, 32);
      // Cráter
      g.fillStyle(0x222222, 1);
      g.fillRect(56, 60, 16, 8);
      // Lava en el cráter
      g.fillStyle(0xf59e0b, 1);
      g.fillRect(60, 62, 8, 4);
      // Lava cayendo (animada)
      this._volcanoLavaY += Phaser.Math.Between(1, 3);
      if (this._volcanoLavaY > 84) this._volcanoLavaY = 68;
      g.fillStyle(0xf59e0b, 1);
      g.fillRect(64, this._volcanoLavaY, 4, 16);
      // Humo (animado)
      this._volcanoHumoAlpha += Phaser.Math.FloatBetween(-0.01, 0.01);
      this._volcanoHumoAlpha = Phaser.Math.Clamp(
        this._volcanoHumoAlpha,
        0.35,
        0.6
      );
      g.fillStyle(0xcccccc, this._volcanoHumoAlpha);
      g.fillRect(60, 52, 8, 8);
      g.generateTexture("volcano_bg", w, h);
      this.volcanoSprite.setTexture("volcano_bg");
    }
    const width = this.scale.width;
    const height = this.scale.height;

    // Delega la lógica de movimiento/salto/wrap al controlador
    this.playerCtrl?.update?.();
    this.powerManager?.update?.();

    // Generación y limpieza de plataformas
    const camY = this.cameras.main.worldView.y;
    this.platforms.children.iterate((plat) => {
      if (!plat) return;
      if (plat.isGhost) return; // ignorar fantasmas para limpieza normal (se destruyen junto al original)
      // Cancela temporizador al dejar temporizada
      if (plat.isTimed && plat._timing && this.currentPlatform !== plat) {
        if (plat._timer) {
          plat._timer.remove(false);
          plat._timer = null;
        }
        plat._timing = false;
      }
      if (plat.y > camY + height + 60) {
        this.tweens.killTweensOf(plat);
        plat.destroy();
      }
    });
    // Contar solo plataformas reales (no fantasmas) para mantener densidad
    const realCount = this.platforms
      .getChildren()
      .filter((p) => p && !p.isGhost).length;
    while (realCount + 0 < 14) {
      const topY = this.getTopPlatformY();
      const newY = topY - Phaser.Math.Between(60, 100);
      const newX = this.pickSpawnX();
      this.platformFactory.spawn(newX, newY, this.pickPlatformType());
      break; // añade de una en una por frame para evitar picos
    }

    // La reubicación de escurridizas durante el ascenso la gestiona el controlador

    // Scoring por cruce de plataformas
    this.platforms.children.iterate((plat) => {
      if (!plat) return;
      if (plat.isGhost) return; // ignorar fantasmas en puntuación
      if (plat.lastState === undefined)
        plat.lastState = this.player.y < plat.y - 8 ? "above" : "below";
      const aboveNow = this.player.y < plat.y - 8;
      const belowNow = this.player.y > plat.y + 8;
      if (aboveNow && plat.lastState === "below") {
        this.score += 1;
        plat.lastState = "above";
        if (this.score > this.best) this.best = this.score;
      } else if (belowNow && plat.lastState === "above") {
        this.score = Math.max(0, this.score - 1);
        plat.lastState = "below";
      }
    });

    // HUD
    if (this.scoreText) {
      const nombre = this.userInfo?.getName?.() || "";
      this.scoreText.textContent = `Score: ${this.score} (Max: ${this.best})`;
    }
    if (this.timerEl) {
      const secs = Math.floor((this.time.now - this.startTime) / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, "0");
      const ss = String(secs % 60).padStart(2, "0");
      this.timerEl.textContent = `${mm}:${ss}`;
    }

    // Lava (visual) sube con la cámara, no baja
    if (this.lava) {
      const frozen = this.time.now <= (this.lavaFrozenUntil || 0);
      const targetY =
        this.cameras.main.scrollY + height - this.lavaHeight - this.lavaOffset;
      const currentY = this.lava.y;
      if (!frozen && targetY < currentY) {
        const boost =
          this.lavaRiseBoost && this.lavaRiseBoost > 0 ? this.lavaRiseBoost : 1;
        const maxStep =
          (this.lavaRiseSpeed * boost * this.game.loop.delta) / 1000;
        this.lava.y = Math.max(targetY, currentY - maxStep);
      }
      if (!frozen) this.lava.tilePositionY -= 0.4;

      // Reposicionar emisores en el borde superior de la lava
      if (this.lavaFlames) this.lavaFlames.setPosition(0, this.lava.y - 2);
      if (this.lavaRocks) this.lavaRocks.setPosition(0, this.lava.y - 2);

      // Mientras esté congelada, crear/actualizar una "superficie" física para caminar
      if (frozen) {
        // Crear si no existe
        if (!this.lavaSurface) {
          // Usamos un sprite estático de 1x1 escalado a ancho completo, invisible
          this.lavaSurface = this.physics.add
            .staticImage(0, this.lava.y - 2, "px")
            .setOrigin(0, 0)
            .setAlpha(0)
            .setDepth(2);
          // Ajustar ancho/alto del cuerpo
          const w = this.scale.width;
          const hSurf = 4;
          this.lavaSurface.setDisplaySize(w, hSurf);
          if (this.lavaSurface.body?.setSize)
            this.lavaSurface.body.setSize(w, hSurf);
          if (this.lavaSurface.body?.updateFromGameObject)
            this.lavaSurface.body.updateFromGameObject();
          // Collider con jugador: solo actualiza "ground" para coyote y salto
          this.lavaSurfaceCollider = this.physics.add.collider(
            this.player,
            this.lavaSurface,
            () => {
              if (this.playerCtrl) {
                this.playerCtrl.lastGroundTime = this.time.now;
                this.playerCtrl.currentPlatform = null;
              }
            }
          );
        } else {
          // Actualizar posición para seguir el borde superior de la lava
          this.lavaSurface.y = this.lava.y - 2;
          if (this.lavaSurface.body?.updateFromGameObject)
            this.lavaSurface.body.updateFromGameObject();
        }
      } else if (this.lavaSurface) {
        // Destruir superficie y su collider al descongelar
        try {
          if (this.lavaSurfaceCollider)
            this.physics.world.removeCollider(this.lavaSurfaceCollider);
        } catch {}
        this.lavaSurfaceCollider = null;
        try {
          this.lavaSurface.destroy();
        } catch {}
        this.lavaSurface = null;
      }
    }

    // Muerte por lava: usar la lava visible (con margen) para evitar muertes tempranas
    // Si la lava está congelada, no matar (puede caminar sobre la superficie)
    if (
      !this._ended &&
      this.canLose &&
      this.player &&
      this.player.body &&
      !(this.time.now <= (this.lavaFrozenUntil || 0))
    ) {
      const computedTop =
        this.cameras.main.scrollY + height - this.lavaHeight - this.lavaOffset;
      const visibleTop = this.lava ? this.lava.y : computedTop;
      const killTop = Math.max(visibleTop, computedTop) + this.lavaKillMargin;
      const playerBottom = this.player.body.bottom;

      if (playerBottom >= killTop) {
        if (gameConfig?.debug?.collisions) {
          this.debugLogLavaKill(playerBottom, visibleTop, computedTop, killTop);
          this.debugDrawKillLine(killTop);
        }
        // Gracia: evita bucle inmediato tras rebotar
        if (
          this._lavaShieldGraceUntil &&
          this.time.now <= this._lavaShieldGraceUntil
        )
          return;
        // Si hay escudo, consumir y rebotar sobre lava, si no, muerte
        if (this.powerManager?.consumeShieldWithBounce?.("lava")) return;
        this.gameOver("lava");
      }
    }

    // Cámara solo-subida
    const desired = this.player.y - height * 0.5;
    this._cameraMinY = Math.min(this._cameraMinY, desired);
    this.cameras.main.scrollY = Math.min(
      this.cameras.main.scrollY,
      this._cameraMinY
    );
    if (!this.hasAscended && this.cameras.main.scrollY < -20)
      this.hasAscended = true;

    // Game over por borde inferior de cámara
    const cameraBottom = this.cameras.main.scrollY + height;
    const playerBottomEdge = this.player.body
      ? this.player.body.bottom
      : this.player.y;
    if (this.canLose && playerBottomEdge >= cameraBottom - 6) {
      // Evita muerte inmediata mientras dura la gracia del rebote por escudo
      if (
        this._lavaShieldGraceUntil &&
        this.time.now <= this._lavaShieldGraceUntil
      ) {
        // No muere, permite que el rebote recupere altura
      } else {
        this.gameOver("fall");
      }
    }

    // Mantén el fondo siguiendo la cámara
    if (this.bgImage) {
      this.bgImage.y = this.cameras.main.scrollY;
    }

    if (this.ladyLavaSprite && this.lava) {
      this.ladyLavaSprite.y = this.lava.y - 20;
    }
  }

  // relocateDodger ahora vive en PlayerController

  getTopPlatformY() {
    let minY = Infinity;
    this.platforms.children.iterate((plat) => {
      if (plat && plat.y < minY) minY = plat.y;
    });
    if (!isFinite(minY))
      return this.cameras.main.worldView.y + this.scale.height - 50;
    return minY;
  }

  // Spawnea un pixel de lava que parpadea y luego se dispara al jugador
  spawnLavaParticle() {
    if (!this.isLavaMissileEnabled()) return null;
    if (!this.lava || !this.lavaMissiles) return null;
    const width = this.scale.width;
    const x = Phaser.Math.Between(6, width - 6);
    const y = this.lava.y - 2;
    const speed = this.getLavaMissileSpeed?.() ?? 420;
    const size = this.getLavaMissileSize?.() ?? 3;
    const missile = new LavaParticle(this, x, y, { delay: 2000, speed, size });
    this.lavaMissiles.add(missile);
    return missile;
  }

  // Inicia o reinicia el temporizador de misiles con el delay configurado
  startLavaMissileSpawner() {
    // No crear ni mantener timers si está deshabilitado o sin delay válido
    if (!this.isLavaMissileEnabled()) {
      this._lavaMissileTimer?.remove(false);
      this._lavaMissileTimer = null;
      return;
    }
    const initialDelay = this.getNextLavaMissileDelay?.();
    if (!(initialDelay > 0 && isFinite(initialDelay))) {
      this._lavaMissileTimer?.remove(false);
      this._lavaMissileTimer = null;
      return;
    }

    this._lavaMissileTimer?.remove(false);
    this._lavaMissileTimer = this.time.addEvent({
      delay: initialDelay,
      loop: true,
      callback: () => {
        if (this.time.now <= (this.lavaFrozenUntil || 0)) return;
        if (this._ended || !this.canLose || !this.isLavaMissileEnabled())
          return;
        const n = this.getLavaMissileCount?.() ?? 1;
        for (let i = 0; i < n; i++) this.spawnLavaParticle();

        // Si el delay es fijo, no reasignamos; si es rango, re-evaluamos
        if (this._lavaMissileTimer && !this.isFixedLavaMissileDelay?.()) {
          const next = this.getNextLavaMissileDelay?.() ?? 3000;
          if (next > 0) this._lavaMissileTimer.delay = next;
        }
      },
    });
  }

  // Helper: flag centralizado para habilitar/deshabilitar misiles por config
  isLavaMissileEnabled() {
    return !!gameConfig?.lavaMissiles?.enabled;
  }

  // Lee el rango o valor fijo para el spawn de misiles (ms)
  getNextLavaMissileDelay() {
    const lm = gameConfig?.lavaMissiles || {};

    // 0) Tasa por minuto (si > 0, tiene prioridad)
    const rpm = Number(lm.ratePerMinute);
    if (isFinite(rpm) && rpm > 0) {
      return Math.max(50, Math.round(60000 / rpm));
    }

    // 1) Fijo en segundos
    if (
      typeof lm.intervalSeconds === "number" &&
      isFinite(lm.intervalSeconds)
    ) {
      const s = lm.intervalSeconds;
      if (s <= 0) return 3000; // evita 0 ms
      return Math.max(50, s * 1000);
    }
    // 2) Fijo en ms
    if (typeof lm.intervalMs === "number" && isFinite(lm.intervalMs)) {
      const ms = lm.intervalMs;
      if (ms <= 0) return 3000; // evita 0 ms
      return Math.max(50, ms);
    }
    // 3) Rango {min,max} en ms
    const cfg = lm.intervalMs;
    if (cfg && (typeof cfg.min === "number" || typeof cfg.max === "number")) {
      const min = Math.max(50, cfg.min ?? 3000);
      const max = Math.max(min, cfg.max ?? min);
      return Phaser.Math.Between(min, max);
    }
    // 4) Default
    return 3000;
  }

  // Indica si el delay es fijo (no aleatorio) y válido (> 0)
  isFixedLavaMissileDelay() {
    const lm = gameConfig?.lavaMissiles || {};
    if (Number(lm.ratePerMinute) > 0) return true;
    if (typeof lm.intervalSeconds === "number") return lm.intervalSeconds > 0;
    if (typeof lm.intervalMs === "number") return lm.intervalMs > 0;
    return false;
  }

  // NUEVO: lee la velocidad desde config (número fijo o rango)
  getLavaMissileSpeed() {
    const cfg = gameConfig?.lavaMissiles?.speed;
    if (typeof cfg === "number") return Math.max(10, cfg);
    if (cfg && (typeof cfg.min === "number" || typeof cfg.max === "number")) {
      const min = Math.max(10, cfg.min ?? 420);
      const max = Math.max(min, cfg.max ?? min);
      return Phaser.Math.Between(min, max);
    }
    return 420;
  }

  // Respeta número o rango {min,max} desde gameConfig, sin capado 4–10
  getLavaMissileSize() {
    const cfg = gameConfig?.lavaMissiles?.size;
    const HARD_MAX = 512;
    if (typeof cfg === "number") {
      return Math.min(HARD_MAX, Math.max(1, Math.round(cfg)));
    }
    if (cfg && (typeof cfg.min === "number" || typeof cfg.max === "number")) {
      const min = Math.max(1, Math.round(cfg.min ?? 1));
      const max = Math.max(min, Math.round(cfg.max ?? min));
      return Phaser.Math.Between(min, Math.min(max, HARD_MAX));
    }
    return 4;
  }

  // NUEVO: lee la cantidad por tick desde config (número fijo o rango)
  getLavaMissileCount() {
    const cfg = gameConfig?.lavaMissiles?.count;
    if (typeof cfg === "number") return Math.max(0, cfg | 0);
    if (cfg && (typeof cfg.min === "number" || typeof cfg.max === "number")) {
      const min = Math.max(0, (cfg.min ?? 1) | 0);
      const max = Math.max(min, (cfg.max ?? min) | 0);
      return Phaser.Math.Between(min, max);
    }
    return 1;
  }

  // Garantiza que exista la textura 'px' antes de usarla en emisores/sprites
  ensurePxTexture() {
    if (!this.textures.exists("px")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture("px", 1, 1);
      g.destroy();
    }
  }

  gameOver(cause) {
    this.sfx.gameOver(); // Reproduce el sonido de game over
    // Evita repeticiones de animación y lógica de muerte
    if (this._ended || this._playedLavaAnim) return;
    this._ended = true;

    // Parar spawner y limpiar misiles restantes
    this._lavaMissileTimer?.remove(false);
    this._lavaMissileTimer = null;
    // Limpieza segura del grupo de misiles (evita acceder a children indefinido)
    this.clearLavaMissiles();

    // Desactivar el controlador del jugador para evitar movimiento tras la muerte
    if (this.playerCtrl && typeof this.playerCtrl.disable === "function") {
      this.playerCtrl.disable();
    } else if (this.playerCtrl) {
      // Si no existe método disable, desactiva el input y la física manualmente
      try {
        this.playerCtrl.active = false;
      } catch {}
      try {
        if (this.player && this.player.body) this.player.body.enable = false;
      } catch {}
    }

    this.best = Math.max(this.best, this.score);
    localStorage.setItem("best_score", String(this.best));

    const showOverlay = () => {
      if (this.finalText)
        this.finalText.textContent = `Puntos: ${this.score} — Récord: ${this.best}`;
      if (this.overlay) this.overlay.style.display = "flex";
    };

    // Ejecuta la animación de muerte antes de mostrar overlay
    if ((cause === "lava" || cause === "missile") && !this._playedLavaAnim) {
      this._playedLavaAnim = true;
      // Lava: usar la cinemática Terminator; Misil: usar mismo flujo visual simple (sin thumb)
      if (cause === "lava") {
        playLavaDeath(this, this.player, this.lava, {
          sinkDuration: 1200,
          thumbDuration: 900,
          cameraZoom: 2.1,
          useMask: true,
          bubbleFX: false,
        }).then(showOverlay);
      } else {
        showOverlay();
      }
    } else {
      showOverlay();
    }
  }

  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    const w = 64,
      h = 32;
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
    const hw = 28,
      hh = 40;
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
  }

  createLavaParticles() {
    const width = this.scale.width;

    // Emisor de fuego (chispas naranjas/amarillas que suben)
    this.lavaFlames = this.add
      .particles(0, 0, "px", {
        x: { min: 0, max: width },
        y: 0,
        quantity: 6,
        frequency: 60,
        lifespan: { min: 400, max: 900 },
        speedY: { min: -120, max: -220 },
        speedX: { min: -30, max: 30 },
        scale: { start: 3, end: 1, ease: "Linear" },
        tint: [0xf59e0b, 0xfbbf24, 0xf97316, 0xef4444],
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD, // brillo tipo fuego sin perder el pixel
      })
      .setDepth(2);

    // Emisor de piedritas (píxeles oscuros que saltan y caen)
    this.lavaRocks = this.add
      .particles(0, 0, "px", {
        x: { min: 0, max: width },
        y: 0,
        quantity: 3,
        frequency: 90,
        lifespan: { min: 700, max: 1400 },
        speedY: { min: -180, max: -260 },
        speedX: { min: -80, max: 80 },
        gravityY: 600,
        scale: { start: 2, end: 2 },
        tint: [0x1f2937, 0x4b5563, 0x111827],
        alpha: { start: 1, end: 0.9 },
        rotate: 0,
        emitting: true,
      })
      .setDepth(2);
  }

  // Selección ponderada del tipo de plataforma según config
  pickPlatformType() {
    const weights =
      (gameConfig.platforms && gameConfig.platforms.weights) || {};
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    if (!entries.length) return "normal";
    const total = entries.reduce((acc, [, w]) => acc + w, 0);
    let r = Phaser.Math.Between(1, total);
    for (const [type, w] of entries) {
      r -= w;
      if (r <= 0) return type;
    }
    return "normal";
  }

  // NUEVO: logs detallados del solapamiento misil ↔ jugador
  debugLogMissileOverlap(pb, mb, overlapX, overlapY, missile) {
    try {
      console.warn("[DEBUG] Misil↔Jugador overlap", {
        time: Math.floor(this.time.now),
        missileId: missile?.id ?? null,
        player: {
          x: this.player.x,
          y: this.player.y,
          left: pb.left,
          right: pb.right,
          top: pb.top,
          bottom: pb.bottom,
          w: pb.width,
          h: pb.height,
        },
        missile: {
          x: missile.x,
          y: missile.y,
          left: mb.left,
          right: mb.right,
          top: mb.top,
          bottom: mb.bottom,
          w: mb.width,
          h: mb.height,
          waiting: missile._waiting,
        },
        overlapX,
        overlapY,
      });
    } catch {}
  }
  debugDrawMissileOverlap(pb, mb) {
    try {
      if (!this._debugG) {
        this._debugG = this.add.graphics().setDepth(10000);
      }
      const g = this._debugG;
      g.clear();
      // jugador
      g.lineStyle(2, 0x3b82f6, 1);
      g.strokeRect(pb.left, pb.top, pb.width, pb.height);
      // misil
      g.lineStyle(2, 0xef4444, 1);
      g.strokeRect(mb.left, mb.top, mb.width, mb.height);
      this.time.delayedCall(1000, () => g.clear());
    } catch {}
  }

  // NUEVO: logs de muerte por lava con posiciones relevantes
  debugLogLavaKill(playerBottom, visibleTop, computedTop, killTop) {
    try {
      console.warn("[DEBUG] Lava kill check", {
        time: Math.floor(this.time.now),
        playerBottom,
        visibleTop,
        computedTop,
        killTop,
        margin: this.lavaKillMargin,
      });
    } catch {}
  }

  // NUEVO: dibuja la línea de muerte (killTop) en amarillo
  debugDrawKillLine(y) {
    try {
      if (!this._debugG) {
        this._debugG = this.add.graphics().setDepth(10000);
      }
      const g = this._debugG;
      g.lineStyle(2, 0xfacc15, 1);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.scale.width, y);
      g.strokePath();
      this.time.delayedCall(1000, () => g.clear());
    } catch {}
  }

  // Limpia de forma segura el grupo de misiles evitando acceder a children inexistente
  clearLavaMissiles() {
    const group = this.lavaMissiles;
    if (!group) return;
    const items =
      typeof group.getChildren === "function"
        ? group.getChildren()
        : group.children?.entries || [];
    if (Array.isArray(items)) {
      for (const m of items) {
        if (m && m.destroy) m.destroy();
      }
    } else if (group.children?.iterate) {
      group.children.iterate((m) => m && m.destroy());
    }
    this.lavaMissiles = null;
  }
}
