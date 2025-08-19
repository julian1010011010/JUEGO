const gameConfig = {
  // Frecuencia de misiles de lava (en milisegundos)
  lavaMissiles: {
    // Puedes usar un valor fijo en segundos:
    intervalSeconds: 1.5,
    // También puedes dejar intervalMs como número fijo en ms o como rango {min,max}
    // intervalMs: 1500,

    // Velocidad de la partícula en px/s (acepta número o {min,max})
    speed: { min: 100, max: 200 },
    // Tamaño visual/collider en píxeles (rango 4–10)
    size: { min: 4, max: 10 },
    // Cantidad de partículas por tick (número fijo)
    count: 1
  },

  // Frecuencias de tipos de plataformas (pesos, no porcentajes; pueden sumar lo que quieras)
  platforms: {
    weights: {
      normal: 55,
      fragile: 12,
      timed: 10,
      ice: 10,
      dodger: 13
      // Agrega más tipos si tu PlatformFactory los soporta, p. ej. moving: 5
    }
  },

  // NUEVO: margen adicional antes de morir por tocar la lava (en píxeles)
  lava: {
    killMargin: 6
  },

  // NUEVO: flags de depuración (posiciones y AABBs en colisiones)
  debug: {
    collisions: true // ponlo en false para desactivar logs/dibujo
  }
}

export default gameConfig
 