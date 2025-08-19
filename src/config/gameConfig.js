const gameConfig = {
  // Frecuencia de misiles de lava (en milisegundos)
  lavaMissiles: {
    // Puedes usar min/max para definir un rango aleatorio
    intervalMs: { min: 220, max: 420 },
    // NUEVO: velocidad de la partícula en px/s (acepta número o {min,max})
    speed: { min: 200, max: 300 },
    // NUEVO: tamaño visual/collider en píxeles (acepta número o {min,max})
    size: { min: 3, max: 9 }
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
  }
}

export default gameConfig
