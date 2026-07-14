import Phaser from "phaser";
import {
  COMBO_WINDOW_MS,
  DEPTH,
  FONT,
  INVULN_MS,
  JUNK_EMOJI,
  LEVEL_EVERY,
  MAGNET_MS,
  MAGNET_RANGE,
  MAX_COMBO,
  MAX_LEVEL,
  MAX_SPEED,
  POWERUP_EVERY_MS,
  POWERUP_TTL_MS,
  SCENE,
  SHIP_DRAG,
  START_LIVES,
  TEX_DOT,
  THRUST,
  loadBest,
  saveBest,
} from "./constants";
import { addStarfield, ensureDotTexture } from "./starfield";
import { sfx } from "./sfx";

type Body = Phaser.Physics.Arcade.Body;

export default class GameScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Text;
  private junk!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private powerups!: Phaser.Physics.Arcade.Group;

  private thruster!: Phaser.GameObjects.Particles.ParticleEmitter;
  private collectBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private magnetRing!: Phaser.GameObjects.Arc;
  private shieldRing!: Phaser.GameObjects.Arc;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  private score = 0;
  private collected = 0;
  private combo = 0;
  private lastCollectAt = -Infinity;
  private level = 1;
  private lives = START_LIVES;
  private invulnUntil = 0;
  private magnetUntil = 0;
  private shielded = false;
  private ended = false;

  constructor() {
    super(SCENE.game);
  }

  create(): void {
    this.score = 0;
    this.collected = 0;
    this.combo = 0;
    this.lastCollectAt = -Infinity;
    this.level = 1;
    this.lives = START_LIVES;
    this.magnetUntil = 0;
    this.shielded = false;
    this.ended = false;

    ensureDotTexture(this);
    addStarfield(this);

    const { width: w, height: h } = this.scale;
    this.physics.world.setBounds(0, 0, w, h);

    this.junk = this.physics.add.group();
    this.hazards = this.physics.add.group();
    this.powerups = this.physics.add.group();

    this.ship = this.add.text(w / 2, h / 2, "🛸", { fontSize: "34px" }).setOrigin(0.5).setDepth(DEPTH.ship);
    this.physics.add.existing(this.ship);
    const body = this.shipBody();
    body.setSize(this.ship.width * 0.72, this.ship.height * 0.72, true);
    body.setDamping(true);
    body.setDrag(SHIP_DRAG, SHIP_DRAG);
    body.setMaxSpeed(MAX_SPEED);
    this.invulnUntil = this.time.now + 1500;

    this.magnetRing = this.add
      .circle(0, 0, 46)
      .setStrokeStyle(2, 0xfacc15, 0.8)
      .setDepth(DEPTH.fx)
      .setVisible(false);
    this.shieldRing = this.add
      .circle(0, 0, 30)
      .setStrokeStyle(2, 0x38bdf8, 0.9)
      .setDepth(DEPTH.fx)
      .setVisible(false);

    this.thruster = this.add.particles(0, 0, TEX_DOT, {
      speed: { min: 40, max: 100 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 320,
      quantity: 2,
      tint: [0x7dd3fc, 0x38bdf8, 0xa5b4fc],
      emitting: false,
    });
    this.thruster.setDepth(DEPTH.fx);
    this.thruster.startFollow(this.ship);

    this.collectBurst = this.add.particles(0, 0, TEX_DOT, {
      speed: { min: 60, max: 180 },
      scale: { start: 0.7, end: 0 },
      lifespan: 450,
      tint: [0xa3e635, 0xfacc15, 0x86efac],
      emitting: false,
    });
    this.collectBurst.setDepth(DEPTH.fx);

    this.hitBurst = this.add.particles(0, 0, TEX_DOT, {
      speed: { min: 80, max: 240 },
      scale: { start: 0.9, end: 0 },
      lifespan: 500,
      tint: [0xf87171, 0xfb923c, 0xfca5a5],
      emitting: false,
    });
    this.hitBurst.setDepth(DEPTH.fx);

    this.buildHud();

    this.physics.add.overlap(this.ship, this.junk, (_ship, junk) => {
      this.onCollect(junk as Phaser.GameObjects.Text);
    });
    this.physics.add.overlap(this.ship, this.hazards, (_ship, hazard) => {
      this.onHit(hazard as Phaser.GameObjects.Text);
    });
    this.physics.add.overlap(this.ship, this.powerups, (_ship, powerup) => {
      this.onPowerup(powerup as Phaser.GameObjects.Text);
    });

    for (let i = 0; i < this.junkTarget(); i++) this.spawnJunk(false);
    this.scheduleHazard();
    this.time.addEvent({
      delay: POWERUP_EVERY_MS,
      loop: true,
      callback: () => this.spawnPowerup(),
    });

    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.onResize, this);
    });

    this.floatText(w / 2, h * 0.35, "우주쓰레기를 수거하세요!", "#e2e8f0", 18);
  }

  update(): void {
    if (this.ended) return;

    const body = this.shipBody();
    const pointer = this.input.activePointer;
    if (pointer.isDown) {
      const dist = Phaser.Math.Distance.Between(this.ship.x, this.ship.y, pointer.worldX, pointer.worldY);
      if (dist > 24) {
        this.physics.accelerateTo(this.ship, pointer.worldX, pointer.worldY, THRUST);
        this.thruster.emitting = true;
      } else {
        body.setAcceleration(0, 0);
        this.thruster.emitting = false;
      }
    } else {
      body.setAcceleration(0, 0);
      this.thruster.emitting = false;
    }
    this.ship.setAngle(Phaser.Math.Clamp(body.velocity.x * 0.04, -18, 18));

    const now = this.time.now;
    const magnetOn = now < this.magnetUntil;
    this.magnetRing.setVisible(magnetOn).setPosition(this.ship.x, this.ship.y);
    if (magnetOn) this.magnetRing.setAlpha(0.5 + 0.3 * Math.sin(now / 90));
    this.shieldRing.setVisible(this.shielded).setPosition(this.ship.x, this.ship.y);

    for (const junk of this.junk.getChildren() as Phaser.GameObjects.Text[]) {
      if (!junk.active) continue;
      const jb = junk.body as Body;
      if (
        magnetOn &&
        Phaser.Math.Distance.Between(junk.x, junk.y, this.ship.x, this.ship.y) < MAGNET_RANGE
      ) {
        this.physics.accelerateTo(junk, this.ship.x, this.ship.y, 420);
      } else {
        jb.setAcceleration(0, 0);
      }
    }

    this.physics.world.wrap(this.ship, 40);
    for (const group of [this.junk, this.hazards, this.powerups]) {
      for (const obj of group.getChildren()) {
        if (obj.active) this.physics.world.wrap(obj, 40);
      }
    }

    if (this.combo > 0 && now - this.lastCollectAt > COMBO_WINDOW_MS) {
      this.combo = 0;
      this.comboText.setVisible(false);
    }
  }

  // ── 스폰 ──────────────────────────────────────────────

  private junkTarget(): number {
    return 6 + Math.min(this.level, 4);
  }

  private hazardCap(): number {
    return Math.min(2 + this.level, 8);
  }

  private hazardDelay(): number {
    return Math.max(2600 - this.level * 260, 900);
  }

  private edgePoint(pad = 28): Phaser.Math.Vector2 {
    const { width: w, height: h } = this.scale;
    switch (Phaser.Math.Between(0, 3)) {
      case 0:
        return new Phaser.Math.Vector2(Phaser.Math.Between(0, w), -pad);
      case 1:
        return new Phaser.Math.Vector2(w + pad, Phaser.Math.Between(0, h));
      case 2:
        return new Phaser.Math.Vector2(Phaser.Math.Between(0, w), h + pad);
      default:
        return new Phaser.Math.Vector2(-pad, Phaser.Math.Between(0, h));
    }
  }

  private spawnJunk(fromEdge = true): void {
    const { width: w, height: h } = this.scale;
    let x: number;
    let y: number;
    if (fromEdge) {
      const p = this.edgePoint();
      x = p.x;
      y = p.y;
    } else {
      // 초기 배치: 함선 주변 120px은 비워 둔다
      do {
        x = Phaser.Math.Between(20, w - 20);
        y = Phaser.Math.Between(60, h - 20);
      } while (Phaser.Math.Distance.Between(x, y, w / 2, h / 2) < 120);
    }

    const junk = this.add
      .text(x, y, Phaser.Utils.Array.GetRandom(JUNK_EMOJI), { fontSize: "26px" })
      .setOrigin(0.5)
      .setDepth(DEPTH.junk);
    this.junk.add(junk);
    const body = junk.body as Body;
    body.setSize(junk.width * 0.9, junk.height * 0.9, true);

    const target = new Phaser.Math.Vector2(
      w * 0.5 + Phaser.Math.Between(-w * 0.3, w * 0.3),
      h * 0.5 + Phaser.Math.Between(-h * 0.3, h * 0.3)
    );
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const speed = Phaser.Math.Between(40, 90);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setAngularVelocity(Phaser.Math.Between(-40, 40));
  }

  private scheduleHazard(): void {
    if (this.ended) return;
    this.time.delayedCall(this.hazardDelay(), () => {
      if (this.ended) return;
      if (this.hazards.countActive(true) < this.hazardCap()) this.spawnHazard();
      this.scheduleHazard();
    });
  }

  private spawnHazard(): void {
    const p = this.edgePoint();
    const hazard = this.add
      .text(p.x, p.y, "☄️", { fontSize: "28px" })
      .setOrigin(0.5)
      .setDepth(DEPTH.hazard);
    this.hazards.add(hazard);
    const body = hazard.body as Body;
    body.setSize(hazard.width * 0.8, hazard.height * 0.8, true);

    const spread = Phaser.Math.DegToRad(Phaser.Math.Between(-30, 30));
    const angle = Phaser.Math.Angle.Between(p.x, p.y, this.ship.x, this.ship.y) + spread;
    const speed = 110 + this.level * 16;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setAngularVelocity(Phaser.Math.Between(-140, 140));
  }

  private spawnPowerup(): void {
    if (this.ended || this.powerups.countActive(true) > 0) return;
    const kind = Math.random() < 0.5 ? "magnet" : "shield";
    const p = this.edgePoint();
    const powerup = this.add
      .text(p.x, p.y, kind === "magnet" ? "🧲" : "🛡️", { fontSize: "28px" })
      .setOrigin(0.5)
      .setDepth(DEPTH.powerup);
    powerup.setData("kind", kind);
    this.powerups.add(powerup);
    const body = powerup.body as Body;
    body.setSize(powerup.width * 0.9, powerup.height * 0.9, true);

    const { width: w, height: h } = this.scale;
    const angle = Phaser.Math.Angle.Between(p.x, p.y, w / 2, h / 2);
    body.setVelocity(Math.cos(angle) * 55, Math.sin(angle) * 55);

    this.time.delayedCall(POWERUP_TTL_MS, () => {
      if (!powerup.active) return;
      this.tweens.add({
        targets: powerup,
        alpha: 0,
        duration: 300,
        onComplete: () => powerup.destroy(),
      });
    });
  }

  // ── 충돌 처리 ──────────────────────────────────────────

  private onCollect(junk: Phaser.GameObjects.Text): void {
    if (!junk.active || this.ended) return;
    const now = this.time.now;
    this.combo = now - this.lastCollectAt < COMBO_WINDOW_MS ? Math.min(this.combo + 1, MAX_COMBO) : 1;
    this.lastCollectAt = now;

    const points = 10 * this.combo;
    this.score += points;
    this.collected += 1;

    this.collectBurst.explode(12, junk.x, junk.y);
    this.floatText(junk.x, junk.y, this.combo > 1 ? `+${points} ×${this.combo}` : `+${points}`);
    sfx.collect(this.combo);
    junk.destroy();

    while (this.junk.countActive(true) < this.junkTarget()) this.spawnJunk();

    const newLevel = Math.min(1 + Math.floor(this.collected / LEVEL_EVERY), MAX_LEVEL);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.onLevelUp();
    }
    this.updateHud();
  }

  private onLevelUp(): void {
    sfx.levelUp();
    const { width: w, height: h } = this.scale;
    const banner = this.add
      .text(w / 2, h * 0.3, `LEVEL ${this.level} 🚀`, {
        fontFamily: FONT,
        fontSize: "28px",
        fontStyle: "bold",
        color: "#facc15",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: "Back.easeOut",
      yoyo: true,
      hold: 700,
      onComplete: () => banner.destroy(),
    });
  }

  private onPowerup(powerup: Phaser.GameObjects.Text): void {
    if (!powerup.active || this.ended) return;
    const kind = powerup.getData("kind") as string;
    this.collectBurst.explode(14, powerup.x, powerup.y);
    sfx.power();
    if (kind === "magnet") {
      this.magnetUntil = this.time.now + MAGNET_MS;
      this.floatText(powerup.x, powerup.y, "자석 발동! 🧲", "#facc15");
    } else {
      this.shielded = true;
      this.floatText(powerup.x, powerup.y, "실드 장착! 🛡️", "#38bdf8");
    }
    powerup.destroy();
  }

  private onHit(hazard: Phaser.GameObjects.Text): void {
    if (!hazard.active || this.ended || this.time.now < this.invulnUntil) return;

    this.hitBurst.explode(16, hazard.x, hazard.y);
    hazard.destroy();
    this.cameras.main.shake(200, 0.008);
    this.shipBody().velocity.scale(-0.5);

    if (this.shielded) {
      this.shielded = false;
      sfx.shieldBreak();
      this.floatText(this.ship.x, this.ship.y - 30, "실드가 막아냈다!", "#38bdf8");
      this.invulnUntil = this.time.now + 800;
      return;
    }

    this.lives -= 1;
    sfx.hit();
    this.updateHud();

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    this.invulnUntil = this.time.now + INVULN_MS;
    this.floatText(this.ship.x, this.ship.y - 30, "충돌! 💥", "#f87171");
    this.tweens.add({
      targets: this.ship,
      alpha: 0.25,
      duration: 120,
      yoyo: true,
      repeat: Math.floor(INVULN_MS / 240),
      onComplete: () => this.ship.setAlpha(1),
    });
  }

  private gameOver(): void {
    this.ended = true;
    this.thruster.emitting = false;
    this.shipBody().stop();
    this.hitBurst.explode(28, this.ship.x, this.ship.y);
    this.cameras.main.shake(350, 0.012);
    sfx.over();

    const best = Math.max(loadBest(), this.score);
    const isRecord = this.score > 0 && this.score >= best && this.score > loadBest();
    saveBest(best);

    this.tweens.add({ targets: this.ship, alpha: 0, scale: 0.3, duration: 500 });
    this.time.delayedCall(900, () => {
      this.scene.start(SCENE.over, {
        score: this.score,
        best,
        collected: this.collected,
        level: this.level,
        isRecord,
      });
    });
  }

  // ── HUD / 유틸 ────────────────────────────────────────

  private buildHud(): void {
    const style = { fontFamily: FONT, color: "#ffffff" };
    this.scoreText = this.add
      .text(12, 10, "", { ...style, fontSize: "18px", fontStyle: "bold" })
      .setDepth(DEPTH.hud);
    this.comboText = this.add
      .text(12, 36, "", { ...style, fontSize: "14px", color: "#a3e635" })
      .setDepth(DEPTH.hud)
      .setVisible(false);
    this.livesText = this.add
      .text(0, 10, "", { ...style, fontSize: "16px" })
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);
    this.levelText = this.add
      .text(0, 12, "", { ...style, fontSize: "14px", color: "#94a3b8" })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud);
    this.onResize();
    this.updateHud();
  }

  private updateHud(): void {
    this.scoreText.setText(`점수 ${this.score.toLocaleString()}`);
    this.livesText.setText("❤️".repeat(this.lives) + "🖤".repeat(Math.max(START_LIVES - this.lives, 0)));
    this.levelText.setText(`LV ${this.level} · ${this.collected}개`);
    if (this.combo > 1) {
      this.comboText.setText(`콤보 ×${this.combo}`).setVisible(true);
    }
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    this.physics.world.setBounds(0, 0, w, h);
    this.livesText.setPosition(w - 12, 10);
    this.levelText.setPosition(w / 2, 12);
    this.ship.setPosition(
      Phaser.Math.Clamp(this.ship.x, 0, w),
      Phaser.Math.Clamp(this.ship.y, 0, h)
    );
  }

  private floatText(x: number, y: number, message: string, color = "#a3e635", size = 16): void {
    const label = this.add
      .text(x, y, message, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: "bold",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.tweens.add({
      targets: label,
      y: y - 36,
      alpha: 0,
      duration: 750,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private shipBody(): Body {
    return this.ship.body as Body;
  }
}
