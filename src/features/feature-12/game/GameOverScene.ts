import Phaser from "phaser";
import { FONT, SCENE } from "./constants";
import { addStarfield } from "./starfield";
import { sfx } from "./sfx";

export type GameResult = {
  score: number;
  best: number;
  collected: number;
  level: number;
  isRecord: boolean;
};

export default class GameOverScene extends Phaser.Scene {
  private result: GameResult = { score: 0, best: 0, collected: 0, level: 1, isRecord: false };
  private heading!: Phaser.GameObjects.Text;
  private record!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE.over);
  }

  init(data: GameResult): void {
    this.result = data;
  }

  create(): void {
    addStarfield(this, 40);

    this.heading = this.add
      .text(0, 0, "임무 종료 💥", {
        fontFamily: FONT,
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.record = this.add
      .text(0, 0, this.result.isRecord ? "🎉 새로운 최고 기록!" : "", {
        fontFamily: FONT,
        fontSize: "16px",
        fontStyle: "bold",
        color: "#facc15",
      })
      .setOrigin(0.5);
    if (this.result.isRecord) {
      this.tweens.add({ targets: this.record, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    }

    this.stats = this.add
      .text(
        0,
        0,
        [
          `점수  ${this.result.score.toLocaleString()}`,
          `최고 기록  ${this.result.best.toLocaleString()}`,
          `수거한 쓰레기  ${this.result.collected}개`,
          `도달 레벨  LV ${this.result.level}`,
        ].join("\n"),
        {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#cbd5e1",
          align: "center",
          lineSpacing: 10,
        }
      )
      .setOrigin(0.5);

    this.button = this.buildRestartButton();

    this.hint = this.add
      .text(0, 0, "메인으로 돌아가려면 상단 ← 버튼", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#64748b",
      })
      .setOrigin(0.5);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
  }

  private buildRestartButton(): Phaser.GameObjects.Container {
    const w = 240;
    const h = 56; // 터치 타깃 44px 이상 확보
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.lineStyle(1.5, 0xffffff, 0.35);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);

    const label = this.add
      .text(0, 0, "다시 출발 🚀", {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const button = this.add.container(0, 0, [g, label]);
    button.setSize(w, h);
    button.setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => {
      sfx.start();
      this.scene.start(SCENE.game);
    });
    return button;
  }

  private layout(): void {
    const { width: w, height: h } = this.scale;
    const cx = w / 2;
    this.heading.setPosition(cx, h * 0.24);
    this.record.setPosition(cx, h * 0.24 + 36);
    this.stats.setPosition(cx, h * 0.42);
    this.button.setPosition(cx, h * 0.62);
    this.hint.setPosition(cx, h * 0.62 + 56);
  }
}
