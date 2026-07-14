// 플레이 화면 아케이드 엔진.
// WebGL 지구 위에 겹친 투명 2D 캔버스에 줍스·쓰레기·위성·파티클을 그린다.
// 게임 규칙(먹기/충돌/조우/아이템)은 JoopsStore에 위임하고 여기서는 연출과 물리를 담당한다.

import { DEBRIS_TIERS, type StageDef } from "./constants";
import { drawJoops, type JoopsMood } from "./joopsSprite";
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
  rot: number;
  vr: number;
  r: number;
  seed: number;
};

type Satellite = { x: number; y: number; vx: number; tilt: number };
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
      d.rot += d.vr * dt;

      const hitDist = d.r + size * 0.85;
      if (!info.exhausted && Math.hypot(j.x - d.x, j.y - d.y) < hitDist) {
        if (edible) {
          const gained = this.store.eatDebris(d.tier);
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
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.6, 1.6),
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
      tilt: rand(-0.25, 0.25),
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

    // 우주 먼지 스트릭
    ctx.strokeStyle = "rgba(190,215,255,0.12)";
    ctx.lineWidth = 1;
    for (const d of this.dust) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len, d.y);
      ctx.stroke();
    }

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
    drawJoops(ctx, j.x, j.y + Math.sin(now / 620) * 3, info.stage.size, info.stageIndex, now, {
      mood,
      dirX: j.dirX,
      dirY: j.dirY,
      thrust: moving && !info.exhausted,
      alpha: blink,
    });

    // 파티클
    for (const p of this.parts) {
      const q = 1 - p.life / p.ttl;
      if (p.kind === "spark") {
        ctx.globalAlpha = q;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * q + 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "puff") {
        ctx.globalAlpha = q * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - q * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "ring") {
        ctx.globalAlpha = q;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - q) * 34, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // heart
        ctx.globalAlpha = Math.min(1, q * 1.4);
        this.drawHeart(ctx, p.x, p.y, p.size, p.color);
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
    ctx.save();
    ctx.translate(d.x, d.y);

    // 처리 가능 여부 링
    ctx.beginPath();
    ctx.arc(0, 0, d.r + 5, 0, Math.PI * 2);
    if (edible) {
      ctx.strokeStyle = "rgba(125,232,216,0.35)";
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = `rgba(255,110,110,${0.3 + 0.18 * Math.sin(now / 250 + d.seed)})`;
      ctx.setLineDash([4, 4]);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(d.rot);
    if (d.tier === 1) {
      // 페인트 조각 — 작은 파편 무리
      ctx.fillStyle = "#cdd8e6";
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9fb0c4";
      ctx.beginPath();
      ctx.arc(d.r * 0.6, d.r * 0.3, d.r * 0.3, 0, Math.PI * 2);
      ctx.arc(-d.r * 0.5, -d.r * 0.4, d.r * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.tier === 2) {
      // 볼트·너트 — 육각형
      ctx.fillStyle = "#aab8ca";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * d.r;
        const py = Math.sin(a) * d.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#5d6b7d";
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.tier === 3) {
      // 태양전지판 파편
      ctx.fillStyle = "#3d6fb4";
      ctx.fillRect(-d.r, -d.r * 0.62, d.r * 2, d.r * 1.24);
      ctx.strokeStyle = "rgba(190,220,255,0.55)";
      ctx.lineWidth = 1;
      for (let gx = -d.r; gx <= d.r; gx += d.r * 0.5) {
        ctx.beginPath();
        ctx.moveTo(gx, -d.r * 0.62);
        ctx.lineTo(gx, d.r * 0.62);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-d.r, 0);
      ctx.lineTo(d.r, 0);
      ctx.stroke();
    } else if (d.tier === 4) {
      // 로켓 잔해 — 노즐
      ctx.fillStyle = "#cfc0a2";
      ctx.beginPath();
      ctx.moveTo(-d.r * 0.9, -d.r * 0.5);
      ctx.lineTo(d.r * 0.35, -d.r * 0.95);
      ctx.lineTo(d.r * 0.35, d.r * 0.95);
      ctx.lineTo(-d.r * 0.9, d.r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8d8065";
      ctx.beginPath();
      ctx.ellipse(d.r * 0.38, 0, d.r * 0.22, d.r * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 폐위성
      ctx.fillStyle = "#77839a";
      ctx.fillRect(-d.r * 0.5, -d.r * 0.42, d.r, d.r * 0.84);
      ctx.fillStyle = "#2f4b78";
      ctx.fillRect(-d.r * 1.15, -d.r * 0.2, d.r * 0.6, d.r * 0.4);
      ctx.save();
      ctx.translate(d.r * 0.5, 0);
      ctx.rotate(0.5);
      ctx.fillRect(0, -d.r * 0.18, d.r * 0.62, d.r * 0.36);
      ctx.restore();
      ctx.strokeStyle = "#aab6c8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -d.r * 0.42);
      ctx.lineTo(0, -d.r * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSatellite(ctx: CanvasRenderingContext2D, s: Satellite, now: number): void {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.tilt);
    // 태양전지판
    ctx.fillStyle = "#2c5b9e";
    ctx.fillRect(-46, -7, 30, 14);
    ctx.fillRect(16, -7, 30, 14);
    ctx.strokeStyle = "rgba(180,215,255,0.5)";
    ctx.lineWidth = 1;
    for (const gx of [-40, -32, -24, 22, 30, 38]) {
      ctx.beginPath();
      ctx.moveTo(gx, -7);
      ctx.lineTo(gx, 7);
      ctx.stroke();
    }
    // 본체 (금박)
    ctx.fillStyle = "#d8b45a";
    ctx.fillRect(-14, -11, 28, 22);
    ctx.fillStyle = "#b3903f";
    ctx.fillRect(-14, -11, 28, 5);
    // 안테나 접시
    ctx.fillStyle = "#e8eef6";
    ctx.beginPath();
    ctx.arc(0, -16, 6, Math.PI, 0);
    ctx.fill();
    // 경고 점멸등
    const blink = 0.5 + 0.5 * Math.sin(now / 180);
    ctx.fillStyle = `rgba(255,80,80,${0.35 + 0.6 * blink})`;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    glow.addColorStop(0, `rgba(255,90,90,${0.3 * blink})`);
    glow.addColorStop(1, "rgba(255,90,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCapsule(ctx: CanvasRenderingContext2D, c: Capsule, now: number): void {
    ctx.save();
    ctx.translate(c.x, c.y + Math.sin(now / 420 + c.phase) * 5);
    const pulse = 0.6 + 0.4 * Math.sin(now / 300);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, `rgba(130,215,255,${0.5 * pulse})`);
    glow.addColorStop(1, "rgba(130,215,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    // 지구 모양 코어
    const core = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
    core.addColorStop(0, "#bfe8ff");
    core.addColorStop(0.5, "#4da3e8");
    core.addColorStop(1, "#1c4f8f");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,245,255,0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(now / 900);
    ctx.strokeStyle = `rgba(160,225,255,${0.7 * pulse})`;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 14, s / 14);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-7, -3, -4.5, -9, 0, -4.5);
    ctx.bezierCurveTo(4.5, -9, 7, -3, 0, 4);
    ctx.fill();
    ctx.restore();
  }
}
