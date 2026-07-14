import Phaser from "phaser";
import { DEPTH, TEX_DOT } from "./constants";

export function ensureDotTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX_DOT)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture(TEX_DOT, 8, 8);
  g.destroy();
}

export function addStarfield(scene: Phaser.Scene, count = 70): void {
  ensureDotTexture(scene);
  const { width, height } = scene.scale;
  for (let i = 0; i < count; i++) {
    const star = scene.add
      .image(Math.random() * width, Math.random() * height, TEX_DOT)
      .setScale(0.15 + Math.random() * 0.35)
      .setAlpha(0.15 + Math.random() * 0.55)
      .setDepth(DEPTH.stars);
    if (Math.random() < 0.4) {
      scene.tweens.add({
        targets: star,
        alpha: 0.05,
        duration: 800 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
      });
    }
  }
}
