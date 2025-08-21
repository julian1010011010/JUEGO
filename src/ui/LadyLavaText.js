export class LadyLavaText {
  constructor(scene) {
    this.scene = scene;
    this.textObj = null;
  }

  showIntro(onClose) {
    let overlay = document.getElementById("lady-lava-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "lady-lava-overlay";
    overlay.innerHTML = `
    <div class="pixel-panel">
      <h2 class="pixel-title">OCHI CHORNYE</h2>
      <h6>¡Очи чёрные, очи жгучие! </h6>
      <p style="color:#f87171; font-size:14px; margin:10px 0;">
      Cuando la oscuridad se ilumina con rojo fuego,<br>
    sabrás que ella ha despertado.
      </p>
      <br>
      <button id="btn-close-lady" class="btn-8 btn-affirm">¡Enfrentarla!</button>
    </div>
  `;

    // estilos overlay
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(0,0,0,0.8)";
    overlay.style.zIndex = "100000";

    document.body.appendChild(overlay);

    // cerrar
    document.getElementById("btn-close-lady").onclick = () => {
      overlay.remove();
      if (typeof onClose === "function") onClose();
    };
  }
} 