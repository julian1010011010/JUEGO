import Phaser from 'phaser'
import GameScene from './scenes/GameScene.js'

const width = 480
const height = 800

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0f1020',
  pixelArt: true,
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width,
    height
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false
    }
  },
  scene: [GameScene]
}

new Phaser.Game(config)
