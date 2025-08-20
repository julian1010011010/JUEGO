export default class UserInfo {
  constructor() {
    this.key = 'user_info'
    this.ensureIntroStyles() // << añade el CSS del panel/overlay de intro
    this.data = this.load()
    if (!this.data) {
      this.data = null
      this.showIntroForm()
    }
  }

  ensureIntroStyles() {
    if (document.getElementById('intro-form-styles')) return
    const style = document.createElement('style')
    style.id = 'intro-form-styles'
    style.textContent = `
      /* Overlay propio para el intro (no interfiere con el del juego) */
      #intro-form.pixel-overlay{
        position: fixed; inset: 0;
        display: flex; align-items: center; justify-content: center;
        z-index: 99999;
        /* FONDO diferenciador: más claro y con viñeta suave */
        background:
          radial-gradient(60% 60% at 50% 40%, rgba(32,35,66,0.85) 0%, rgba(10,12,32,0.95) 70%),
          linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.9));
        backdrop-filter: blur(2px);
      }

      /* Panel base (reusa tu estilo pixel) + patrón claro y doble marco */
      #intro-form .pixel-panel{
        position: relative;
        max-width: 380px;
        width: min(92vw, 380px);
        /* Patrón diagonal más claro para contrastar con lava/canvas */
        background:
          repeating-linear-gradient(45deg, #2a2d4f 0 8px, #262948 8px 16px);
        color:#fff;
        border: var(--pixel, 3px) solid #000;
        padding: calc(var(--pixel, 3px)*6) calc(var(--pixel, 3px)*8);
        box-shadow:
          0 0 0 var(--pixel, 3px) #000,
          calc(var(--pixel, 3px)*2) calc(var(--pixel, 3px)*2) 0 0 rgba(0,0,0,.85),
          0 0 40px rgba(0,0,0,.9);
      }
      /* Marco extra tipo cartucho */
      #intro-form .pixel-panel::before{
        content:"";
        position:absolute;
        inset: calc(var(--pixel, 3px)*-4);
        border: var(--pixel, 3px) solid #000;
        background: rgba(255,255,255,0.04);
        pointer-events:none;
      }

      /* Titular 8-bit, consistente con el HUD */
      #intro-form .pixel-panel h3{
        margin:0 0 12px 0; font-size:18px; letter-spacing:1px; text-transform:uppercase;
        color: var(--accent-2, #ffe66d);
        text-shadow: 0 var(--pixel, 3px) 0 #000, var(--pixel, 3px) 0 0 #000, calc(var(--pixel, 3px)*-1) 0 0 #000;
      }

      /* Campos y botones reaprovechando tus utilidades */
      #intro-form .pixel-field{ display:flex; flex-direction:column; gap:6px; margin: 10px 0 14px 0; text-align:left; }
      #intro-form .pixel-label{ font-size:12px; color:#cbd5e1; text-shadow:0 var(--pixel, 3px) 0 #000; }
      #intro-form .pixel-input{
        width:100%;
        padding: calc(var(--pixel, 3px)*3) calc(var(--pixel, 3px)*3);
        background:#0f122b; color:#e2e8f0; font-weight:800;
        border: var(--pixel, 3px) solid #000;
        box-shadow: inset 0 calc(var(--pixel, 3px)*-1) 0 0 rgba(255,255,255,.15);
        outline:none; image-rendering:pixelated;
      }
      #intro-form .pixel-input:focus{
        box-shadow:
          0 0 0 var(--pixel, 3px) #000,
          0 0 0 calc(var(--pixel, 3px)*2) var(--accent, #6ee7b7);
      }
      #intro-form .pixel-actions{ display:flex; gap:10px; justify-content:center; margin-top: 6px; }
      #intro-form .btn-8{
        cursor:pointer; padding: calc(var(--pixel, 3px)*3) calc(var(--pixel, 3px)*5);
        font-size:14px; font-weight:900; letter-spacing:1px; text-transform:uppercase;
        border: var(--pixel, 3px) solid #000; image-rendering:pixelated;
        box-shadow:
          0 var(--pixel, 3px) 0 0 #000,
          0 calc(var(--pixel, 3px)*2) 0 0 rgba(0,0,0,.35),
          inset 0 calc(var(--pixel, 3px)*-1) 0 0 rgba(255,255,255,.25);
      }
      #intro-form .btn-affirm{ background: linear-gradient(#9ff5d7, var(--accent, #6ee7b7)); color: var(--ink, #0a0a14); }
      #intro-form .btn-8:hover{ filter:saturate(1.15) brightness(1.05); transform: translateY(calc(var(--pixel, 3px)*-1)); }
      #intro-form .btn-8:active{ transform: translateY(0); box-shadow: 0 var(--pixel, 3px) 0 0 #000, inset 0 calc(var(--pixel, 3px)*1) 0 0 rgba(0,0,0,.2); }

      #intro-form .pixel-error{
        margin-top:6px; font-size:12px; color: var(--danger, #ff4d6d);
        text-shadow: 0 var(--pixel, 3px) 0 #000; display:none;
      }
    `
    document.head.appendChild(style)
  }

  showIntroForm() {
    // Crea el contenedor si no existe
    let introDiv = document.getElementById('intro-form')
    if (!introDiv) {
      introDiv = document.createElement('div')
      introDiv.id = 'intro-form'
      introDiv.className = 'pixel-overlay' // << overlay propio con fondo diferenciado
      introDiv.innerHTML = `
        <div class="pixel-panel">
          <h3>Bienvenido a Lava Jump!</h3>
          <p style="margin-bottom:12px;color:#e2e8f0;">
            Ayuda al personaje a saltar plataformas y escapar de la lava.<br>
            Introduce tu nombre y edad para comenzar.
          </p>
          <form id="intro-user-form">
            <div class="pixel-field">
              <label class="pixel-label" for="intro-name">Nombre</label>
              <input type="text" id="intro-name" class="pixel-input" placeholder="Nombre" required />
            </div>
            <div class="pixel-field">
              <label class="pixel-label" for="intro-age">Edad</label>
              <input type="number" id="intro-age" class="pixel-input" placeholder="Edad" required min="1" />
            </div>
            <div class="pixel-actions">
              <button type="submit" class="btn-8 btn-affirm">Jugar</button>
            </div>
            <div class="pixel-error"></div>
          </form>
        </div>
      `
      document.body.appendChild(introDiv)
    }

    // Maneja el envío del formulario
    const form = introDiv.querySelector('#intro-user-form')
    const errorBox = form.querySelector('.pixel-error')
    form.onsubmit = (e) => {
      e.preventDefault()
      errorBox.style.display = 'none'
      const name = form.querySelector('#intro-name').value.trim()
      const age = Number(form.querySelector('#intro-age').value)
      if (!name) {
        errorBox.textContent = 'El nombre es obligatorio.'
        errorBox.style.display = 'block'
        return
      }
      if (!age || isNaN(age) || age <= 0) {
        errorBox.textContent = 'Por favor, introduce una edad válida.'
        errorBox.style.display = 'block'
        return
      }
      this.data = { name, age }
      this.save()
      introDiv.remove()
      document.dispatchEvent(new CustomEvent('user-info-ready', { detail: this.data }))
    }

    // UX: foco inicial en nombre
    const nameInput = introDiv.querySelector('#intro-name')
    setTimeout(()=> nameInput?.focus(), 0)
  }

  save() {
    localStorage.setItem(this.key, JSON.stringify(this.data))
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  getName() { return this.data?.name ?? '' }
  getAge()  { return this.data?.age ?? '' }
}
