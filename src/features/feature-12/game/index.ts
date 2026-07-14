import Phaser from "phaser";
import TitleScene from "./TitleScene";
import GameScene from "./GameScene";
import GameOverScene from "./GameOverScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#060613",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: [TitleScene, GameScene, GameOverScene],
  });
}
