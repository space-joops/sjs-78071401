// 줍줍스2 아케이드 엔진.
//
// v1 대비 핵심 변경:
// 1) 게임 클록(gt) — 모든 스케줄이 벽시계가 아닌 내부 시각을 쓴다. 히트스톱·슬로모로
//    시간을 멈추거나 늦춰도 스폰 타이머가 폭주하지 않고, 백그라운드 복귀 시에도 안전하다.
// 2) 히트스톱 — 충격 순간 step()을 건너뛰고 draw()만 돌려 타격감을 만든다.
// 3) 콤보 체인 — 연속 흡수 배수. 콤보가 오를수록 유지 창이 좁아진다.
// 4) 트라우마 셰이크 — 랜덤 지터가 아닌 제곱 감쇠 + 부드러운 노이즈.
// 5) 스프링 물리 + 상대 드래그 — 손가락이 줍스를 가리지 않고, 관성이 붙는다.
// 6) 니어미스 — 위성을 아슬아슬하게 스치면 슬로모 + 보상.
// 7) 스프라이트 캐시 + 파티클 풀 — 모바일 프레임 예산 확보.

import {
  COMBO,
  DEBRIS_TIERS,
  EVOLVE_SLOWMO,
  HITSTOP_MS,
  NEAR_MISS,
  comboLabelAt,
  comboMultFor,
  comboWindowMs,
  type StageDef,
} from "./constants";
import { getSfx } from "./audio";
import { HAPTIC, vibrate } from "./haptics";
import { drawJoops, type JoopsMood } from "../joopsSprite";
import {
  CAPSULE_FRAMES,
  DEBRIS_GRIDS,
  HEART,
  ORBIT_DASH,
  SAT_FRAMES,
  drawSprite,
} from "../pixel/sprites";
import { baked, drawBaked } from "./spriteCache";
import { makeParticlePool, makeTextPool } from "./pool";
import { PerfWatch, prefersReducedMotion, type Quality } from "./perf";
import type { JoopsStoreV2 } from "./store";

export type ArcadeToast = { text: string; tone: "good" | "bad" | "info" };

export type FrameInfo = {
  stage: StageDef;
  stageIndex: number;
  exhausted: boolean;
  commActive: boolean;
  energy: number;
  sound: boolean;
  haptics: boolean;
  relativeDrag: boolean;
};

/** HUD(React)로 올려보내는 휘발성 상태 — 프레임마다 리렌더하지 않도록 스로틀해서 전달 */
export type ArcadeHud = {
  combo: number;
  comboMult: number;
  comboRatio: number;
  quality: Quality;
  fps: number;
};

type Debris = { alive: boolean; tier: number; x: number; y: number; vx: number; vy: number; r: number; seed: number };
type Satellite = { alive: boolean; x: number; y: number; vx: number; near: boolean };
type Friend = { x: number; y: number; vx: number; baseY: number; amp: number; phase: number; met: boolean };
type Capsule = { x: number; y: number; vx: number; phase: number };
type Dust = { x: number; y: number; len: number; v: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 부드러운 1D value noise — 셰이크용 (랜덤 지터보다 훨씬 고급스럽다) */
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export class ArcadeV2 {
  private ctx: CanvasRenderingContext2D | null;
  private W = 0;
  private H = 0;

  /** 게임 클록 (ms) — 히트스톱/슬로모의 영향을 받는 유일한 시간축 */
  private gt = 0;
  private hitstop = 0;
  private timeScale = 1;
  private slowMoUntil = 0;

  private joops = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, dirX: 0, dirY: 0 };
  private dragging = false;
  private grabX = 0;
  private grabY = 0;

  private debris: Debris[] = [];
  private sats: Satellite[] = [];
  private friend: Friend | null = null;
  private capsule: Capsule | null = null;
  private dust: Dust[] = [];

  private parts = makeParticlePool(288);
  private texts = makeTextPool(24);

  private nextDebrisAt = 0;
  private nextSatAt = 0;
  private nextFriendAt = 0;
  private nextCapsuleAt = 0;
  private nextThrustPuffAt = 0;
  private lastSatToastAt = 0;
  private invulnUntil = 0;
  private chompUntil = 0;

  // 게임필
  private trauma = 0;
  private punch = 0;
  private hurtFlash = 0;
  private impactFlash = 0;
  private combo = 0;
  private comboUntil = 0;
  private comboMult = 1;

  private vignette: CanvasGradient | null = null;
  private perf: PerfWatch;
  private reducedMotion = prefersReducedMotion();
  private sfx = getSfx();

  // fps 표시용
  private fpsAvg = 60;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: JoopsStoreV2,
    private onToast: (t: ArcadeToast) => void,
    quality: Quality,
  ) {
    this.ctx = canvas.getContext("2d");
    this.perf = new PerfWatch(quality);
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
  }

  get quality(): Quality {
    return this.perf.quality;
  }

  get dpr(): number {
    return Math.min(window.devicePixelRatio || 1, this.perf.budget.dpr);
  }

  resize(cssW: number, cssH: number): void {
    const dpr = this.dpr;
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = this.ctx;
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      // 비네트는 매 프레임 만들면 비싸다 — 리사이즈 때 한 번만
      const g = ctx.createRadialGradient(
        cssW / 2,
        cssH / 2,
        Math.min(cssW, cssH) * 0.25,
        cssW / 2,
        cssH / 2,
        Math.max(cssW, cssH) * 0.75,
      );
      g.addColorStop(0, "rgba(255,40,40,0)");
      g.addColorStop(1, "rgba(255,40,40,0.55)");
      this.vignette = g;
    }
    if (this.joops.x === 0 && this.joops.y === 0) {
      this.joops.x = this.joops.tx = cssW * 0.38;
      this.joops.y = this.joops.ty = cssH * 0.42;
    }
    const dustN = this.perf.budget.dust;
    this.dust = Array.from({ length: dustN }, () => ({
      x: rand(0, cssW),
      y: rand(0, cssH * 0.85),
      len: rand(10, 34),
      v: rand(140, 300),
    }));
  }

  // ---- 조작: 상대 드래그 ----
  //
  // v1은 절대좌표라 손가락이 줍스를 가렸다. 여기서는 pointerdown 지점과 줍스의
  // 오프셋을 기억해 이후 델타만 따라간다. 터치라면 손가락 위로 줍스를 띄운다(liftY).

  beginDrag(x: number, y: number, coarse: boolean, relative: boolean): void {
    this.dragging = true;
    if (!relative) {
      this.grabX = 0;
      this.grabY = 0;
      this.setTarget(x, y);
      return;
    }
    const liftY = coarse ? -52 : 0; // 손가락 회피
    let ox = this.joops.x - x;
    let oy = this.joops.y - y + liftY;
    // 너무 멀리서 찍었으면 오프셋을 제한해 조작이 어긋나지 않게 한다
    const max = 110;
    const d = Math.hypot(ox, oy);
    if (d > max) {
      ox = (ox / d) * max;
      oy = (oy / d) * max;
    }
    this.grabX = ox;
    this.grabY = oy;
    this.setTarget(x + ox, y + oy);
  }

  dragTo(x: number, y: number): void {
    if (!this.dragging) return;
    this.setTarget(x + this.grabX, y + this.grabY);
  }

  endDrag(): void {
    this.dragging = false;
  }

  private setTarget(x: number, y: number): void {
    // 하단은 엄지가 가리므로 여유를 더 준다
    this.joops.tx = clamp(x, 18, this.W - 18);
    this.joops.ty = clamp(y, 24, this.H - 28);
  }

  /** 진화 연출용 슬로모 */
  playEvolve(): void {
    this.timeScale = EVOLVE_SLOWMO.scale;
    this.slowMoUntil = this.gt + EVOLVE_SLOWMO.ms;
    this.punch = 0.06;
    this.sfx.evolve();
  }

  hud(): ArcadeHud {
    const win = comboWindowMs(this.combo);
    return {
      combo: this.combo,
      comboMult: this.comboMult,
      comboRatio: this.combo > 0 ? clamp((this.comboUntil - this.gt) / win, 0, 1) : 0,
      quality: this.perf.quality,
      fps: Math.round(this.fpsAvg),
    };
  }

  // ---- 프레임 ----

  frame(dtMsRaw: number, info: FrameInfo): void {
    const ctx = this.ctx;
    if (!ctx || this.W === 0) return;

    const dtMs = Math.min(50, dtMsRaw);
    this.perf.sample(dtMs);
    this.fpsAvg += (1000 / Math.max(1, dtMs) - this.fpsAvg) * 0.05;
    this.sfx.enabled = info.sound;

    // 히트스톱: 시뮬레이션 정지, 렌더는 계속 (프리즈 프레임 + 임팩트 플래시)
    if (this.hitstop > 0) {
      this.hitstop -= dtMs;
      this.draw(ctx, info);
      return;
    }

    if (this.gt > this.slowMoUntil) {
      this.timeScale += (1 - this.timeScale) * Math.min(1, (dtMs / 1000) * 4);
    }

    const dt = Math.min(0.05, (dtMs / 1000) * this.timeScale);
    this.gt += dt * 1000;
    this.step(dt, info);
    this.draw(ctx, info);
  }

  // ---- 시뮬레이션 ----

  private step(dt: number, info: FrameInfo): void {
    const now = this.gt;
    const j = this.joops;
    const size = info.stage.size;

    // 콤보 만료
    if (this.combo > 0 && now > this.comboUntil) this.breakCombo(false);

    if (info.exhausted) {
      j.ty = Math.min(this.H * 0.62, j.ty + 12 * dt);
      j.tx += Math.sin(now / 900) * 6 * dt;
    }

    // 스프링 댐퍼 — 무게감과 관성. v1의 지수 lerp는 관성이 없어 종이인형 같았다.
    const vigor = info.exhausted ? 0.3 : 0.55 + info.energy / 160;
    const STIFF = 34;
    const DAMP = 8.5;
    const ax = (j.tx - j.x) * STIFF - j.vx * DAMP;
    const ay = (j.ty - j.y) * STIFF - j.vy * DAMP;
    j.vx += ax * dt * vigor;
    j.vy += ay * dt * vigor;
    const sp = Math.hypot(j.vx, j.vy);
    const MAX = 620 + info.stageIndex * 40;
    if (sp > MAX) {
      j.vx *= MAX / sp;
      j.vy *= MAX / sp;
    }
    if (!this.dragging) {
      const k = Math.exp(-dt * 2.0); // 손을 떼면 관성으로 미끄러진다
      j.vx *= k;
      j.vy *= k;
    }
    j.x = clamp(j.x + j.vx * dt, 12, this.W - 12);
    j.y = clamp(j.y + j.vy * dt, 16, this.H - 16);
    // 기울기를 속도에서 유도 → 뱅킹이 자연스럽다
    j.dirX += (clamp(j.vx / 300, -1, 1) - j.dirX) * Math.min(1, dt * 8);
    j.dirY += (clamp(j.vy / 300, -1, 1) - j.dirY) * Math.min(1, dt * 8);

    // 스폰 (게임 클록 기준 — 히트스톱 중에는 흐르지 않는다)
    if (!info.exhausted) {
      if (now >= this.nextDebrisAt) {
        this.spawnDebris(info);
        this.nextDebrisAt = now + rand(560, 1080);
      }
      if (now >= this.nextSatAt) {
        this.spawnSatellite();
        this.nextSatAt = now + rand(8000, 14000);
      }
      if (!this.friend && now >= this.nextFriendAt) {
        this.spawnFriend();
        this.nextFriendAt = now + rand(45000, 85000);
      }
      if (!this.capsule && now >= this.nextCapsuleAt) {
        this.capsule = {
          x: this.W + 30,
          y: rand(this.H * 0.12, this.H * 0.55),
          vx: -rand(40, 60),
          phase: rand(0, 9),
        };
        this.nextCapsuleAt = now + rand(55000, 100000);
      }
    }

    this.stepDebris(dt, info);
    this.stepSats(dt, info);
    this.stepFriend(dt, info);
    this.stepCapsule(dt, info);

    // 추진 파티클
    const moving = sp > 40;
    if (moving && !info.exhausted && now >= this.nextThrustPuffAt) {
      this.nextThrustPuffAt = now + 46;
      const p = this.parts.take();
      p.kind = "puff";
      p.x = j.x - j.dirX * size * 1.1;
      p.y = j.y - j.dirY * size * 0.5 + size * 0.4;
      p.vx = -j.vx * 0.25 + rand(-20, 20);
      p.vy = -j.vy * 0.25 + rand(-10, 20);
      p.life = 0;
      p.ttl = 0.55;
      p.size = rand(2.5, 5);
      p.color = "#9fdcff";
    }

    this.stepParticles(dt);

    for (const d of this.dust) {
      d.x -= d.v * dt;
      if (d.x < -d.len) {
        d.x = this.W + rand(0, 60);
        d.y = rand(0, this.H * 0.85);
      }
    }

    // 감쇠
    this.trauma = Math.max(0, this.trauma - dt * 1.1);
    this.punch *= Math.exp(-dt * 9);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    this.impactFlash = Math.max(0, this.impactFlash - dt * 6);
  }

  private stepDebris(dt: number, info: FrameInfo): void {
    const j = this.joops;
    const size = info.stage.size;
    const magR = size * 3.6;

    for (const d of this.debris) {
      if (!d.alive) continue;
      const edible = d.tier <= info.stage.maxTier;
      if (edible && !info.exhausted) {
        const ddx = j.x - d.x;
        const ddy = j.y - d.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist < magR && dist > 1) {
          const pull = (1 - dist / magR) * 620 * dt;
          d.vx += (ddx / dist) * pull;
          d.vy += (ddy / dist) * pull;
        }
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      const hitDist = d.r + size * 0.85;
      if (!info.exhausted && Math.hypot(j.x - d.x, j.y - d.y) < hitDist) {
        if (edible) {
          this.onEat(d, info);
          d.alive = false;
          continue;
        } else if (this.gt > this.invulnUntil) {
          this.onCollide(8, false, info);
          d.vx = Math.abs(d.vx) * 0.7 * Math.sign(d.x - j.x || 1);
          d.vy += Math.sign(d.y - j.y) * 40;
          this.floatText(j.x, j.y - size - 8, "아직 못 먹어요!", "#ff9a9a", 13);
        }
      }
      if (d.x < -90 || d.y < -90 || d.y > this.H + 90) d.alive = false;
    }
  }

  private stepSats(dt: number, info: FrameInfo): void {
    const j = this.joops;
    const size = info.stage.size;
    const now = this.gt;

    for (const s of this.sats) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      const dist = Math.hypot(j.x - s.x, j.y - s.y);
      const hitR = 30 + size * 0.85;

      if (!info.exhausted && now > this.invulnUntil && dist < hitR) {
        this.onCollide(14, true, info);
        this.floatText(j.x, j.y - size - 8, "위성 충돌! -14", "#ff8080", 15);
        if (now - this.lastSatToastAt > 6000) {
          this.lastSatToastAt = now;
          this.onToast({ text: "운용 중인 위성이에요! 피해 다니세요 🛰️", tone: "bad" });
        }
        s.near = true; // 이미 충돌했으므로 니어미스 판정 종료
      } else if (
        !info.exhausted &&
        !s.near &&
        dist < hitR + NEAR_MISS.marginPx &&
        dist >= hitR
      ) {
        // 아슬아슬하게 스침 — 위험 회피가 보상이 된다
        s.near = true;
        const gained = this.store.noteNearMiss(NEAR_MISS.xp);
        this.timeScale = NEAR_MISS.slowMoScale;
        this.slowMoUntil = now + NEAR_MISS.slowMoMs;
        this.floatText(j.x, j.y - size - 14, `NEAR MISS! +${gained}`, "#9ff4ff", 15);
        this.sfx.whoosh();
        vibrate(HAPTIC.nearMiss, info.haptics);
      }

      if (s.x < -120 || s.x > this.W + 120) s.alive = false;
    }
  }

  private stepFriend(dt: number, info: FrameInfo): void {
    const f = this.friend;
    if (!f) return;
    const j = this.joops;
    const now = this.gt;
    f.x += f.vx * dt * (f.met ? 2.4 : 1);
    f.y = f.baseY + Math.sin(now / 700 + f.phase) * f.amp;

    if (f.met && Math.random() < dt * 8) {
      const p = this.parts.take();
      p.kind = "heart";
      p.x = f.x + rand(-8, 8);
      p.y = f.y - 10;
      p.vx = rand(-12, 12);
      p.vy = -rand(20, 44);
      p.life = 0;
      p.ttl = 1.2;
      p.size = rand(9, 13);
      p.color = "#ff9ac4";
    }
    if (!info.exhausted && !f.met && Math.hypot(j.x - f.x, j.y - f.y) < info.stage.size + 18) {
      f.met = true;
      const gained = this.store.encounter();
      this.burstHearts(f.x, f.y);
      this.floatText(f.x, f.y - 26, `친구! +${gained}`, "#ffb3d4", 17);
      this.onToast({ text: `떠돌이 줍스를 만났어요! 💚 +${gained} XP`, tone: "good" });
      this.sfx.pickup();
      vibrate(HAPTIC.pickup, info.haptics);
      this.punch = 0.03;
    }
    if (f.x < -140 || f.x > this.W + 140) this.friend = null;
  }

  private stepCapsule(dt: number, info: FrameInfo): void {
    const c = this.capsule;
    if (!c) return;
    const j = this.joops;
    c.x += c.vx * dt;
    c.y += Math.sin(this.gt / 500 + c.phase) * 14 * dt;
    if (!info.exhausted && Math.hypot(j.x - c.x, j.y - c.y) < 18 + info.stage.size * 0.85) {
      this.store.pickGlobalItem();
      this.burstRing(c.x, c.y, "#7fd4ff");
      this.onToast({ text: "글로벌 링크 코어 획득! 10분간 전 지구 교신 🌐", tone: "good" });
      this.sfx.pickup();
      vibrate(HAPTIC.pickup, info.haptics);
      this.punch = 0.045;
      this.capsule = null;
    } else if (c.x < -60) {
      this.capsule = null;
    }
  }

  private stepParticles(dt: number): void {
    for (const p of this.parts.items) {
      if (!p.alive) continue;
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "heart") p.vy -= 26 * dt;
      if (p.kind === "debrisChunk") p.vy += 40 * dt;
      if (p.life >= p.ttl) p.alive = false;
    }
    for (const t of this.texts.items) {
      if (!t.alive) continue;
      t.life += dt;
      t.y -= 26 * dt;
      if (t.life >= t.ttl) t.alive = false;
    }
  }

  // ---- 게임 이벤트 ----

  private onEat(d: Debris, info: FrameInfo): void {
    // 콤보 갱신
    this.combo += 1;
    this.comboUntil = this.gt + comboWindowMs(this.combo);
    const prevMult = this.comboMult;
    this.comboMult = comboMultFor(this.combo);

    const gained = this.store.eatDebris(d.tier, this.comboMult);
    this.store.noteCombo(this.combo);

    this.chompUntil = this.gt + 240;
    this.hitstop =
      d.tier >= 5 ? HITSTOP_MS.eatBig : d.tier >= 3 ? HITSTOP_MS.eatMid : HITSTOP_MS.eatSmall;
    this.impactFlash = d.tier >= 4 ? 0.1 : 0.05;
    this.punch = 0.02 + d.tier * 0.005;
    if (d.tier >= 5) this.addTrauma(0.15);

    this.burstEat(d.x, d.y, info.commActive, d.tier);
    this.floatText(
      d.x,
      d.y - d.r,
      `+${gained}`,
      info.commActive ? "#ffd97a" : "#8ff0df",
      info.commActive ? 17 : 14,
    );

    this.sfx.eat(d.tier, this.combo);
    vibrate(d.tier >= 4 ? HAPTIC.eatBig : HAPTIC.eatSmall, info.haptics);

    // 콤보 단계 상승 연출
    const label = comboLabelAt(this.combo);
    if (label && this.comboMult > prevMult) {
      this.floatText(this.joops.x, this.joops.y - info.stage.size - 26, label, "#ffe66e", 19);
      this.punch = Math.max(this.punch, 0.05);
      this.sfx.comboUp(COMBO.steps.findIndex((s) => s.n === this.combo));
      vibrate(HAPTIC.comboUp, info.haptics);
    }
  }

  private onCollide(damage: number, heavy: boolean, info: FrameInfo): void {
    this.store.collide(damage);
    this.invulnUntil = this.gt + (heavy ? 1800 : 1500);
    this.hitstop = heavy ? HITSTOP_MS.satellite : HITSTOP_MS.collide;
    this.addTrauma(heavy ? 0.8 : 0.55);
    this.hurtFlash = heavy ? 0.7 : 0.5;
    this.impactFlash = 0.18;
    this.punch = heavy ? 0.07 : 0.05;
    if (heavy) {
      this.timeScale = 0.35;
      this.slowMoUntil = this.gt + 500;
    }
    this.burstHit(this.joops.x, this.joops.y);
    this.breakCombo(true);
    this.sfx.hit(heavy);
    vibrate(HAPTIC.hit, info.haptics);
  }

  private breakCombo(byHit: boolean): void {
    if (this.combo >= 3) {
      this.floatText(
        this.joops.x,
        this.joops.y + 26,
        `체인 끊김 ×${this.combo}`,
        byHit ? "#ff9a9a" : "#9aa8bc",
        13,
      );
      this.sfx.comboBreak();
    }
    this.combo = 0;
    this.comboMult = 1;
  }

  private addTrauma(v: number): void {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + v);
  }

  // ---- 스폰 ----

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
    const slot = this.debris.find((d) => !d.alive);
    const item: Debris = {
      alive: true,
      tier: def.tier,
      x: this.W + def.radius + 16,
      y: rand(this.H * 0.06, this.H * 0.78),
      vx: -rand(52, 120) - info.stageIndex * 9,
      vy: rand(-14, 14),
      r: def.radius,
      seed: Math.random() * 9,
    };
    if (slot) Object.assign(slot, item);
    else this.debris.push(item);
  }

  private spawnSatellite(): void {
    const fromLeft = Math.random() < 0.5;
    const item: Satellite = {
      alive: true,
      x: fromLeft ? -100 : this.W + 100,
      y: rand(this.H * 0.08, this.H * 0.6),
      vx: (fromLeft ? 1 : -1) * rand(70, 115),
      near: false,
    };
    const slot = this.sats.find((s) => !s.alive);
    if (slot) Object.assign(slot, item);
    else this.sats.push(item);
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

  private spark(x: number, y: number, color: string, speed: number, ttl: number, size: number): void {
    const p = this.parts.take();
    const a = rand(0, Math.PI * 2);
    p.kind = "spark";
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.life = 0;
    p.ttl = ttl;
    p.size = size;
    p.color = color;
  }

  private burstEat(x: number, y: number, comm: boolean, tier: number): void {
    const color = comm ? "#ffd97a" : "#7de8d8";
    const n = Math.min(this.perf.budget.particles, 6 + tier * 2);
    for (let i = 0; i < n; i++) this.spark(x, y, color, rand(40, 130), rand(0.35, 0.6), rand(1.5, 3.2));
    this.ring(x, y, color, 6, 0.4);
  }

  private burstHit(x: number, y: number): void {
    for (let i = 0; i < 12; i++) this.spark(x, y, "#ff9a86", rand(50, 170), rand(0.3, 0.55), rand(1.5, 3));
    this.ring(x, y, "#ff8f7a", 8, 0.45);
  }

  private burstHearts(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const p = this.parts.take();
      const a = rand(-Math.PI, 0);
      const v = rand(26, 90);
      p.kind = "heart";
      p.x = x + rand(-10, 10);
      p.y = y + rand(-8, 8);
      p.vx = Math.cos(a) * v * 0.6;
      p.vy = Math.sin(a) * v;
      p.life = 0;
      p.ttl = rand(1, 1.7);
      p.size = rand(9, 16);
      p.color = i % 2 ? "#ff9ac4" : "#9df0c8";
    }
    this.ring(x, y, "#ffb3d4", 10, 0.55);
  }

  private burstRing(x: number, y: number, color: string): void {
    this.ring(x, y, color, 10, 0.6);
    for (let i = 0; i < 8; i++) this.spark(x, y, color, 90, 0.5, 2.4);
  }

  private ring(x: number, y: number, color: string, size: number, ttl: number): void {
    const p = this.parts.take();
    p.kind = "ring";
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = 0;
    p.ttl = ttl;
    p.size = size;
    p.color = color;
  }

  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.texts.take();
    t.x = x;
    t.y = y;
    t.life = 0;
    t.ttl = 1.2;
    t.text = text;
    t.color = color;
    t.size = size;
  }

  // ---- 렌더 ----

  private draw(ctx: CanvasRenderingContext2D, info: FrameInfo): void {
    const now = this.gt;
    const fx = this.perf.budget.effects && !this.reducedMotion;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save();

    // 트라우마 셰이크 — 제곱 감쇠라 약한 충격은 거의 안 흔들리고 큰 충격만 확 온다
    if (this.trauma > 0.01) {
      const t2 = this.trauma * this.trauma * this.perf.budget.shake;
      ctx.translate(noise1(now * 0.03) * 16 * t2, noise1(now * 0.03 + 100) * 16 * t2);
      ctx.rotate(noise1(now * 0.02 + 200) * 0.035 * t2);
    }
    // 줌 펀치 — 줍스를 중심으로 화면을 밀어낸다 (오버레이만 스케일, 지구는 그대로)
    if (fx && this.punch > 0.001) {
      const z = 1 + this.punch;
      ctx.translate(this.joops.x, this.joops.y);
      ctx.scale(z, z);
      ctx.translate(-this.joops.x, -this.joops.y);
    }

    // 우주 먼지
    ctx.fillStyle = "rgba(190,215,255,0.13)";
    for (const d of this.dust) ctx.fillRect(d.x, d.y, d.len, 2);

    // 궤도 점선 HUD
    const dashTile = 32;
    const dashOff = (now * 0.045) % dashTile;
    ctx.globalAlpha = 0.3;
    for (let tx = -dashTile; tx < this.W + dashTile; tx += dashTile) {
      drawSprite(ctx, ORBIT_DASH, tx - dashOff, this.H * 0.4 - 16, 2);
    }
    ctx.globalAlpha = 1;

    for (const d of this.debris) {
      if (d.alive) this.drawDebris(ctx, d, d.tier <= info.stage.maxTier, fx);
    }
    for (const s of this.sats) if (s.alive) this.drawSatellite(ctx, s);
    if (this.capsule) this.drawCapsule(ctx, this.capsule);

    if (this.friend) {
      const f = this.friend;
      drawJoops(ctx, f.x, f.y, 18, 1, now, {
        variant: "friend",
        mood: "happy",
        dirX: Math.sign(f.vx) * 0.5,
        thrust: true,
      });
    }

    // 줍스
    const j = this.joops;
    const mood: JoopsMood = info.exhausted ? "hurt" : info.energy < 25 ? "tired" : "happy";
    const blink = now < this.invulnUntil ? 0.55 + 0.45 * Math.sin(now / 55) : 1;
    const gulp = Math.max(0, (this.chompUntil - now) / 240);
    drawJoops(ctx, j.x, j.y, info.stage.size * (1 + 0.16 * gulp), info.stageIndex, now, {
      mood,
      dirX: j.dirX,
      dirY: j.dirY,
      thrust: Math.hypot(j.vx, j.vy) > 40 && !info.exhausted,
      chomp: gulp > 0,
      alpha: blink,
    });

    this.drawParticles(ctx);
    this.drawCombo(ctx, info);
    this.drawTexts(ctx);

    ctx.restore();

    // 피격 비네트 (셰이크 밖에서 — 화면에 고정)
    if (fx && this.hurtFlash > 0.01 && this.vignette) {
      ctx.globalAlpha = this.hurtFlash * (0.6 + 0.4 * Math.sin(now / 60));
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    // 임팩트 플래시 (히트스톱 프리즈 프레임에서 특히 잘 보인다)
    if (this.impactFlash > 0.005) {
      ctx.fillStyle = `rgba(255,255,255,${this.impactFlash})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawCombo(ctx: CanvasRenderingContext2D, info: FrameInfo): void {
    if (this.combo < 2) return;
    const j = this.joops;
    const y = j.y - info.stage.size - 16;
    const ratio = clamp((this.comboUntil - this.gt) / comboWindowMs(this.combo), 0, 1);
    const hot = this.comboMult >= 2;
    const w = 46;

    // 남은 시간 게이지
    ctx.fillStyle = "rgba(8,16,30,0.6)";
    ctx.fillRect(j.x - w / 2, y, w, 3);
    ctx.fillStyle = hot ? "#ff8f5a" : "#7de8d8";
    ctx.fillRect(j.x - w / 2, y, w * ratio, 3);

    // 배수
    const pulse = 1 + 0.12 * Math.sin(this.gt / 90) * (hot ? 1 : 0.4);
    ctx.save();
    ctx.translate(j.x, y - 8);
    ctx.scale(pulse, pulse);
    ctx.font = `700 ${hot ? 15 : 12}px var(--font-geist-mono), monospace`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(6,12,26,0.8)";
    const label = `${this.combo} ×${this.comboMult}`;
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = hot ? "#ffd97a" : "#a8f5e8";
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts.items) {
      if (!p.alive) continue;
      const q = 1 - p.life / p.ttl;
      if (p.kind === "spark") {
        ctx.globalAlpha = Math.round(q * 4) / 4;
        ctx.fillStyle = p.color;
        const s = Math.max(1.5, p.size * (0.6 + q));
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === "puff") {
        ctx.globalAlpha = (Math.round(q * 4) / 4) * 0.5;
        ctx.fillStyle = p.color;
        const s = p.size * (1.8 - q * 0.6);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === "ring") {
        ctx.globalAlpha = q;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        const rr = p.size + (1 - q) * 34;
        ctx.strokeRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
      } else if (p.kind === "heart") {
        ctx.globalAlpha = Math.min(1, q * 1.4);
        const hs = p.size / 9;
        drawSprite(ctx, HEART, p.x - 6.5 * hs, p.y - 7.5 * hs, hs, { 7: p.color });
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    for (const t of this.texts.items) {
      if (!t.alive) continue;
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
  }

  private drawDebris(
    ctx: CanvasRenderingContext2D,
    d: Debris,
    edible: boolean,
    fx: boolean,
  ): void {
    const scale = 0.9 + d.r / 7;
    const bob = Math.sin(this.gt / 420 + d.seed) * 2;
    // 구운 스프라이트를 drawImage — fillRect 256회 → 1회
    drawBaked(ctx, `debris${d.tier}`, DEBRIS_GRIDS[d.tier - 1], d.x, d.y + bob, scale);

    // 트랙터 빔 — 흡입되는 게 눈에 보이게
    if (fx && edible) {
      const j = this.joops;
      const dist = Math.hypot(j.x - d.x, j.y - d.y);
      if (dist < 130 && dist > 8) {
        ctx.globalAlpha = 0.22 * (1 - dist / 130);
        ctx.strokeStyle = "#7de8d8";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + bob);
        ctx.lineTo(j.x, j.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // 처리 가능 여부 타겟 틱
    const half = d.r + 6;
    const t = Math.max(2, Math.round(scale));
    const arm = t * 2;
    ctx.fillStyle = edible
      ? "rgba(125,232,216,0.4)"
      : `rgba(255,110,110,${0.35 + 0.3 * Math.sin(this.gt / 220 + d.seed)})`;
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        const cx = d.x + sx * half;
        const cy = d.y + bob + sy * half;
        ctx.fillRect(sx > 0 ? cx - arm : cx, cy - t / 2, arm, t);
        ctx.fillRect(cx - t / 2, sy > 0 ? cy - arm : cy, t, arm);
      }
    }
  }

  private drawSatellite(ctx: CanvasRenderingContext2D, s: Satellite): void {
    const on = Math.floor(this.gt / 260) % 2 === 0;
    drawBaked(ctx, on ? "satOn" : "satOff", on ? SAT_FRAMES[0] : SAT_FRAMES[1], s.x, s.y + 3, 3);
    if (on) {
      ctx.fillStyle = "rgba(255,80,80,0.18)";
      ctx.fillRect(s.x - 8, s.y + 3, 14, 14);
    }
  }

  private drawCapsule(ctx: CanvasRenderingContext2D, c: Capsule): void {
    const bobY = c.y + Math.sin(this.gt / 420 + c.phase) * 5;
    const pulse = 0.5 + 0.5 * Math.sin(this.gt / 300);
    ctx.globalAlpha = 0.35 + 0.4 * pulse;
    ctx.strokeStyle = "#7fd4ff";
    ctx.lineWidth = 2;
    const rr = 16 + pulse * 4;
    ctx.strokeRect(c.x - rr, bobY - rr, rr * 2, rr * 2);
    ctx.globalAlpha = 1;
    const f = Math.floor(this.gt / 320) % 2;
    drawBaked(ctx, `capsule${f}`, CAPSULE_FRAMES[f], c.x, bobY, 2);
  }

  /** 자주 쓰는 스프라이트를 미리 구워둔다 — 첫 흡수·첫 위성 때의 히칭 방지 */
  warmup(): void {
    for (let t = 1; t <= 5; t++) {
      const def = DEBRIS_TIERS[t - 1];
      baked(`debris${t}`, DEBRIS_GRIDS[t - 1], 0.9 + def.radius / 7);
    }
    baked("satOn", SAT_FRAMES[0], 3);
    baked("satOff", SAT_FRAMES[1], 3);
    baked("capsule0", CAPSULE_FRAMES[0], 2);
    baked("capsule1", CAPSULE_FRAMES[1], 2);
  }
}
