// 플레이 화면의 2D 아케이드 엔진 (캔버스 2D, 의존성 없음).
// 지구(WebGL 캔버스) 위에 투명 캔버스로 겹쳐 그린다.
// 줍스 조종, 쓰레기 흡수, 위성 충돌, 다른 줍스 조우, 아이템을 담당하고
// 점수/체력 반영은 hooks를 통해 스토어에 위임한다.

import { DEBRIS_TIERS } from "./constants";
import { loadSprites, type Sprites } from "./sprites";

export type ArcadeHooks = {
  /** 쓰레기 흡수 → 실제 획득 XP 반환 */
  onEat: (tier: number) => number;
  onHurt: (damage: number) => void;
  /** 다른 줍스 조우 → 획득 XP 반환 */
  onEncounter: () => number;
  onGlobalItem: () => void;
  getStage: () => {
    index: number;
    maxTier: number;
    size: number;
    bodyColor: string;
    glowColor: string;
  };
  getHealth: () => number;
  getEnergy: () => number;
  getMood: () => number;
  isComm: () => boolean;
};

type Debris = {
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  seed: number;
  /** 0~1 흡수 진행도 (null이면 자유 낙하 중) */
  eating: number | null;
};

type Satellite = { x: number; y: number; vx: number; vy: number; blink: number };

type Friend = {
  x: number;
  y: number;
  vx: number;
  wobble: number;
  hue: number;
  met: boolean;
  metT: number;
};

type Item = { x: number; y: number; vx: number; pulse: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "spark" | "heart" | "puff" | "flame";
};

type Floater = { x: number; y: number; text: string; color: string; life: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export class ArcadeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hooks: ArcadeHooks;
  private sprites: Sprites;
  private raf = 0;
  private running = false;
  private lastT = 0;
  private w = 0;
  private h = 0;

  private joops = {
    x: 120,
    y: 200,
    vx: 0,
    vy: 0,
    blinkT: rand(2, 4),
    blinking: 0,
    hurtT: 0,
    dashT: 0,
    happyT: 0,
  };
  private target: { x: number; y: number } | null = null;
  private lastTapAt = 0;

  private debris: Debris[] = [];
  private sats: Satellite[] = [];
  private friends: Friend[] = [];
  private item: Item | null = null;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];

  private tDebris = 0;
  private tSat = 6;
  private tFriend = 12;
  private tItem = 20;
  private shake = 0;
  private redFlash = 0;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, hooks: ArcadeHooks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D 컨텍스트를 만들 수 없습니다");
    this.ctx = ctx;
    this.hooks = hooks;
    this.sprites = loadSprites();

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
  }

  resize(cssW: number, cssH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = cssW;
    this.h = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.joops.x = Math.min(this.joops.x, cssW - 40) || cssW * 0.3;
    this.joops.y = Math.min(this.joops.y, cssH - 40) || cssH * 0.4;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this.time += dt;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
  }

  // ---- 입력 ----

  private toLocal(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.target = this.toLocal(e);
    const now = performance.now();
    // 더블 탭 → 대시 (한 등급 위 쓰레기도 흡수 가능)
    if (now - this.lastTapAt < 280 && this.hooks.getStage().index >= 1) {
      this.joops.dashT = 0.8;
      const dx = this.target.x - this.joops.x;
      const dy = this.target.y - this.joops.y;
      const d = Math.hypot(dx, dy) || 1;
      this.joops.vx += (dx / d) * 420;
      this.joops.vy += (dy / d) * 420;
    }
    this.lastTapAt = now;
  };

  private onMove = (e: PointerEvent): void => {
    if (this.target) this.target = this.toLocal(e);
  };

  private onUp = (): void => {
    this.target = null;
  };

  // ---- 업데이트 ----

  private update(dt: number): void {
    const j = this.joops;
    const stage = this.hooks.getStage();
    const health = this.hooks.getHealth();
    const energy = this.hooks.getEnergy();
    const size = stage.size;

    // 스폰 타이머
    this.tDebris -= dt;
    this.tSat -= dt;
    this.tFriend -= dt;
    this.tItem -= dt;
    if (this.tDebris <= 0) {
      this.spawnDebris();
      this.tDebris = rand(0.55, 1.0) * Math.max(0.6, 420 / this.w);
    }
    if (this.tSat <= 0) {
      this.spawnSatellite();
      this.tSat = rand(11, 18);
    }
    if (this.tFriend <= 0) {
      this.spawnFriend();
      this.tFriend = rand(22, 38);
    }
    if (this.tItem <= 0 && !this.item) {
      this.item = { x: this.w + 30, y: rand(this.h * 0.15, this.h * 0.6), vx: -rand(35, 55), pulse: 0 };
      this.tItem = rand(40, 70);
    }

    // 줍스 이동: 조종 또는 자율 비행
    const weak = health < 30;
    const accel = (this.target ? 900 : 220) * (energy < 12 ? 0.45 : 1) * (weak ? 0.6 : 1);
    const maxV = (this.target ? 380 : 160) * (weak ? 0.55 : 1) + (j.dashT > 0 ? 260 : 0);
    let tx: number | null = null;
    let ty: number | null = null;
    if (this.target) {
      tx = this.target.x;
      ty = this.target.y;
    } else {
      // 자율 청소: 가까운 흡수 가능 쓰레기를 향해 천천히
      const prey = this.nearestEdible(stage.maxTier);
      if (prey) {
        tx = prey.x;
        ty = prey.y;
      } else {
        tx = this.w * 0.3;
        ty = this.h * 0.42 + Math.sin(this.time * 0.9) * 26;
      }
    }
    if (tx !== null && ty !== null) {
      const dx = tx - j.x;
      const dy = ty - j.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        j.vx += (dx / d) * accel * dt;
        j.vy += (dy / d) * accel * dt;
      }
    }
    // 감쇠 + 속도 제한
    const damp = Math.pow(0.15, dt);
    j.vx *= damp;
    j.vy *= damp;
    const spd = Math.hypot(j.vx, j.vy);
    if (spd > maxV) {
      j.vx = (j.vx / spd) * maxV;
      j.vy = (j.vy / spd) * maxV;
    }
    j.x += j.vx * dt;
    j.y += j.vy * dt;
    j.x = Math.max(size, Math.min(this.w - size, j.x));
    j.y = Math.max(size + 8, Math.min(this.h - size - 8, j.y));

    // 추진 불꽃
    if (spd > 90 && Math.random() < 0.6) {
      this.particles.push({
        x: j.x - (j.vx / (spd || 1)) * size,
        y: j.y - (j.vy / (spd || 1)) * size,
        vx: -j.vx * 0.25 + rand(-18, 18),
        vy: -j.vy * 0.25 + rand(-18, 18),
        life: 0.35,
        maxLife: 0.35,
        size: rand(2, 4.5),
        color: j.dashT > 0 ? "#ffd97a" : "#5eead4",
        kind: "flame",
      });
    }

    j.blinkT -= dt;
    if (j.blinkT <= 0) {
      j.blinking = 0.12;
      j.blinkT = rand(2.4, 5);
    }
    j.blinking = Math.max(0, j.blinking - dt);
    j.hurtT = Math.max(0, j.hurtT - dt);
    j.dashT = Math.max(0, j.dashT - dt);
    j.happyT = Math.max(0, j.happyT - dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.redFlash = Math.max(0, this.redFlash - dt * 1.6);

    // 쓰레기 이동/충돌
    const effTier = stage.maxTier + (j.dashT > 0 ? 1 : 0);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      if (d.eating !== null) {
        d.eating += dt * 4.5;
        d.x += (j.x - d.x) * Math.min(1, dt * 14);
        d.y += (j.y - d.y) * Math.min(1, dt * 14);
        if (d.eating >= 1) {
          this.debris.splice(i, 1);
          const xp = this.hooks.onEat(d.tier);
          this.burst(j.x, j.y, "#5eead4", 8, "spark");
          this.floaters.push({
            x: j.x,
            y: j.y - stage.size - 10,
            text: `+${xp}`,
            color: "#5eead4",
            life: 1,
          });
          this.joops.happyT = 0.6;
        }
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vrot * dt;
      if (d.x < -60) {
        this.debris.splice(i, 1);
        continue;
      }
      const def = DEBRIS_TIERS[d.tier - 1];
      const dist = Math.hypot(d.x - j.x, d.y - j.y);
      if (dist < def.radius + size * 0.9) {
        if (d.tier <= effTier) {
          d.eating = 0;
        } else if (j.hurtT <= 0) {
          this.hitJoops(6 + d.tier * 3, d.x, d.y);
        }
      }
    }

    // 활동 중인 인공위성 (항상 회피 대상)
    for (let i = this.sats.length - 1; i >= 0; i--) {
      const s = this.sats[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.blink += dt;
      if (s.x < -80) {
        this.sats.splice(i, 1);
        continue;
      }
      if (Math.hypot(s.x - j.x, s.y - j.y) < 30 + size * 0.9 && j.hurtT <= 0) {
        this.hitJoops(18, s.x, s.y);
      }
    }

    // 다른 줍스 (조우 시 경험치 + 깜찍 효과)
    for (let i = this.friends.length - 1; i >= 0; i--) {
      const f = this.friends[i];
      f.x += f.vx * dt;
      f.wobble += dt;
      f.y += Math.sin(f.wobble * 2.2) * 14 * dt;
      if (f.met) f.metT += dt;
      if (f.x < -70 || f.metT > 3.5) {
        this.friends.splice(i, 1);
        continue;
      }
      if (!f.met && Math.hypot(f.x - j.x, f.y - j.y) < size + 34) {
        f.met = true;
        f.vx *= 0.25;
        const xp = this.hooks.onEncounter();
        this.burst((f.x + j.x) / 2, (f.y + j.y) / 2 - 20, "#fda4af", 12, "heart");
        this.floaters.push({
          x: (f.x + j.x) / 2,
          y: (f.y + j.y) / 2 - 46,
          text: `친구! +${xp}`,
          color: "#fda4af",
          life: 1.4,
        });
        this.joops.happyT = 1.6;
      }
    }

    // 글로벌 링크 코어
    if (this.item) {
      const it = this.item;
      it.x += it.vx * dt;
      it.pulse += dt;
      if (it.x < -40) this.item = null;
      else if (Math.hypot(it.x - j.x, it.y - j.y) < size + 20) {
        this.hooks.onGlobalItem();
        this.burst(it.x, it.y, "#fbbf24", 16, "spark");
        this.floaters.push({
          x: it.x,
          y: it.y - 30,
          text: "글로벌 링크 활성!",
          color: "#fbbf24",
          life: 1.6,
        });
        this.item = null;
      }
    }

    // 파티클 / 플로터
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "heart") p.vy -= 30 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt * 0.8;
      f.y -= 28 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  private nearestEdible(maxTier: number): Debris | null {
    let best: Debris | null = null;
    let bestD = Infinity;
    for (const d of this.debris) {
      if (d.eating !== null || d.tier > maxTier) continue;
      const dist = Math.hypot(d.x - this.joops.x, d.y - this.joops.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  private hitJoops(damage: number, fromX: number, fromY: number): void {
    const j = this.joops;
    j.hurtT = 1.5;
    this.shake = 1;
    this.redFlash = 0.7;
    const dx = j.x - fromX;
    const dy = j.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    j.vx += (dx / d) * 300;
    j.vy += (dy / d) * 300;
    this.hooks.onHurt(damage);
    this.burst(j.x, j.y, "#f87171", 10, "puff");
    this.floaters.push({
      x: j.x,
      y: j.y - 40,
      text: `-${damage} 체력`,
      color: "#f87171",
      life: 1.2,
    });
  }

  private burst(
    x: number,
    y: number,
    color: string,
    n: number,
    kind: Particle["kind"],
  ): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = kind === "heart" ? rand(20, 70) : rand(40, 140);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === "heart" ? 40 : 0),
        life: kind === "heart" ? rand(0.8, 1.3) : rand(0.3, 0.7),
        maxLife: 1,
        size: kind === "heart" ? rand(5, 9) : rand(2, 5),
        color,
        kind,
      });
    }
  }

  private spawnDebris(): void {
    const total = DEBRIS_TIERS.reduce((s, d) => s + d.weight, 0);
    let r = Math.random() * total;
    let tier = 1;
    for (const d of DEBRIS_TIERS) {
      r -= d.weight;
      if (r <= 0) {
        tier = d.tier;
        break;
      }
    }
    this.debris.push({
      tier,
      x: this.w + 50,
      y: rand(20, this.h - 30),
      vx: -rand(42, 115) - tier * 4,
      vy: rand(-14, 14),
      rot: rand(0, TAU),
      vrot: rand(-1.4, 1.4),
      seed: Math.random(),
      eating: null,
    });
  }

  private spawnSatellite(): void {
    const y = rand(this.h * 0.1, this.h * 0.8);
    this.sats.push({ x: this.w + 70, y, vx: -rand(130, 190), vy: rand(-10, 10), blink: 0 });
  }

  private spawnFriend(): void {
    this.friends.push({
      x: this.w + 60,
      y: rand(this.h * 0.15, this.h * 0.7),
      vx: -rand(55, 85),
      wobble: rand(0, 10),
      hue: Math.random() < 0.5 ? 340 : 265,
      met: false,
      metT: 0,
    });
  }

  // ---- 그리기 ----

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(rand(-6, 6) * this.shake, rand(-6, 6) * this.shake);
    }

    for (const d of this.debris) this.drawDebris(d);
    for (const s of this.sats) this.drawSatellite(s);
    if (this.item) this.drawItem(this.item);
    for (const f of this.friends) this.drawFriend(f);
    this.drawJoops();
    this.drawParticles();
    this.drawFloaters();

    ctx.restore();

    if (this.redFlash > 0) {
      const g = ctx.createRadialGradient(
        this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3,
        this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7,
      );
      g.addColorStop(0, "rgba(220,38,38,0)");
      g.addColorStop(1, `rgba(220,38,38,${0.4 * this.redFlash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  private drawJoops(): void {
    const stage = this.hooks.getStage();
    const sprite = this.sprites.joopsByStage[stage.index];
    if (sprite) this.drawJoopsSprite(sprite);
    else this.drawJoopsVector();
  }

  /** SVG 아트 스프라이트 버전 */
  private drawJoopsSprite(img: HTMLImageElement): void {
    const ctx = this.ctx;
    const j = this.joops;
    const stage = this.hooks.getStage();
    const size = stage.size;
    const spd = Math.hypot(j.vx, j.vy);
    const dir = Math.atan2(j.vy, j.vx);
    const squash = 1 + Math.min(0.22, spd / 900);
    const W = size * 4.3; // 스프라이트 한 변 (헬멧 포함)

    ctx.save();
    ctx.translate(j.x, j.y);

    // 별빛 단계 아우라
    if (stage.index >= 4) {
      const g = ctx.createRadialGradient(0, 0, W * 0.2, 0, 0, W * 0.75);
      g.addColorStop(0, "rgba(255,217,122,0.28)");
      g.addColorStop(1, "rgba(255,217,122,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.75, 0, TAU);
      ctx.fill();
    }

    ctx.rotate(dir * Math.min(1, spd / 500) * 0.25);
    ctx.scale(squash, 1 / squash);

    // 피격 중 깜빡임 (무적 시간 표시)
    if (j.hurtT > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 26);
    ctx.shadowColor = stage.glowColor;
    ctx.shadowBlur = 24;
    ctx.drawImage(img, -W / 2, -W / 2, W, W);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 진화 액세서리: 청소부 링(3단계+), 수호자 실드(4단계+)
    if (stage.index >= 2) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, W * 0.14, W * 0.44, W * 0.13, -0.25, 0, TAU);
      ctx.stroke();
    }
    if (stage.index >= 3) {
      ctx.strokeStyle = "rgba(195,155,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.5, -0.9, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, W * 0.5, Math.PI - 0.9, Math.PI + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // 교신 중이면 안테나 구슬에 초록 펄스
    if (this.hooks.isComm()) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      ctx.fillStyle = `rgba(74,222,128,${0.35 + 0.4 * pulse})`;
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 12 * pulse;
      ctx.beginPath();
      ctx.arc(j.x, j.y - W / 3, W * 0.045, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 체력이 낮으면 눈물 방울
    if (this.hooks.getHealth() < 30 && j.hurtT <= 0) {
      const bob = Math.sin(this.time * 3) * 2;
      const tx = j.x - W * 0.1;
      const ty = j.y + W * 0.06 + bob;
      ctx.fillStyle = "#7CC8FF";
      ctx.beginPath();
      ctx.moveTo(tx, ty - 7);
      ctx.quadraticCurveTo(tx + 6, ty + 2, tx, ty + 6);
      ctx.quadraticCurveTo(tx - 6, ty + 2, tx, ty - 7);
      ctx.fill();
    }
  }

  /** 폴백: 코드 드로잉 버전 */
  private drawJoopsVector(): void {
    const ctx = this.ctx;
    const j = this.joops;
    const stage = this.hooks.getStage();
    const size = stage.size;
    const spd = Math.hypot(j.vx, j.vy);
    const dir = Math.atan2(j.vy, j.vx);
    const squash = 1 + Math.min(0.22, spd / 900);
    const hurt = j.hurtT > 1.1;
    const sad = this.hooks.getHealth() < 30;
    const happy = j.happyT > 0 || this.hooks.getMood() > 78;

    ctx.save();
    ctx.translate(j.x, j.y);

    // 별빛 단계 아우라
    if (stage.index >= 4) {
      const g = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 2.1);
      g.addColorStop(0, "rgba(255,217,122,0.28)");
      g.addColorStop(1, "rgba(255,217,122,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, size * 2.1, 0, TAU);
      ctx.fill();
    }

    ctx.rotate(dir * Math.min(1, spd / 500) * 0.25);
    ctx.scale(squash, 1 / squash);

    // 글로우
    ctx.shadowColor = stage.glowColor;
    ctx.shadowBlur = 22;

    // 몸통
    const body = ctx.createRadialGradient(-size * 0.3, -size * 0.35, size * 0.2, 0, 0, size * 1.15);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.25, stage.bodyColor);
    body.addColorStop(1, this.shade(stage.bodyColor, -35));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 청소부 링 (3단계+)
    if (stage.index >= 2) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.15, size * 1.35, size * 0.42, -0.25, 0, TAU);
      ctx.stroke();
    }
    // 수호자 실드 (4단계+)
    if (stage.index >= 3) {
      ctx.strokeStyle = "rgba(195,155,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.5, -0.9, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.5, Math.PI - 0.9, Math.PI + 0.5);
      ctx.stroke();
    }

    ctx.rotate(-dir * Math.min(1, spd / 500) * 0.25);

    // 안테나 (교신 중이면 초록 펄스)
    const comm = this.hooks.isComm();
    ctx.strokeStyle = this.shade(stage.bodyColor, -25);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.92);
    ctx.quadraticCurveTo(size * 0.15, -size * 1.35, 0, -size * 1.5);
    ctx.stroke();
    const pulse = comm ? 0.6 + 0.4 * Math.sin(this.time * 6) : 0.35;
    ctx.fillStyle = comm ? `rgba(74,222,128,${pulse})` : "rgba(148,163,184,0.6)";
    ctx.beginPath();
    ctx.arc(0, -size * 1.55, comm ? 5 : 4, 0, TAU);
    ctx.fill();

    // 새싹 (2단계+)
    if (stage.index >= 1) {
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.ellipse(-size * 0.28, -size * 1.12, size * 0.22, size * 0.12, -0.7, 0, TAU);
      ctx.fill();
    }
    // 별 왕관 (5단계)
    if (stage.index >= 4) {
      ctx.fillStyle = "#ffd97a";
      this.star(ctx, size * 0.42, -size * 1.1, 7, 5);
    }

    // 눈
    const eyeY = -size * 0.15;
    const eyeDX = size * 0.38;
    const lookX = spd > 20 ? (j.vx / (spd || 1)) * size * 0.1 : 0;
    const lookY = spd > 20 ? (j.vy / (spd || 1)) * size * 0.1 : 0;
    for (const sx of [-1, 1]) {
      if (hurt) {
        // >< 눈
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        const ex = sx * eyeDX;
        ctx.beginPath();
        ctx.moveTo(ex - 5, eyeY - 5);
        ctx.lineTo(ex + 5, eyeY + 5);
        ctx.moveTo(ex + 5, eyeY - 5);
        ctx.lineTo(ex - 5, eyeY + 5);
        ctx.stroke();
      } else if (j.blinking > 0) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx * eyeDX - 6, eyeY);
        ctx.lineTo(sx * eyeDX + 6, eyeY);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(sx * eyeDX, eyeY, size * 0.26, size * 0.3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(sx * eyeDX + lookX, eyeY + lookY, size * 0.13, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sx * eyeDX + lookX - 2, eyeY + lookY - 2, size * 0.045, 0, TAU);
        ctx.fill();
      }
      // 슬픈 눈썹
      if (sad && !hurt) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx * eyeDX - sx * 7, eyeY - size * 0.42);
        ctx.lineTo(sx * eyeDX + sx * 5, eyeY - size * 0.3);
        ctx.stroke();
      }
    }

    // 볼터치
    if (happy && !hurt) {
      ctx.fillStyle = "rgba(251,113,133,0.5)";
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * size * 0.62, size * 0.12, size * 0.14, size * 0.09, 0, 0, TAU);
        ctx.fill();
      }
    }

    // 입: 근처에 먹을 게 있으면 크게 벌림
    const prey = this.nearestEdible(stage.maxTier + (j.dashT > 0 ? 1 : 0));
    const preyNear =
      prey && Math.hypot(prey.x - j.x, prey.y - j.y) < 130 && !hurt;
    ctx.fillStyle = "#0f172a";
    if (preyNear) {
      ctx.beginPath();
      ctx.arc(0, size * 0.35, size * 0.24, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.arc(0, size * 0.42, size * 0.11, 0, TAU);
      ctx.fill();
    } else if (sad && !happy) {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, size * 0.55, size * 0.18, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, size * 0.28, size * 0.18, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawDebris(d: Debris): void {
    const ctx = this.ctx;
    const def = DEBRIS_TIERS[d.tier - 1];
    const scale = d.eating !== null ? Math.max(0, 1 - d.eating) : 1;
    if (scale <= 0) return;

    // SVG 아트 스프라이트 (로드 전이면 벡터 폴백)
    const img = this.sprites.debris[d.tier - 1];
    if (img) {
      const s = Math.max(26, def.radius * 3.4) * scale;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot * 0.6);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(scale, scale);
    const r = def.radius;

    switch (d.tier) {
      case 1: {
        ctx.fillStyle = "#cbd5e1";
        for (let i = 0; i < 3; i++) {
          const a = d.seed * 7 + (i * TAU) / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 3.5, Math.sin(a) * 3.5, 1.8, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 2: {
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, TAU);
        ctx.fill();
        break;
      }
      case 3: {
        // 태양전지판 파편
        ctx.fillStyle = "#1e3a8a";
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.6);
        ctx.lineTo(r * 0.9, -r * 0.75);
        ctx.lineTo(r * 0.6, r * 0.7);
        ctx.lineTo(-r * 0.75, r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(i * r * 0.4, -r * 0.7);
          ctx.lineTo(i * r * 0.4, r * 0.6);
        }
        ctx.stroke();
        break;
      }
      case 4: {
        // 로켓 노즐 잔해
        ctx.fillStyle = "#78716c";
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r);
        ctx.lineTo(r * 0.5, -r);
        ctx.lineTo(r * 0.95, r * 0.8);
        ctx.lineTo(-r * 0.95, r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#44403c";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.8, r * 0.95, r * 0.28, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#a8a29e";
        ctx.fillRect(-r * 0.5, -r * 1.15, r, r * 0.2);
        break;
      }
      default: {
        // 폐위성
        ctx.fillStyle = "#64748b";
        ctx.fillRect(-r * 0.42, -r * 0.42, r * 0.84, r * 0.84);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-r * 1.5, -r * 0.22, r * 0.95, r * 0.44);
        ctx.fillRect(r * 0.55, -r * 0.22, r * 0.95, r * 0.44);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r * 0.42, -r * 0.42, r * 0.84, r * 0.84);
        // 죽은 X 눈
        ctx.strokeStyle = "#f1f5f9";
        ctx.beginPath();
        for (const sx of [-1, 1]) {
          ctx.moveTo(sx * r * 0.18 - 3, -3);
          ctx.lineTo(sx * r * 0.18 + 3, 3);
          ctx.moveTo(sx * r * 0.18 + 3, -3);
          ctx.lineTo(sx * r * 0.18 - 3, 3);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawSatellite(s: Satellite): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-0.18);
    // 본체
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(-13, -10, 26, 20);
    // 금색 패널 (살아있는 위성)
    ctx.fillStyle = "#b45309";
    ctx.fillRect(-46, -7, 28, 14);
    ctx.fillRect(18, -7, 28, 14);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.strokeRect(-46, -7, 28, 14);
    ctx.strokeRect(18, -7, 28, 14);
    // 접시 안테나
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(0, -14, 6, Math.PI, 0);
    ctx.fill();
    // 깜빡이는 경고등
    if (Math.floor(s.blink * 2.5) % 2 === 0) {
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private drawFriend(f: Friend): void {
    const img = this.sprites.friends[f.hue > 300 ? 0 : 1];
    if (!img) {
      this.drawFriendVector(f);
      return;
    }
    const ctx = this.ctx;
    const W = 62 * (f.met ? 1 + 0.08 * Math.sin(f.metT * 9) : 1);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.sin(f.wobble * 1.6) * 0.12);
    ctx.drawImage(img, -W / 2, -W / 2, W, W);
    ctx.restore();
    // 조우 중엔 머리 위 하트
    if (f.met) {
      const bob = Math.sin(f.metT * 6) * 3;
      ctx.save();
      ctx.translate(f.x, f.y - W * 0.62 + bob);
      ctx.scale(1.4, 1.4);
      ctx.fillStyle = "#fda4af";
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-6, -3, -3, -8, 0, -4);
      ctx.bezierCurveTo(3, -8, 6, -3, 0, 3);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 폴백: 코드 드로잉 버전 */
  private drawFriendVector(f: Friend): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(f.x, f.y);
    const r = 18;
    ctx.shadowColor = `hsl(${f.hue} 80% 70%)`;
    ctx.shadowBlur = 16;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 1.1);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, `hsl(${f.hue} 85% 78%)`);
    g.addColorStop(1, `hsl(${f.hue} 70% 55%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 눈 (만나면 ^^)
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    if (f.met) {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * 7, -3, 4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      // 손 흔들기
      const wave = Math.sin(f.metT * 10) * 0.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.8, -2);
      ctx.quadraticCurveTo(r * 1.3, -8 + wave * 8, r * 1.5, -14 + wave * 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#0f172a";
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * 7, -3, 2.6, 0, TAU);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 5, 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  private drawItem(it: Item): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(it.x, it.y);
    const pulse = 0.75 + 0.25 * Math.sin(it.pulse * 5);
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 24 * pulse;
    ctx.fillStyle = "#fde68a";
    this.star(ctx, 0, 0, 13 * pulse, 5);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(251,191,36,${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(it.pulse * 3) * 4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === "heart") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.size / 10, p.size / 10);
        ctx.globalAlpha = Math.min(1, a * 1.4);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.bezierCurveTo(-6, -3, -3, -8, 0, -4);
        ctx.bezierCurveTo(3, -8, 6, -3, 0, 3);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === "flame" ? a : 1), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawFloaters(): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.font = "bold 14px system-ui, sans-serif";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  private star(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    points: number,
  ): void {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }
}
