import Phaser from "phaser";
import { FONT, SCENE, loadBest } from "./constants";
import { addStarfield } from "./starfield";
import { sfx } from "./sfx";

export default class TitleScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private howTo!: Phaser.GameObjects.Text;
  private best!: Phaser.GameObjects.Text;
  private startLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE.title);
  }

  create(): void {
    addStarfield(this);

    this.ship = this.add.text(0, 0, "🛸", { fontSize: "64px" }).setOrigin(0.5);
    this.tweens.add({
      targets: this.ship,
      y: "+=14",
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.title = this.add
      .text(0, 0, "줍스 스위퍼", {
        fontFamily: FONT,
        fontSize: "36px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.subtitle = this.add
      .text(0, 0, "우주쓰레기 수거 물리 아케이드", {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    this.howTo = this.add
      .text(
        0,
        0,
        [
          "화면을 누르고 있으면 손끝을 향해 비행해요",
          "🥫 쓰레기를 모아 콤보를 쌓고 ☄️ 파편은 피하세요",
          "🧲 자석 · 🛡️ 실드 파워업을 챙기세요",
        ].join("\n"),
        {
          fontFamily: FONT,
          fontSize: "14px",
          color: "#cbd5e1",
          align: "center",
          lineSpacing: 8,
        }
      )
      .setOrigin(0.5);

    const bestScore = loadBest();
    this.best = this.add
      .text(0, 0, bestScore > 0 ? `최고 기록 ${bestScore.toLocaleString()}점` : "", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#facc15",
      })
      .setOrigin(0.5);

    this.startLabel = this.add
      .text(0, 0, "화면을 터치해 출발 🚀", {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: this.startLabel,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });

    this.input.once("pointerdown", () => {
      sfx.start();
      this.scene.start(SCENE.game);
    });
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const cx = w / 2;
    this.ship.setPosition(cx, h * 0.22);
    this.title.setPosition(cx, h * 0.36);
    this.subtitle.setPosition(cx, h * 0.36 + 32);
    this.howTo.setWordWrapWidth(Math.min(w - 40, 340));
    this.howTo.setPosition(cx, h * 0.55);
    this.best.setPosition(cx, h * 0.68);
    this.startLabel.setPosition(cx, h * 0.8);
  }
}
