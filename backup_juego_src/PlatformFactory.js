import Phaser from 'phaser'

export default class PlatformFactory {
	constructor(scene) {
		this.scene = scene
	}
	spawn(x, y) {
		const { scene } = this
		const plat = scene.platforms.create(x, y, 'platform')
		plat.refreshBody()
		// ...existing code...
		return plat
	}
}
