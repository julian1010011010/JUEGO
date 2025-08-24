// src/ui/Timer.js
export class Timer {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} [defaults]
   * defaults = {
   *   start: 3,                 // número inicial del conteo
   *   title: 'READY?',          // título del panel
   *   subtitle: '',             // subtítulo opcional
   *   message: '',              // párrafo opcional
   *   btnLabel: 'Start',        // etiqueta del botón al finalizar
   *   lockUntilEnd: true,       // deshabilita botón hasta fin del conteo
   *   autoClose: false,         // cerrar overlay automáticamente al terminar
   *   onTick: (n)=>{},          // callback cada tick (n: 3..1, luego 0)
   *   onDone: ()=>{},           // callback al mostrar GO!
   * }
   */
  constructor(scene, defaults = {}) {
    this.scene = scene;
    this.defaults = Object.assign({
      start: 1,
      title: 'READY?',
      subtitle: '',
      message: '',
      btnLabel: 'Start',
      lockUntilEnd: true,
      autoClose: false,
      onTick: null,
      onDone: null
    }, defaults);

    this._timer = null;
    this._overlayId = 'px-count-overlay';
    this._ensureCss();
  }

  /**
   * Muestra el overlay y arranca el countdown
   * @param {object} [opts] — puede sobrescribir los defaults
   * @param {function} [onClose] — callback al cerrar
   */
  show(opts = {}, onClose) {
    const cfg = Object.assign({}, this.defaults, opts);
    this.close(); // limpia si hubiera uno previo

    // Overlay root
    const overlay = document.createElement('div');
    overlay.id = this._overlayId;
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(80% 80% at 50% 50%, rgba(0,0,0,.78), rgba(0,0,0,.92))',
      zIndex: '100000'
    });

    // Panel HTML
    const subtitleHtml = cfg.subtitle ? `<h6 class="pixel-sub">${cfg.subtitle}</h6>` : '';
    const msgHtml = cfg.message
      ? `<p class="pixel-msg">${cfg.message}</p>`
      : '';
    overlay.innerHTML = `
      <div class="pixel-panel">
        <h2 class="pixel-title">${cfg.title}</h2>
        ${subtitleHtml}
        ${msgHtml}
        <div id="px-count" class="pixel-countdown">3</div>
        <button id="px-count-btn" class="btn-8 btn-affirm" ${cfg.lockUntilEnd ? 'disabled' : ''} style="${cfg.lockUntilEnd ? 'opacity:.6;cursor:not-allowed;' : ''};margin-top:14px;">
          ${cfg.lockUntilEnd ? '...' : cfg.btnLabel}
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Refs
    const counterEl = document.getElementById('px-count');
    const btnEl = document.getElementById('px-count-btn');

    // Lógica de conteo
    let n = Math.max(1, parseInt(cfg.start, 10) || 3);
    counterEl.textContent = n;
    counterEl.classList.add('pop');

    // Notifica primer tick
    if (typeof cfg.onTick === 'function') cfg.onTick(n);

    this._timer = setInterval(() => {
      n -= 1;

      if (n >= 1) {
        counterEl.textContent = n;
        counterEl.classList.remove('pop'); void counterEl.offsetWidth; counterEl.classList.add('pop');
        if (typeof cfg.onTick === 'function') cfg.onTick(n);
      } else {
        // Fin del conteo: GO!
        clearInterval(this._timer);
        this._timer = null;
        counterEl.textContent = 'GO!';
        counterEl.classList.remove('pop'); void counterEl.offsetWidth; counterEl.classList.add('pop');

        // Habilita botón
        btnEl.disabled = false;
        btnEl.textContent = cfg.btnLabel;
        btnEl.style.opacity = '1';
        btnEl.style.cursor = 'pointer';

        // Callback fin
        if (typeof cfg.onDone === 'function') cfg.onDone();

        // Autocierre si está activo
        if (cfg.autoClose) {
          setTimeout(() => this.close(onClose), 450);
        }
      }
    }, 1000);

    // Cerrar manualmente
    btnEl.onclick = () => {
      if (cfg.lockUntilEnd && this._timer) {
        // Bloqueado hasta terminar: ignorar clicks
        return;
      }
      this.close(onClose);
    };
  }

  /** Cerrar/limpiar overlay */
  close(onClose) {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    const el = document.getElementById(this._overlayId);
    if (el) el.remove();
    if (typeof onClose === 'function') onClose();
  }

  // ---------- CSS (inyecta una vez) ----------
  _ensureCss() {
    if (document.getElementById('px-count-css')) return;
    const style = document.createElement('style');
    style.id = 'px-count-css';
    style.textContent = `
      .pixel-panel{
        background: linear-gradient(180deg, rgba(20,18,32,.95), rgba(10,9,20,.95));
        border: 2px solid #ff7a1f;
        box-shadow: 0 0 0 2px #2a0f06 inset, 0 0 16px rgba(255,122,31,.35);
        border-radius: 8px;
        padding: 18px 20px;
        text-align: center;
        color: #e2e8f0;
        image-rendering: pixelated;
        min-width: 280px;
        max-width: 480px;
      }
      .pixel-title{
        margin: 0 0 6px 0;
        letter-spacing: 1px;
        text-shadow: 0 2px 0 #000, 0 0 8px rgba(255,122,31,.35);
      }
      .pixel-sub{
        margin: 2px 0 8px 0;
        opacity: .9;
      }
      .pixel-msg{
        color:#f8d3b0;
        font-size:14px;
        margin:8px 0 14px;
      }
      .btn-8.btn-affirm{
        padding: 10px 18px;
        font-weight: 800;
        border: 0;
        border-radius: 6px;
        background: repeating-linear-gradient(135deg,#ff7a1f,#ff7a1f 6px,#ff9a3a 6px,#ff9a3a 12px);
        color: #0a0a14;
        text-transform: uppercase;
        box-shadow: 0 0 0 2px #2a0f06 inset, 0 2px 0 #000, 0 0 12px rgba(255,122,31,.35);
        image-rendering: pixelated;
      }
      .btn-8.btn-affirm:enabled:hover{
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      .pixel-countdown{
        margin: 4px auto 0;
        width: 120px;
        height: 80px;
        display: grid;
        place-items: center;
        font-size: 48px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #ffe8c7;
        background: linear-gradient(180deg, rgba(40,18,10,.9), rgba(20,10,5,.9));
        border: 2px solid #ff7a1f;
        box-shadow: 0 0 0 2px #2a0f06 inset, 0 0 12px rgba(255,122,31,.35);
        border-radius: 6px;
        image-rendering: pixelated;
        text-shadow: 0 2px 0 #000, 0 0 8px rgba(255,205,120,.35), 0 0 18px rgba(255,122,31,.25);
        user-select: none;
      }
      @keyframes pixel-pop{
        0%{transform:scale(1);filter:brightness(1)}
        40%{transform:scale(1.18);filter:brightness(1.25)}
        100%{transform:scale(1);filter:brightness(1)}
      }
      .pixel-countdown.pop{ animation: pixel-pop 260ms cubic-bezier(.2,.75,.2,1); }
    `;
    document.head.appendChild(style);
  }
}
