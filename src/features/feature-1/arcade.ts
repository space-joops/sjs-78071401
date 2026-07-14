// 플레이 화면 아케이드 엔진.
// WebGL 지구 위에 겹친 투명 2D 캔버스에 줍스·쓰레기·위성·파티클을 그린다.
// 게임 규칙(먹기/충돌/조우/아이템)은 JoopsStore에 위임하고 여기서는 연출과 물리를 담당한다.

import { DEBRIS_TIERS, type StageDef } from "./constants";
import { drawJoops, type JoopsMood } from "./joopsSprite";
import {
  CAPSULE_FRAMES,
  DEBRIS_GRIDS,
  drawSprite,
  HEART,
  ORBIT_DASH,
  SAT_FRAMES,
} from "./pixel/sprites";
import type { JoopsStore } from "./store";

export type ArcadeToast = { text: string; tone: "good" | "bad" | "info" };

export type FrameInfo = {
  stage: StageDef;
  stageIndex: number;
  /** 체력 고갈 → 입력·스폰 정지, 줍스는 힘없이 표류 */
  exhausted: boolean;
  /** 교신 중 (XP 2배 연출) */
  commActive: boolean;
  energy: number;
};

type Debris = {
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  seed: number;
};

type Satellite = { x: number; y: number; vx: number };
type Friend = { x: number; y: number; vx: number; baseY: number; amp: number; phase: number; met: boolean };
type Capsule = { x: number; y: number; vx: number; phase: number };

type Particle = {
  kind: "spark" | "heart" | "ring" | "puff";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
};

type FloatText = { x: number; y: number; life: number; ttl: number; text: string; color: string; size: number };
type Dust = { x: number; y: number; len: number; v: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Arcade {
  private ctx: CanvasRenderingContext2D | null;
  private W = 0;
  private H = 0;

  private joops = { x: 0, y: 0, tx: 0, ty: 0, dirX: 0, dirY: 0 };
  private debris: Debris[] = [];
  private sats: Satellite[] = [];
  private friend: Friend | null = null;
  private capsule: Capsule | null = null;
  private parts: Particle[] = [];
  private texts: FloatText[] = [];
  private dust: Dust[] = [];

  private nextDebrisAt = 0;
  private nextSatAt = 0;
  private nextFriendAt = 0;
  private nextCapsuleAt = 0;
  private nextThrustPuffAt = 0;
  private lastSatToastAt = 0;
  private invulnUntil = 0;
  private chompUntil = 0;
  private shake = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: JoopsStore,
    private onToast: (t: ArcadeToast) => void,
  ) {
    this.ctx = canvas.getContext("2d");
  }

  resize(cssW: number, cssH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.joops.x === 0 && this.joops.y === 0) {
      this.joops.x = this.joops.tx = cssW * 0.4;
      this.joops.y = this.joops.ty = cssH * 0.38;
    }
    if (this.dust.length === 0) {
      for (let i = 0; i < 10; i++) {
        this.dust.push({ x: rand(0, cssW), y: rand(0, cssH * 0.85), len: rand(10, 34), v: rand(140, 300) });
      }
    }
  }

  setTarget(x: number, y: number): void {
    this.joops.tx = Math.max(14, Math.min(this.W - 14, x));
    this.joops.ty = Math.max(14, Math.min(this.H - 20, y));
  }

  /** 매 프레임: 물리 갱신 + 그리기 */
  frame(nowMs: number, dtMs: number, info: FrameInfo): void {
    const ctx = this.ctx;
    if (!ctx || this.W === 0) return;
    const dt = Math.min(0.05, dtMs / 1000);
    this.step(nowMs, dt, info);
    this.draw(ctx, nowMs, info);
  }

  // ---- 시뮬레이션 ----

  private step(now: number, dt: number, info: FrameInfo): void {
    const j = this.joops;
    const size = info.stage.size;

    if (info.exhausted) {
      // 기진맥진 — 아래로 힘없이 표류
      j.ty = Math.min(this.H * 0.62, j.ty + 12 * dt);
      j.tx += Math.sin(now / 900) * 6 * dt;
    }

    // 줍스 이동 (에너지가 낮으면 굼떠진다)
    const vigor = info.exhausted ? 0.25 : 0.45 + info.energy / 130;
    const k = 1 - Math.exp(-dt * 4.2 * vigor);
    const dx = j.tx - j.x;
    const dy = j.ty - j.y;
    j.x += dx * k;
    j.y += dy * k;
    j.dirX += (Math.max(-1, Math.min(1, dx / 70)) - j.dirX) * Math.min(1, dt * 6);
    j.dirY += (Math.max(-1, Math.min(1, dy / 70)) - j.dirY) * Math.min(1, dt * 6);

    // 스폰
    if (!info.exhausted) {
      if (now >= this.nextDebrisAt) {
        this.spawnDebris(info);
        this.nextDebrisAt = now + rand(620, 1150);
      }
      if (now >= this.nextSatAt) {
        this.spawnSatellite();
        this.nextSatAt = now + rand(9000, 16000);
      }
      if (!this.friend && now >= this.nextFriendAt) {
        this.spawnFriend();
        this.nextFriendAt = now + rand(45000, 85000);
      }
      if (!this.capsule && now >= this.nextCapsuleAt) {
        this.capsule = { x: this.W + 30, y: rand(this.H * 0.12, this.H * 0.55), vx: -rand(40, 60), phase: rand(0, 9) };
        this.nextCapsuleAt = now + rand(55000, 100000);
      }
    }

    // 쓰레기 이동 + 자석 + 충돌
    const magR = size * 3.4;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      const edible = d.tier <= info.stage.maxTier;
      if (edible && !info.exhausted) {
        const ddx = j.x - d.x;
        const ddy = j.y - d.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist < magR && dist > 1) {
          const pull = (1 - dist / magR) * 560 * dt;
          d.vx += (ddx / dist) * pull;
          d.vy += (ddy / dist) * pull;
        }
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      const hitDist = d.r + size * 0.85;
      if (!info.exhausted && Math.hypot(j.x - d.x, j.y - d.y) < hitDist) {
        if (edible) {
          const gained = this.store.eatDebris(d.tier);
          this.chompUntil = now + 240; // 꿀꺽 — 깨물기 프레임 + 몸 팽창 팝
          this.burstEat(d.x, d.y, info.commActive);
          this.texts.push({
            x: d.x,
            y: d.y - d.r,
            life: 0,
            ttl: 1.1,
            text: `+${gained}`,
            color: info.commActive ? "#ffd97a" : "#8ff0df",
            size: info.commActive ? 17 : 14,
          });
          this.debris.splice(i, 1);
          continue;
        } else if (now > this.invulnUntil) {
          this.store.collide(8);
          this.invulnUntil = now + 1500;
          this.shake = 11;
          d.vx = Math.abs(d.vx) * 0.7 * Math.sign(d.x - j.x || 1);
          d.vy += Math.sign(d.y - j.y) * 40;
          this.burstHit(j.x, j.y);
          this.texts.push({ x: j.x, y: j.y - size - 8, life: 0, ttl: 1.2, text: "아직 못 먹어요! -8", color: "#ff9a9a", size: 13 });
        }
      }
      if (d.x < -90 || d.y < -90 || d.y > this.H + 90) this.debris.splice(i, 1);
    }

    // 운용 위성
    for (let i = this.sats.length - 1; i >= 0; i--) {
      const s = this.sats[i];
      s.x += s.vx * dt;
      if (!info.exhausted && now > this.invulnUntil && Math.hypot(j.x - s.x, j.y - s.y) < 30 + size * 0.85) {
        this.store.collide(14);
        this.invulnUntil = now + 1800;
        this.shake = 16;
        this.burstHit(j.x, j.y);
        this.texts.push({ x: j.x, y: j.y - size - 8, life: 0, ttl: 1.4, text: "위성 충돌! -14", color: "#ff8080", size: 15 });
        if (now - this.lastSatToastAt > 6000) {
          this.lastSatToastAt = now;
          this.onToast({ text: "운용 중인 위성이에요! 피해 다니세요 🛰️", tone: "bad" });
        }
      }
      if (s.x < -120 || s.x > this.W + 120) this.sats.splice(i, 1);
    }

    // 떠돌이 줍스
    if (this.friend) {
      const f = this.friend;
      f.x += f.vx * dt * (f.met ? 2.4 : 1);
      f.y = f.baseY + Math.sin(now / 700 + f.phase) * f.amp - (f.met ? (now / 1000) % 1 : 0) * 0;
      if (f.met && Math.random() < dt * 8) {
        this.parts.push({
          kind: "heart",
          x: f.x + rand(-8, 8),
          y: f.y - 10,
          vx: rand(-12, 12),
          vy: -rand(20, 44),
          life: 0,
          ttl: 1.2,
          size: rand(9, 13),
          color: "#ff9ac4",
        });
      }
      if (!info.exhausted && !f.met && Math.hypot(j.x - f.x, j.y - f.y) < size + info.stage.size) {
        f.met = true;
        f.vx = (f.vx > 0 ? 1 : -1) * Math.abs(f.vx);
        const gained = this.store.encounter();
        this.burstHearts(f.x, f.y);
        this.texts.push({ x: f.x, y: f.y - 26, life: 0, ttl: 1.6, text: `친구! +${gained}`, color: "#ffb3d4", size: 17 });
        this.onToast({ text: `떠돌이 줍스를 만났어요! 💚 +${gained} XP`, tone: "good" });
      }
      if (f.x < -140 || f.x > this.W + 140) this.friend = null;
    }

    // 글로벌 링크 캡슐
    if (this.capsule) {
      const c = this.capsule;
      c.x += c.vx * dt;
      c.y += Math.sin(now / 500 + c.phase) * 14 * dt;
      if (!info.exhausted && Math.hypot(j.x - c.x, j.y - c.y) < 18 + size * 0.85) {
        this.store.pickGlobalItem();
        this.burstRing(c.x, c.y, "#7fd4ff");
        this.onToast({ text: "글로벌 링크 코어 획득! 10분간 전 지구 교신 🌐", tone: "good" });
        this.capsule = null;
      } else if (c.x < -60) {
        this.capsule = null;
      }
    }

    // 추진 파티클
    const moving = Math.hypot(j.tx - j.x, j.ty - j.y) > 9;
    if (moving && !info.exhausted && now >= this.nextThrustPuffAt) {
      this.nextThrustPuffAt = now + 46;
      this.parts.push({
        kind: "puff",
        x: j.x - j.dirX * size * 1.1,
        y: j.y - j.dirY * size * 0.5 + size * 0.4,
        vx: -j.dirX * rand(30, 70),
        vy: -j.dirY * rand(20, 40) + rand(4, 18),
        life: 0,
        ttl: 0.55,
        size: rand(2.5, 5),
        color: "#9fdcff",
      });
    }

    // 파티클 · 텍스트 수명
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "heart") p.vy -= 26 * dt;
      if (p.life >= p.ttl) this.parts.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y -= 26 * dt;
      if (t.life >= t.ttl) this.texts.splice(i, 1);
    }

    // 우주 먼지 (속도감)
    for (const d of this.dust) {
      d.x -= d.v * dt;
      if (d.x < -d.len) {
        d.x = this.W + rand(0, 60);
        d.y = rand(0, this.H * 0.85);
      }
    }

    this.shake *= Math.exp(-dt * 4.5);
  }

  private spawnDebris(info: FrameInfo): void {
    const maxSpawnTier = Math.min(5, info.stage.maxTier + (Math.random() < 0.3 ? 2 : 1));
    const pool = DEBRIS_TIERS.filter((d) => d.tier <= maxSpawnTier);
    const total = pool.reduce((s, d) => s + d.weight, 0);
    let roll = Math.random() * total;
    let def = pool[0];
    for (const d of pool) {
      roll -= d.weight;
      if (roll <= 0) {
        def = d;
        break;
      }
    }
    this.debris.push({
      tier: def.tier,
      x: this.W + def.radius + 16,
      y: rand(this.H * 0.05, this.H * 0.75),
      vx: -rand(52, 120) - info.stageIndex * 9,
      vy: rand(-14, 14),
      r: def.radius,
      seed: Math.random() * 9,
    });
  }

  private spawnSatellite(): void {
    const fromLeft = Math.random() < 0.5;
    this.sats.push({
      x: fromLeft ? -100 : this.W + 100,
      y: rand(this.H * 0.08, this.H * 0.55),
      vx: (fromLeft ? 1 : -1) * rand(70, 115),
    });
  }

  private spawnFriend(): void {
    const fromLeft = Math.random() < 0.5;
    this.friend = {
      x: fromLeft ? -110 : this.W + 110,
      y: 0,
      vx: (fromLeft ? 1 : -1) * rand(46, 72),
      baseY: rand(this.H * 0.15, this.H * 0.55),
      amp: rand(14, 34),
      phase: rand(0, 9),
      met: false,
    };
  }

  // ---- 이펙트 ----

  private burstEat(x: number, y: number, comm: boolean): void {
    const color = comm ? "#ffd97a" : "#7de8d8";
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(40, 130);
      this.parts.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, ttl: rand(0.35, 0.6), size: rand(1.5, 3.2), color });
    }
    this.parts.push({ kind: "ring", x, y, vx: 0, vy: 0, life: 0, ttl: 0.4, size: 6, color });
  }

  private burstHit(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(50, 150);
      this.parts.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, ttl: rand(0.3, 0.55), size: rand(1.5, 3), color: "#ff9a86" });
    }
    this.parts.push({ kind: "ring", x, y, vx: 0, vy: 0, life: 0, ttl: 0.45, size: 8, color: "#ff8f7a" });
  }

  private burstHearts(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const a = rand(-Math.PI, 0);
      const v = rand(26, 90);
      this.parts.push({
        kind: "heart",
        x: x + rand(-10, 10),
        y: y + rand(-8, 8),
        vx: Math.cos(a) * v * 0.6,
        vy: Math.sin(a) * v,
        life: 0,
        ttl: rand(1, 1.7),
        size: rand(9, 16),
        color: i % 2 ? "#ff9ac4" : "#9df0c8",
      });
    }
    this.parts.push({ kind: "ring", x, y, vx: 0, vy: 0, life: 0, ttl: 0.55, size: 10, color: "#ffb3d4" });
  }

  private burstRing(x: number, y: number, color: string): void {
    this.parts.push({ kind: "ring", x, y, vx: 0, vy: 0, life: 0, ttl: 0.6, size: 10, color });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.parts.push({ kind: "spark", x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0, ttl: 0.5, size: 2.4, color });
    }
  }

  // ---- 그리기 ----

  private draw(ctx: CanvasRenderingContext2D, now: number, info: FrameInfo): void {
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save();
    if (this.shake > 0.4) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    // 우주 먼지 스트릭 (칩힌 픽셀 라인)
    ctx.fillStyle = "rgba(190,215,255,0.13)";
    for (const d of this.dust) {
      ctx.fillRect(d.x, d.y, d.len, 2);
    }

    // 레트로 궤도 점선 — 줍스의 순항 고도를 지나는 HUD 라인
    const dashTile = 32;
    const dashOff = (now * 0.045) % dashTile;
    ctx.globalAlpha = 0.32;
    for (let tx = -dashTile; tx < this.W + dashTile; tx += dashTile) {
      drawSprite(ctx, ORBIT_DASH, tx - dashOff, this.H * 0.4 - 16, 2);
    }
    ctx.globalAlpha = 1;

    for (const d of this.debris) this.drawDebris(ctx, d, d.tier <= info.stage.maxTier, now);
    for (const s of this.sats) this.drawSatellite(ctx, s, now);
    if (this.capsule) this.drawCapsule(ctx, this.capsule, now);

    if (this.friend) {
      const f = this.friend;
      drawJoops(ctx, f.x, f.y, 18, 1, now, {
        variant: "friend",
        mood: "happy",
        dirX: Math.sign(f.vx) * 0.5,
        thrust: true,
      });
      ctx.font = "10px var(--font-geist-mono), monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,178,212,0.85)";
      ctx.fillText("떠돌이 줍스", f.x, f.y - 34);
      ctx.textAlign = "left";
    }

    // 줍스 본체
    const j = this.joops;
    const mood: JoopsMood = info.exhausted ? "hurt" : info.energy < 25 ? "tired" : "happy";
    const blink = now < this.invulnUntil ? 0.55 + 0.45 * Math.sin(now / 55) : 1;
    const moving = Math.hypot(j.tx - j.x, j.ty - j.y) > 9;
    const gulp = Math.max(0, (this.chompUntil - now) / 240); // 꿀꺽 팽창 팝
    drawJoops(
      ctx,
      j.x,
      j.y + Math.sin(now / 620) * 3,
      info.stage.size * (1 + 0.16 * gulp),
      info.stageIndex,
      now,
      {
        mood,
        dirX: j.dirX,
        dirY: j.dirY,
        thrust: moving && !info.exhausted,
        chomp: gulp > 0,
        alpha: blink,
      },
    );

    // 파티클
    for (const p of this.parts) {
      const q = 1 - p.life / p.ttl;
      if (p.kind === "spark") {
        ctx.globalAlpha = q;
        ctx.fillStyle = p.color;
        const s = Math.max(1.5, p.size * (0.6 + q));
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === "puff") {
        ctx.globalAlpha = q * 0.5;
        ctx.fillStyle = p.color;
        const s = p.size * (1.8 - q * 0.6);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === "ring") {
        ctx.globalAlpha = q;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        const rr = p.size + (1 - q) * 34;
        ctx.strokeRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
      } else {
        // heart — 픽셀 하트 스프라이트 (F 인덱스를 파티클 색으로 리맵)
        ctx.globalAlpha = Math.min(1, q * 1.4);
        const hs = p.size / 9;
        drawSprite(ctx, HEART, p.x - 6.5 * hs, p.y - 7.5 * hs, hs, { 7: p.color });
      }
    }
    ctx.globalAlpha = 1;

    // 플로팅 텍스트
    ctx.textAlign = "center";
    for (const t of this.texts) {
      const q = 1 - t.life / t.ttl;
      ctx.globalAlpha = Math.min(1, q * 1.6);
      ctx.font = `700 ${t.size}px var(--font-geist-mono), monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(6,12,26,0.75)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawDebris(ctx: CanvasRenderingContext2D, d: Debris, edible: boolean, now: number): void {
    const scale = 0.9 + d.r / 7;
    const bob = Math.sin(now / 420 + d.seed) * 2;
    drawSprite(ctx, DEBRIS_GRIDS[d.tier - 1], d.x - 8 * scale, d.y - 8 * scale + bob, scale);

    // 처리 가능 여부 — 레트로 타겟 코너 틱
    const half = d.r + 6;
    const t = Math.max(2, Math.round(scale));
    const arm = t * 2;
    ctx.fillStyle = edible
      ? "rgba(125,232,216,0.4)"
      : `rgba(255,110,110,${0.35 + 0.3 * Math.sin(now / 220 + d.seed)})`;
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        const cx = d.x + sx * half;
        const cy = d.y + bob + sy * half;
        ctx.fillRect(sx > 0 ? cx - arm : cx, cy - t / 2, arm, t);
        ctx.fillRect(cx - t / 2, sy > 0 ? cy - arm : cy, t, arm);
      }
    }
  }

  private drawSatellite(ctx: CanvasRenderingContext2D, s: Satellite, now: number): void {
    const lightOn = Math.floor(now / 260) % 2 === 0;
    const frame = lightOn ? SAT_FRAMES[0] : SAT_FRAMES[1];
    drawSprite(ctx, frame, s.x - 21, s.y - 19, 3);
    if (lightOn) {
      // 경고등 잔광 (칩힌 사각 글로우)
      ctx.fillStyle = "rgba(255,80,80,0.18)";
      ctx.fillRect(s.x - 8, s.y + 3, 14, 14);
    }
  }

  private drawCapsule(ctx: CanvasRenderingContext2D, c: Capsule, now: number): void {
    const bobY = c.y + Math.sin(now / 420 + c.phase) * 5;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    ctx.globalAlpha = 0.35 + 0.4 * pulse;
    ctx.strokeStyle = "#7fd4ff";
    ctx.lineWidth = 2;
    const rr = 16 + pulse * 4;
    ctx.strokeRect(c.x - rr, bobY - rr, rr * 2, rr * 2);
    ctx.globalAlpha = 1;
    const frame = CAPSULE_FRAMES[Math.floor(now / 320) % 2];
    drawSprite(ctx, frame, c.x - 15, bobY - 15, 2);
  }
}
