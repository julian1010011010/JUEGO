const gameConfig = {
  // Frecuencia de misiles de lava (en milisegundos)
  lavaMissiles: {
    // NUEVO: habilitar/deshabilitar completamente los misiles de lava
    enabled: true ,

    // NUEVO: tasa de generación por minuto (si se define, ignora intervalSeconds/intervalMs)
    ratePerMinute: 0, // 0 para desactivar

  // Cada cuánto tiempo (elige UNA de estas opciones):
  // 1) Segundos fijos entre oleadas (número > 0) 
  intervalSeconds: 2.5,
  // 2) Milisegundos fijos o rango {min,max} (se usa si no hay intervalSeconds; ignora si ratePerMinute > 0)
  // intervalMs: 3000,
  // intervalMs: { min: 1500, max: 3500 },

    // Velocidad de la partícula en px/s (acepta número o {min,max})
    speed: { min: 10, max: 20 },

    // Tamaño visual/collider en píxeles (acepta número o {min,max})
    size: { min: 10, max: 20 },

  // Cantidad de misiles por oleada (número o {min,max})
  count: { min: 1, max: 2  }
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
      normal: 10,
      fragile: 10,
      timed: 10 ,
      ice: 10 ,
      dodger: 10,
      invertX: 0.5,
      bouncy: 90, 
      inversa: 10
      // Agrega más tipos si tu PlatformFactory los soporta, p. ej. moving: 5
    }
  },

  // Poderes temporales
  powers: {
    enabled: true,
    // Probabilidad de generar un poder por plataforma creada (0–1)
    spawnChancePerPlatform: 0.03  ,
  // Ventana de aviso antes de expirar el poder (ms): parpadeo rápido
  warningMs: 500,
    // Config específico del modo sin gravedad
    noGravity: {
  durationMs: 5000, // duración del poder activo
  floatSpeed: 500,   // velocidad de ascenso automática mientras dura
  lavaRiseBoost: 4.0 // factor extra para que la lava suba más rápido durante el poder
    }
  },

  // NUEVO: margen adicional antes de morir por tocar la lava (en píxeles)
  lava: {
    killMargin: 6
  },

  // NUEVO: flags de depuración (posiciones y AABBs en colisiones)
  debug: {
    collisions: false // ponlo en false para desactivar logs/dibujo
  }
}

export default gameConfig
