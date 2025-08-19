# Ascenso (Prototipo)

Prototipo de juego de plataformas vertical tipo "sube lo más alto" hecho con Phaser 3 + Vite. Controles táctiles listos y lista base para empaquetar en iOS/Android con Capacitor.

## Ejecutar en web (desarrollo)

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite (generalmente http://localhost:5173).

## Construir

```bash
npm run build
npm run preview
```

## Empaquetar como app móvil (Capacitor)

1. Instala Capacitor y crea el proyecto:

```bash
npm i -D @capacitor/cli
npm i @capacitor/core
npx cap init ascenso com.tuempresa.ascenso --web-dir=dist
```

2. Construye la web antes de sincronizar:

```bash
npm run build
```

3. Añade plataformas y sincroniza:

```bash
npm i @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npx cap sync
```

4. Abre y corre en Xcode/Android Studio:

```bash
npx cap open ios
npx cap open android
```

Notas:
- Asegúrate de tener certificados y cuentas de desarrollador configuradas para firmar.
- Ajusta `capacitor.config.ts` si cambias el puerto/host de desarrollo.
- Para controles, ya hay zonas táctiles. En iOS recuerda desactivar gestos del navegador en modo app.

## Ideas siguientes
- Enemigos/hazards (picos, plataformas que desaparecen).
- Power-ups (cohete, salto extra).
- Skins del personaje y efectos.
- Sistema de misiones y monetización no intrusiva.
