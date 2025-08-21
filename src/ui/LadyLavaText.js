export class LadyLavaText {
  constructor(scene) {
    this.scene = scene;
    this.textObj = null;
  }

 
  showIntro() {
    let overlay = document.getElementById("lady-lava-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "lady-lava-overlay";
    overlay.innerHTML = `
    <div class="pixel-panel">
      <h2 class="pixel-title">¡Lady Lava!</h2>
      <p style="color:#f87171; font-size:14px; margin:10px 0;">
        Guardiana ardiente de las cavernas volcánicas.<br>
        Su furia despierta cuando te atreves a escalar más de 50 metros.
      </p>
  
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
    };
  }
}
