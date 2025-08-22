const gameConfig = {
  // Frecuencia de misiles de lava (en milisegundos)
  lavaMissiles: {
    // NUEVO: habilitar/deshabilitar completamente los misiles de lava
    enabled: false,

    // NUEVO: tasa de generación por minuto (si se define, ignora intervalSeconds/intervalMs)
    ratePerMinute: 0, // 0 para desactivar

    // Cada cuánto tiempo (elige UNA de estas opciones):
    // 1) Segundos fijos entre oleadas (número > 0)
    intervalSeconds: 2.5,
    // 2) Milisegundos fijos o rango {min,max} (se usa si no hay intervalSeconds; ignora si ratePerMinute > 0)
    // intervalMs: 3000,
    // intervalMs: { min: 1500, max: 3500 },

    // Velocidad de la partícula en px/s (acepta número o {min,max})
    speed: { min: 100, max: 200 },

    // Tamaño visual/collider en píxeles (acepta número o {min,max})
    size: { min: 10, max: 20 },

    // Cantidad de misiles por oleada (número o {min,max})
    count: { min: 1, max: 3 },
  },

  // Frecuencias de tipos de plataformas (pesos, no porcentajes; pueden sumar lo que quieras)
  platforms: {
    // NUEVO: distancia desde el borde inferior para empezar a generar las primeras plataformas
    // (valores mayores = más arriba, más cerca del tope de la pantalla)
    startYOffset: 90,
    // NUEVO: separación mínima por encima de la plataforma base donde pueden aparecer plataformas
    minGapAboveBase: 60,
    // NUEVO: evitar crear plataformas alineadas con la base; radio en píxeles
    avoidBaseXRadius: 80,
    weights: {
      normal: 0,
      fragile: 5,
      timed: 5,
      ice: 5,
      dodger: 0,
      invertX: 0,
      bouncy: 0,
      inversa: 0,
      deadly: 0.05, // NUEVO: activa la plataforma letal
      // Agrega más tipos si tu PlatformFactory los soporta, p. ej. moving: 5
    },
  },

  // Poderes temporales
  powers: {
    enabled: true, // Habilitar/deshabilitar poderes,
    // Probabilidad de generar un poder por plataforma creada (0–1)
    spawnChancePerPlatform: 0.01,
    // Ventana de aviso antes de expirar el poder (ms): parpadeo rápido
    warningMs: 500,
    // Pesos de aparicion por tipo
    weights: { noGravity: 0, freezeLava: 1, shield: 0 },
    // Config específico del modo sin gravedad
    noGravity: {
      durationMs: 5000, // duración del poder activo
      floatSpeed: 500, // velocidad de ascenso automática mientras dura
      lavaRiseBoost: 5.0, // factor extra para que la lava suba más rápido durante el poder
    },
    // Config de congelar lava
    freezeLava: {
      durationMs: 5000,
      tint: 0x3A4E65, // color de lava congelada
    },
    // Config del escudo (puede no expirar por tiempo; ghost tras rebote)
    shield: {
      durationMs: 0, // 0 = sin límite de tiempo; se consume al tocar lava o misil
      ghostMs: 600, // tiempo de modo fantasma tras rebotar
    },
  },

  // NUEVO: margen adicional antes de morir por tocar la lava (en píxeles)
  lava: {
    killMargin: 6,
  },

  // NUEVO: flags de depuración (posiciones y AABBs en colisiones)
  debug: {
    collisions: false, // ponlo en false para desactivar logs/dibujo
  },
};

export default gameConfig;
