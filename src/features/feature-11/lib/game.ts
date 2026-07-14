// Pixi 스테이지 조립 + 메인 루프. React와의 경계는 GameHooks 콜백과 공개 API뿐이다.
// 성능 원칙: 필터 0(additive 블렌드만), 단일 아틀라스 소스, SoA 풀, dt clamp.
import type { Application, Particle, Sprite, Ticker } from "pixi.js";
import type { Sfx } from "./audio";
import type { GameHooks } from "./constants";
import {
  BASE_MAGNET_RADIUS,
  DEBRIS_MAX_SPEED,
  DEBRIS_TYPES,
  FEVER_FORCE_MULT,
  FEVER_RADIUS_MULT,
  HAZARD_RADIUS,
  HAZARD_TYPE_ID,
  IDLE_DEBRIS_TARGET,
  MAGNET_FORCE,
  MAX_DEBRIS,
  MAX_RINGS,
  MAX_SPARKS,
  PET_BODY_RADIUS,
  SPAWNS_PER_FRAME,
  STAGE_MAGNET_BONUS,
  STAR_COUNT,
  TRAIL_LENGTH,
  WAVES,
} from "./constants";
import { DebrisPool, SparkPool } from "./entities";
import {
  applyCollect,
  applyHit,
  newRunState,
  pickTypeId,
  QualityGovernor,
  tickRun,
  waveIndexAt,
} from "./systems";
import {
  buildAtlas,
  buildPetLook,
  GLOW_DRAWN_RADIUS,
  PET_DRAWN_RADIUS,
  RING_DRAWN_RADIUS,
} from "./textures";

type Pixi = typeof import("pixi.js");
type Mode = "idle" | "playing" | "over";

export type SwarmGame = {
  start: () => void;
  setEvolutionStage: (stage: number) => void;
  /** 이번 판 현재 수거량 — pagehide 중간 플러시용 */
  getCollected: () => number;
  destroy: () => void;
};

const BG_BASE = { r: 0x05, g: 0x0a, b: 0x16 };
const BG_FEVER = { r: 0x1c, g: 0x0e, b: 0x2e };
const DEBRIS_TINTS = [0xffffff, 0xdfe8ff, 0xcfd8e8];
const SPARK_NORMAL = 0x6ef2dc;
const SPARK_FEVER = 0xffd76a;
const SPARK_HAZARD = 0xff8a5c;

export function createSwarmGame(
  PIXI: Pixi,
  app: Application,
  input: HTMLElement,
  hooks: GameHooks,
  sfx: Sfx,
  initialStage: number,
): SwarmGame {
  const atlas = buildAtlas(PIXI);
  let petLook = buildPetLook(PIXI, initialStage);
  let stage = initialStage;
  let magnetRadius = BASE_MAGNET_RADIUS + stage * STAGE_MAGNET_BONUS;

  const root = new PIXI.Container();
  app.stage.addChild(root);

  // ── 배경 별 (정적 파티클) ─────────────────────────────
  const starsPC = new PIXI.ParticleContainer({
    dynamicProperties: { vertex: false, position: false, rotation: false, uvs: false, color: false },
  });
  {
    const w = Math.max(app.screen.width, 480) * 1.5;
    const h = Math.max(app.screen.height, 800) * 1.5;
    for (let i = 0; i < STAR_COUNT; i++) {
      const sc = 0.08 + Math.random() * 0.2;
      starsPC.addParticle(
        new PIXI.Particle({
          texture: atlas.star,
          x: (Math.random() - 0.17) * w,
          y: (Math.random() - 0.17) * h,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: sc,
          scaleY: sc,
          alpha: 0.25 + Math.random() * 0.6,
        }),
      );
    }
  }
  root.addChild(starsPC);

  // ── 파편 (일반+위험, 동적 파티클) ─────────────────────
  const debrisPC = new PIXI.ParticleContainer({
    dynamicProperties: { vertex: true, position: true, rotation: true, uvs: true, color: true },
  });
  const pool = new DebrisPool(MAX_DEBRIS);
  {
    const parked: Particle[] = [];
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const p = new PIXI.Particle({
        texture: atlas.debris[0],
        x: -9999,
        y: -9999,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 0,
      });
      debrisPC.addParticle(p);
      parked.push(p);
    }
    pool.bind(parked);
  }
  root.addChild(debrisPC);

  // ── 트레일 ────────────────────────────────────────────
  const trailC = new PIXI.Container();
  const trailSprites: Sprite[] = [];
  const trailX = new Float32Array(TRAIL_LENGTH);
  const trailY = new Float32Array(TRAIL_LENGTH);
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const s = new PIXI.Sprite(atlas.glow);
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.tint = petLook.trailTint;
    s.alpha = 0;
    trailC.addChild(s);
    trailSprites.push(s);
  }
  root.addChild(trailC);

  // ── 펫 ────────────────────────────────────────────────
  const petC = new PIXI.Container();
  const petGlow = new PIXI.Sprite(atlas.glow);
  petGlow.anchor.set(0.5);
  petGlow.blendMode = "add";
  petGlow.tint = petLook.glowTint;
  petGlow.alpha = 0.4;
  petGlow.scale.set((PET_BODY_RADIUS * 2.4) / GLOW_DRAWN_RADIUS);
  const magnetRing = new PIXI.Sprite(atlas.ring);
  magnetRing.anchor.set(0.5);
  magnetRing.blendMode = "add";
  magnetRing.alpha = 0.12;
  const petBody = new PIXI.Sprite(petLook.body);
  petBody.anchor.set(0.5);
  petBody.scale.set((PET_BODY_RADIUS * 1.45) / PET_DRAWN_RADIUS);
  petC.addChild(petGlow, magnetRing, petBody);
  root.addChild(petC);

  // ── 스파크 (additive 파티클) ──────────────────────────
  const sparksPC = new PIXI.ParticleContainer({
    dynamicProperties: { vertex: true, position: true, rotation: false, uvs: false, color: true },
  });
  sparksPC.blendMode = "add";
  const sparks = new SparkPool(MAX_SPARKS);
  {
    const parked: Particle[] = [];
    for (let i = 0; i < MAX_SPARKS; i++) {
      const p = new PIXI.Particle({
        texture: atlas.spark,
        x: -9999,
        y: -9999,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 0,
      });
      sparksPC.addParticle(p);
      parked.push(p);
    }
    sparks.bind(parked);
  }
  root.addChild(sparksPC);

  // ── 수거/이벤트 링 버스트 ─────────────────────────────
  const ringsC = new PIXI.Container();
  type Ring = { sprite: Sprite; life: number; maxLife: number; from: number; to: number };
  const rings: Ring[] = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const s = new PIXI.Sprite(atlas.ring);
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.alpha = 0;
    ringsC.addChild(s);
    rings.push({ sprite: s, life: 0, maxLife: 1, from: 0, to: 1 });
  }
  let ringCursor = 0;
  root.addChild(ringsC);

  // ── 전면 플래시 ───────────────────────────────────────
  const flash = new PIXI.Sprite(PIXI.Texture.WHITE);
  flash.alpha = 0;
  root.addChild(flash);

  // ── 상태 ──────────────────────────────────────────────
  let mode: Mode = "idle";
  let rs = newRunState();
  const governor = new QualityGovernor();
  const pet = {
    x: app.screen.width / 2,
    y: app.screen.height * 0.55,
    vx: 0,
    vy: 0,
  };
  const pointer = { x: pet.x, y: pet.y, has: false };
  trailX.fill(pet.x);
  trailY.fill(pet.y);
  let elapsed = 0;
  let hudAcc = 0;
  let destroyed = false;

  // ── 입력 (DOM PointerEvent — 저장소 관례) ─────────────
  const setTarget = (e: PointerEvent) => {
    const rect = input.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.has = true;
  };
  const onPointerDown = (e: PointerEvent) => {
    sfx.unlock();
    try {
      input.setPointerCapture(e.pointerId);
    } catch {
      // 일부 브라우저에서 실패해도 무해
    }
    setTarget(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    setTarget(e);
  };
  input.addEventListener("pointerdown", onPointerDown);
  input.addEventListener("pointermove", onPointerMove);

  // ── 스폰/이펙트 헬퍼 ──────────────────────────────────
  function spawnDebris(speedMult: number, hazardRatio: number, inside: boolean): void {
    const i = pool.acquire();
    if (i < 0) return;
    const W = app.screen.width;
    const H = app.screen.height;
    const typeId = pickTypeId(hazardRatio, Math.random);
    const isHaz = typeId === HAZARD_TYPE_ID;
    const baseRadius = isHaz ? HAZARD_RADIUS : DEBRIS_TYPES[typeId].radius;
    const radius = baseRadius * (0.85 + Math.random() * 0.3);
    const speed = (24 + Math.random() * 46) * speedMult;

    let x: number, y: number, ang: number;
    if (inside) {
      x = Math.random() * W;
      y = Math.random() * H;
      ang = Math.random() * Math.PI * 2;
    } else {
      const side = Math.floor(Math.random() * 4);
      const m = 40;
      if (side === 0) {
        x = Math.random() * W;
        y = -m;
        ang = Math.PI / 2;
      } else if (side === 1) {
        x = W + m;
        y = Math.random() * H;
        ang = Math.PI;
      } else if (side === 2) {
        x = Math.random() * W;
        y = H + m;
        ang = -Math.PI / 2;
      } else {
        x = -m;
        y = Math.random() * H;
        ang = 0;
      }
      ang += (Math.random() - 0.5) * (Math.PI / 1.5);
    }

    pool.x[i] = x;
    pool.y[i] = y;
    pool.vx[i] = Math.cos(ang) * speed;
    pool.vy[i] = Math.sin(ang) * speed;
    pool.rot[i] = Math.random() * Math.PI * 2;
    pool.vr[i] = (Math.random() - 0.5) * 3;
    pool.radius[i] = radius;
    pool.typeId[i] = typeId;

    const p = pool.particles[i];
    p.texture = isHaz ? atlas.hazard : atlas.debris[typeId];
    const sc = radius / 14;
    p.scaleX = sc;
    p.scaleY = sc;
    p.rotation = pool.rot[i];
    p.alpha = 1;
    p.tint = isHaz ? 0xffffff : DEBRIS_TINTS[i % DEBRIS_TINTS.length];
    p.x = x;
    p.y = y;
  }

  function emitSparks(x: number, y: number, count: number, tint: number): void {
    const n = Math.max(2, Math.round(count * governor.sparkScale));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 150;
      sparks.emit(
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.3 + Math.random() * 0.3,
        0.2 + Math.random() * 0.3,
        tint,
      );
    }
  }

  function burstRing(x: number, y: number, tint: number, toRadius: number): void {
    const r = rings[ringCursor];
    ringCursor = (ringCursor + 1) % MAX_RINGS;
    r.life = 0.45;
    r.maxLife = 0.45;
    r.from = 8 / RING_DRAWN_RADIUS;
    r.to = toRadius / RING_DRAWN_RADIUS;
    r.sprite.position.set(x, y);
    r.sprite.tint = tint;
  }

  function flashScreen(tint: number, alpha: number): void {
    flash.tint = tint;
    flash.alpha = alpha;
  }

  function pushHud(): void {
    hooks.onHud({
      score: Math.round(rs.score),
      timeLeft: Math.max(0, rs.timeLeft),
      combo: rs.combo,
      gauge: rs.gauge,
      fever: rs.fever,
      wave: rs.wave + 1,
      collected: rs.collected,
    });
  }

  function endRun(): void {
    mode = "over";
    if (rs.fever) hooks.onFever(false);
    pushHud();
    sfx.gameOver();
    hooks.onGameOver({
      score: Math.round(rs.score),
      collected: rs.collected,
      bestCombo: rs.bestCombo,
      feverCount: rs.feverCount,
    });
  }

  // ── 파편 스텝 (플레이/대기 공용) ──────────────────────
  function stepDebris(dt: number, playing: boolean): void {
    const W = app.screen.width;
    const H = app.screen.height;
    const R = magnetRadius * (rs.fever ? FEVER_RADIUS_MULT : 1);
    const R2 = R * R;
    const force = MAGNET_FORCE * (rs.fever ? FEVER_FORCE_MULT : 1);
    const max2 = DEBRIS_MAX_SPEED * DEBRIS_MAX_SPEED;

    for (let i = 0; i < pool.cap; i++) {
      if (!pool.alive[i]) continue;
      const isHaz = pool.typeId[i] === HAZARD_TYPE_ID;
      const dx = pet.x - pool.x[i];
      const dy = pet.y - pool.y[i];
      const d2 = dx * dx + dy * dy;

      if (playing && (!isHaz || rs.fever) && d2 < R2) {
        const d = Math.sqrt(d2) || 1;
        const pull = force * (1 - d / R);
        pool.vx[i] += (dx / d) * pull * dt;
        pool.vy[i] += (dy / d) * pull * dt;
        const sp2 = pool.vx[i] * pool.vx[i] + pool.vy[i] * pool.vy[i];
        if (sp2 > max2) {
          const k = DEBRIS_MAX_SPEED / Math.sqrt(sp2);
          pool.vx[i] *= k;
          pool.vy[i] *= k;
        }
      }

      pool.x[i] += pool.vx[i] * dt;
      pool.y[i] += pool.vy[i] * dt;
      pool.rot[i] += pool.vr[i] * dt;

      if (pool.x[i] < -80 || pool.x[i] > W + 80 || pool.y[i] < -80 || pool.y[i] > H + 80) {
        pool.kill(i);
        continue;
      }

      if (playing) {
        const rr = PET_BODY_RADIUS + pool.radius[i];
        if (d2 < rr * rr) {
          const cx = pool.x[i];
          const cy = pool.y[i];
          if (isHaz && !rs.fever) {
            pool.kill(i);
            emitSparks(cx, cy, 6, SPARK_HAZARD);
            if (rs.invuln <= 0) {
              applyHit(rs);
              hooks.onHit();
              sfx.hit();
              flashScreen(0xff3b4d, 0.28);
              burstRing(pet.x, pet.y, 0xff5d6c, 90);
              emitSparks(pet.x, pet.y, 12, SPARK_HAZARD);
              pushHud();
              if (rs.timeLeft <= 0) {
                endRun();
                return;
              }
            }
            continue;
          }
          // 수거
          pool.kill(i);
          const res = applyCollect(rs, pool.typeId[i]);
          sfx.collect(rs.combo);
          emitSparks(cx, cy, 7, isHaz ? SPARK_HAZARD : rs.fever ? SPARK_FEVER : SPARK_NORMAL);
          if (res.milestone) {
            sfx.comboUp();
            burstRing(pet.x, pet.y, SPARK_NORMAL, 70);
          }
          if (res.feverStarted) {
            hooks.onFever(true);
            sfx.feverStart();
            flashScreen(0xffd76a, 0.18);
            burstRing(pet.x, pet.y, SPARK_FEVER, 150);
            pushHud();
          }
          continue;
        }
      }

      const p = pool.particles[i];
      p.x = pool.x[i];
      p.y = pool.y[i];
      p.rotation = pool.rot[i];
      if (isHaz) p.alpha = 0.8 + Math.sin(elapsed * 6 + i) * 0.2;
    }
  }

  function stepPet(dt: number): void {
    const W = app.screen.width;
    const H = app.screen.height;
    const tx = pointer.has ? pointer.x : W / 2;
    const ty = pointer.has ? pointer.y : H * 0.55;
    // 스프링 추적 (feature-5 조향 관례)
    const k = 1 - Math.exp(-dt * 9);
    pet.vx = (tx - pet.x) * k / Math.max(dt, 0.001);
    pet.vy = (ty - pet.y) * k / Math.max(dt, 0.001);
    pet.x += (tx - pet.x) * k;
    pet.y += (ty - pet.y) * k;
    pet.x = Math.max(0, Math.min(W, pet.x));
    pet.y = Math.max(0, Math.min(H, pet.y));

    petC.position.set(pet.x, pet.y);
    petBody.rotation = Math.max(-0.3, Math.min(0.3, pet.vx * 0.0006));
    petBody.y = Math.sin(elapsed * 3) * 2.5;
    const speed = Math.hypot(pet.vx, pet.vy);
    const squash = Math.min(speed * 0.00025, 0.12);
    petBody.scale.set(
      ((PET_BODY_RADIUS * 1.45) / PET_DRAWN_RADIUS) * (1 + squash),
      ((PET_BODY_RADIUS * 1.45) / PET_DRAWN_RADIUS) * (1 - squash),
    );

    // 무적 점멸
    petC.alpha = mode === "playing" && rs.invuln > 0 ? (Math.sin(elapsed * 30) > 0 ? 0.35 : 1) : 1;

    // 자석 링
    const R = magnetRadius * (rs.fever && mode === "playing" ? FEVER_RADIUS_MULT : 1);
    magnetRing.scale.set(R / RING_DRAWN_RADIUS);
    magnetRing.alpha = rs.fever && mode === "playing" ? 0.3 + Math.sin(elapsed * 10) * 0.12 : 0.12;
    magnetRing.tint = rs.fever && mode === "playing" ? SPARK_FEVER : petLook.glowTint;

    // 트레일 시프트
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      trailX[i] = trailX[i - 1];
      trailY[i] = trailY[i - 1];
    }
    trailX[0] = pet.x;
    trailY[0] = pet.y;
    const feverBoost = rs.fever && mode === "playing" ? 2 : 1;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const s = trailSprites[i];
      const t = 1 - i / TRAIL_LENGTH;
      s.position.set(trailX[i], trailY[i]);
      s.alpha = t * 0.16 * feverBoost;
      s.scale.set(((PET_BODY_RADIUS * 1.1) / GLOW_DRAWN_RADIUS) * t);
    }
  }

  function stepRings(dt: number): void {
    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = Math.max(0, r.life / r.maxLife);
      const sc = r.from + (r.to - r.from) * (1 - t);
      r.sprite.scale.set(sc);
      r.sprite.alpha = t * 0.7;
      if (r.life <= 0) r.sprite.alpha = 0;
    }
  }

  function lerpBg(t: number): number {
    const r = Math.round(BG_BASE.r + (BG_FEVER.r - BG_BASE.r) * t);
    const g = Math.round(BG_BASE.g + (BG_FEVER.g - BG_BASE.g) * t);
    const b = Math.round(BG_BASE.b + (BG_FEVER.b - BG_BASE.b) * t);
    return (r << 16) | (g << 8) | b;
  }

  // ── 메인 루프 ─────────────────────────────────────────
  const tick = (ticker: Ticker): void => {
    if (destroyed) return;
    governor.push(ticker.deltaMS);
    const dt = Math.min(ticker.deltaMS, 50) / 1000;
    elapsed += dt;

    if (mode === "playing") {
      // 웨이브 전환
      const w = waveIndexAt(rs.clock);
      if (w !== rs.wave) {
        rs.wave = w;
        hooks.onWave(w + 1);
        sfx.wave();
      }
      // 밀도 유지 스폰
      const wave = WAVES[rs.wave];
      const target = Math.floor(wave.target * governor.densityScale);
      let spawns = 0;
      while (pool.aliveCount < target && spawns < SPAWNS_PER_FRAME) {
        spawnDebris(wave.speed, wave.hazardRatio, false);
        spawns++;
      }

      stepDebris(dt, true);

      if (mode === "playing") {
        const t = tickRun(rs, dt);
        if (rs.fever) sfx.feverTick();
        if (t.feverEnded) hooks.onFever(false);
        if (t.timeUp) endRun();
      }
    } else {
      // 대기/게임오버 배경 유영
      let spawns = 0;
      while (pool.aliveCount < IDLE_DEBRIS_TARGET && spawns < SPAWNS_PER_FRAME) {
        spawnDebris(0.7, 0.03, pool.aliveCount < IDLE_DEBRIS_TARGET / 2);
        spawns++;
      }
      stepDebris(dt, false);
    }

    stepPet(dt);
    sparks.update(dt);
    stepRings(dt);

    if (flash.alpha > 0) {
      flash.width = app.screen.width;
      flash.height = app.screen.height;
      flash.alpha = Math.max(0, flash.alpha - dt * 2.2);
    }

    app.renderer.background.color = rs.fever && mode === "playing"
      ? lerpBg(0.6 + Math.sin(elapsed * 8) * 0.25)
      : lerpBg(0);

    if (mode === "playing") {
      hudAcc += dt;
      if (hudAcc >= 0.125) {
        hudAcc = 0;
        pushHud();
      }
    }
  };
  app.ticker.add(tick);

  // ── 공개 API ──────────────────────────────────────────
  return {
    start() {
      pool.killAll();
      rs = newRunState();
      hudAcc = 0;
      mode = "playing";
      pushHud();
    },
    setEvolutionStage(next: number) {
      if (next === stage) return;
      stage = next;
      magnetRadius = BASE_MAGNET_RADIUS + stage * STAGE_MAGNET_BONUS;
      const old = petLook.body;
      petLook = buildPetLook(PIXI, stage);
      petBody.texture = petLook.body;
      petGlow.tint = petLook.glowTint;
      for (const s of trailSprites) s.tint = petLook.trailTint;
      old.destroy(true);
    },
    getCollected() {
      return rs.collected;
    },
    destroy() {
      destroyed = true;
      app.ticker.remove(tick);
      input.removeEventListener("pointerdown", onPointerDown);
      input.removeEventListener("pointermove", onPointerMove);
      root.destroy({ children: true });
    },
  };
}
