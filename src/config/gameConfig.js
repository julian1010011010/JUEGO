const gameConfig = {
  // Frecuencia de misiles de lava (en milisegundos)
  lavaMissiles: {
    // NUEVO: habilitar/deshabilitar completamente los misiles de lava
    enabled: true,

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
    weights: {
      normal: 10,
      fragile: 10,
      timed: 10,
      ice: 10,
      dodger: 10,
      invertX: 10, bouncy: 10,
      inversa: 10
      // Agrega más tipos si tu PlatformFactory los soporta, p. ej. moving: 5
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
