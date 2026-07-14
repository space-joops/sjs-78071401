"use client";

import { useEffect, useRef } from "react";
import {
  DEBRIS_KINDS,
  DROP_CHANCE,
  DROP_GLOBAL_BOOST_RATIO,
  GREET_EXP,
  NPC_GREETINGS,
  NPC_NAMES,
} from "../constants";
import { loadWorld, project } from "../lib/geo";
import { expProgress, stageForLevel } from "../lib/level";
import { joopsPositionAt } from "../lib/orbit";
import type { DebrisKind, SaveData, WorldData } from "../types";
import type { GainEvent } from "./JoopsOdyssey";

type Props = {
  save: SaveData;
  multiplier: number;
  onGain: (g: GainEvent) => void;
  onDamage: (dmg: number) => void;
};

type Debris = {
  kind: DebrisKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
};

type Npc = {
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  bobPhase: number;
  greeted: boolean;
  bubble: string | null;
  bubbleUntil: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
};

type Game = {
  joops: { x: number; y: number; tx: number; ty: number; blink: number };
  debris: Debris[];
  npcs: Npc[];
  particles: Particle[];
  stars: { x: number; y: number; r: number; phase: number; speed: number }[];
  spawnIn: number;
  npcSpawnIn: number;
  invuln: number;
  flash: number;
  dragging: boolean;
  lastT: number;
};

const REACH_PX = 150;
const NPC_COLORS = ["#fda4af", "#fdba74", "#a5b4fc", "#86efac"];

function buildEarthTexture(world: WorldData): HTMLCanvasElement {
  const tex = document.createElement("canvas");
  tex.width = 1024;
  tex.height = 512;
  const ctx = tex.getContext("2d")!;
  const ocean = ctx.createLinearGradient(0, 0, 0, tex.height);
  ocean.addColorStop(0, "#0d2f63");
  ocean.addColorStop(0.5, "#155089");
  ocean.addColorStop(1, "#0d2f63");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, tex.width, tex.height);
  ctx.fillStyle = "#33604a";
  ctx.strokeStyle = "rgba(180, 230, 200, 0.25)";
  ctx.lineWidth = 0.6;
  for (const c of world.countries) {
    for (const ring of c.r) {
      ctx.beginPath();
      ring.forEach(([lng, lat], i) => {
        const [x, y] = project(lng, lat, tex.width, tex.height);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // 구름
  for (let i = 0; i < 40; i++) {
    const x = (i * 517) % tex.width;
    const y = ((i * 293) % (tex.height - 60)) + 30;
    const r = 18 + ((i * 71) % 42);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return tex;
}

function drawDebris(ctx: CanvasRenderingContext2D, d: Debris) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);
  const r = d.kind.r;
  if (d.kind.id === "satellite") {
    // 폐기 인공위성: 몸통 + 태양광 패널
    ctx.fillStyle = "#334155";
    ctx.fillRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7);
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(-r * 1.4, -r * 0.22, r * 0.9, r * 0.44);
    ctx.fillRect(r * 0.5, -r * 0.22, r * 0.9, r * 0.44);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7);
  } else if (d.kind.id === "large") {
    // 로켓 부스터 잔해
    ctx.fillStyle = d.kind.color;
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.45, r * 2, r * 0.9, r * 0.3);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-r * 0.2, -r * 0.45, r * 0.18, r * 0.9);
  } else if (d.kind.id === "medium") {
    // 태양광 패널 조각
    ctx.fillStyle = d.kind.color;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.6);
    ctx.lineTo(r * 0.9, -r * 0.3);
    ctx.lineTo(r * 0.5, r * 0.7);
    ctx.lineTo(-r * 0.7, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // 미세 파편
    ctx.fillStyle = d.kind.color;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r * 0.2, -r);
    ctx.lineTo(r, -r * 0.2);
    ctx.lineTo(r * 0.4, r * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCreature(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  body: string,
  glow: string,
  t: number,
  opts: { ring?: boolean; aura?: boolean; happy?: boolean } = {}
) {
  ctx.save();
  ctx.translate(x, y);
  const squish = 1 + Math.sin(t / 350) * 0.04;
  ctx.scale(1, squish);

  // 글로우
  const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.2);
  g.addColorStop(0, glow);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  if (opts.ring) {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 1.6, r * 0.5, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 안테나
  ctx.strokeStyle = body;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);
  ctx.quadraticCurveTo(r * 0.15, -r * 1.5, 0, -r * 1.55);
  ctx.stroke();
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.arc(0, -r * 1.6, r * 0.16 + Math.sin(t / 250) * r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // 몸통
  const bodyGrad = ctx.createLinearGradient(0, -r, 0, r);
  bodyGrad.addColorStop(0, body);
  bodyGrad.addColorStop(1, "rgba(255,255,255,0.75)");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // 눈 (주기적으로 깜빡임)
  const blink = Math.abs(Math.sin(t / 1900)) > 0.97;
  ctx.fillStyle = "#0f172a";
  const eyeY = -r * 0.12;
  if (blink && !opts.happy) {
    ctx.lineWidth = r * 0.08;
    ctx.strokeStyle = "#0f172a";
    for (const ex of [-r * 0.35, r * 0.35]) {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.14, eyeY);
      ctx.lineTo(ex + r * 0.14, eyeY);
      ctx.stroke();
    }
  } else if (opts.happy) {
    ctx.lineWidth = r * 0.09;
    ctx.strokeStyle = "#0f172a";
    for (const ex of [-r * 0.35, r * 0.35]) {
      ctx.beginPath();
      ctx.arc(ex, eyeY + r * 0.08, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const ex of [-r * 0.35, r * 0.35]) {
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const ex of [-r * 0.35, r * 0.35]) {
      ctx.beginPath();
      ctx.arc(ex + r * 0.05, eyeY - r * 0.05, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 입
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, r * 0.25, r * 0.22, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // 볼터치
  ctx.fillStyle = "rgba(251, 113, 133, 0.4)";
  for (const ex of [-r * 0.6, r * 0.6]) {
    ctx.beginPath();
    ctx.arc(ex, r * 0.15, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  if (opts.aura) {
    for (let i = 0; i < 5; i++) {
      const a = (t / 900 + (i * Math.PI * 2) / 5) % (Math.PI * 2);
      ctx.fillStyle = "rgba(254, 240, 138, 0.7)";
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export default function FlightGame({ save, multiplier, onGain, onDamage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const propsRef = useRef({ save, multiplier, onGain, onDamage });
  propsRef.current = { save, multiplier, onGain, onDamage };

  useEffect(() => {
    let cancelled = false;
    loadWorld()
      .then((w) => {
        if (!cancelled) textureRef.current = buildEarthTexture(w);
      })
      .catch(() => {
        // 텍스처 없이도(민무늬 지구) 게임은 진행 가능
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const game: Game = {
      joops: { x: 120, y: 160, tx: 120, ty: 160, blink: 0 },
      debris: [],
      npcs: [],
      particles: [],
      stars: Array.from({ length: 110 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.5 + 0.5,
      })),
      spawnIn: 0.8,
      npcSpawnIn: 6,
      invuln: 0,
      flash: 0,
      dragging: false,
      lastT: performance.now(),
    };
    gameRef.current = game;

    let dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;

    const addText = (x: number, y: number, text: string, color = "#fef08a") => {
      game.particles.push({
        x,
        y,
        vx: 0,
        vy: -46,
        life: 1.4,
        maxLife: 1.4,
        size: 13,
        color,
        text,
      });
    };

    const burst = (x: number, y: number, color: string, n: number, heart = false) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 140;
        game.particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (heart ? 40 : 0),
          life: 0.7 + Math.random() * 0.5,
          maxLife: 1.2,
          size: heart ? 11 : 2 + Math.random() * 3,
          color,
          text: heart ? "💖" : undefined,
        });
      }
    };

    const displayExp = (base: number) => {
      const p = propsRef.current;
      const penalty = p.save.joops.stress >= 70 ? 0.5 : 1;
      return Math.round(base * p.multiplier * penalty);
    };

    const eatDebris = (d: Debris, viaTap: boolean) => {
      game.debris = game.debris.filter((x) => x !== d);
      burst(d.x, d.y, d.kind.color, viaTap ? 16 : 10);
      addText(d.x, d.y - 16, `+${displayExp(d.kind.exp)} EXP`);
      const gain: GainEvent = { exp: d.kind.exp, debris: 1 };
      if (Math.random() < DROP_CHANCE) {
        if (Math.random() < DROP_GLOBAL_BOOST_RATIO) {
          gain.globalBoost = 1;
          addText(d.x, d.y - 40, "🌐 전 지구 부스트 획득!", "#fbbf24");
        } else {
          gain.capsules = 1;
          addText(d.x, d.y - 40, "💊 에너지 캡슐 획득!", "#6ee7b7");
        }
      }
      propsRef.current.onGain(gain);
    };

    const greetNpc = (npc: Npc) => {
      if (npc.greeted) return;
      npc.greeted = true;
      npc.bubble = NPC_GREETINGS[Math.floor(Math.random() * NPC_GREETINGS.length)];
      npc.bubbleUntil = performance.now() + 3200;
      burst(npc.x, npc.y, "#fda4af", 10, true);
      addText(npc.x, npc.y - 46, `+${displayExp(GREET_EXP)} EXP`, "#fda4af");
      propsRef.current.onGain({ exp: GREET_EXP, greet: 1 });
    };

    const pointerPos = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const [px, py] = pointerPos(e);
      const stage = stageForLevel(expProgress(propsRef.current.save.joops.exp).level);

      // 1) 쓰레기 탭?
      const hit = [...game.debris]
        .reverse()
        .find((d) => Math.hypot(d.x - px, d.y - py) <= d.kind.r + 14);
      if (hit) {
        const inReach =
          Math.hypot(hit.x - game.joops.x, hit.y - game.joops.y) <=
          REACH_PX + hit.kind.r;
        if (hit.kind.id === "satellite") {
          addText(hit.x, hit.y - 20, "위성은 파괴 불가! 피해야 해 ⚠️", "#f87171");
        } else if (hit.kind.size > stage.maxDebrisSize) {
          addText(hit.x, hit.y - 20, "아직 처리할 수 없는 크기야! 🔒", "#f87171");
        } else if (!inReach) {
          game.joops.tx = px;
          game.joops.ty = py;
          addText(game.joops.x, game.joops.y - 40, "가까이 가야 해!", "#e2e8f0");
        } else {
          eatDebris(hit, true);
        }
        return;
      }

      // 2) 친구 줍스 탭? (터치 타깃 넉넉하게)
      const npcHit = game.npcs.find((n) => Math.hypot(n.x - px, n.y - py) <= 44);
      if (npcHit) {
        greetNpc(npcHit);
        return;
      }

      // 3) 이동 (드래그 시작)
      game.dragging = true;
      game.joops.tx = px;
      game.joops.ty = py;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!game.dragging) return;
      const [px, py] = pointerPos(e);
      game.joops.tx = px;
      game.joops.ty = py;
    };

    const onPointerUp = () => {
      game.dragging = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const spawnDebris = () => {
      const lvl = expProgress(propsRef.current.save.joops.exp).level;
      const roll = Math.random();
      let kind: DebrisKind;
      if (roll < 0.5) kind = DEBRIS_KINDS[0];
      else if (roll < 0.75) kind = DEBRIS_KINDS[1];
      else if (roll < 0.9) kind = DEBRIS_KINDS[2];
      else kind = DEBRIS_KINDS[3];
      const speed = 40 + Math.random() * 80 + lvl * 2;
      game.debris.push({
        kind,
        x: W() + 50,
        y: 30 + Math.random() * Math.max(60, H() * 0.72),
        vx: -speed,
        vy: (Math.random() - 0.5) * 30,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 1.6,
      });
    };

    const spawnNpc = () => {
      const fromLeft = Math.random() < 0.5;
      game.npcs.push({
        name: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
        color: NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)],
        x: fromLeft ? -50 : W() + 50,
        y: 50 + Math.random() * Math.max(60, H() * 0.5),
        vx: (fromLeft ? 1 : -1) * (26 + Math.random() * 30),
        bobPhase: Math.random() * Math.PI * 2,
        greeted: false,
        bubble: null,
        bubbleUntil: 0,
      });
    };

    let raf = 0;
    const frame = (tNow: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (tNow - game.lastT) / 1000);
      game.lastT = tNow;
      const w = W();
      const h = H();
      if (w === 0 || h === 0) return;
      const p = propsRef.current;
      const level = expProgress(p.save.joops.exp).level;
      const stage = stageForLevel(level);

      // ── 업데이트 ──
      game.spawnIn -= dt;
      if (game.spawnIn <= 0 && game.debris.length < 14) {
        spawnDebris();
        game.spawnIn = 1.0 + Math.random() * 1.4;
      }
      game.npcSpawnIn -= dt;
      if (game.npcSpawnIn <= 0 && game.npcs.length < 2) {
        spawnNpc();
        game.npcSpawnIn = 15 + Math.random() * 20;
      }

      const j = game.joops;
      const ease = Math.min(1, dt * 5);
      j.x += (j.tx - j.x) * ease;
      j.y += (j.ty - j.y) * ease;
      j.x = Math.max(stage.radius, Math.min(w - stage.radius, j.x));
      j.y = Math.max(stage.radius + 8, Math.min(h - stage.radius - 8, j.y));

      game.invuln = Math.max(0, game.invuln - dt);
      game.flash = Math.max(0, game.flash - dt * 1.6);

      for (const d of game.debris) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vrot * dt;
        // 충돌 판정
        const dist = Math.hypot(d.x - j.x, d.y - j.y);
        if (dist <= d.kind.r + stage.radius * 0.9) {
          const edible =
            d.kind.id !== "satellite" && d.kind.size <= stage.maxDebrisSize;
          if (edible) {
            eatDebris(d, false);
          } else if (game.invuln <= 0) {
            game.invuln = 1.6;
            game.flash = 0.6;
            d.vx = Math.abs(d.vx) * 1.2;
            d.vy = (j.y < d.y ? 1 : -1) * 60;
            burst(j.x, j.y, "#f87171", 14);
            addText(j.x, j.y - stage.radius - 16, `-${d.kind.damage} HP`, "#f87171");
            p.onDamage(d.kind.damage);
          }
        }
      }
      game.debris = game.debris.filter(
        (d) => d.x > -80 && d.y > -80 && d.y < h + 80
      );

      for (const n of game.npcs) {
        n.x += n.vx * dt;
        n.bobPhase += dt * 2;
      }
      game.npcs = game.npcs.filter((n) => n.x > -90 && n.x < w + 90);

      for (const pt of game.particles) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
      }
      game.particles = game.particles.filter((pt) => pt.life > 0);

      // 이동 중 꼬리 입자
      if (Math.hypot(j.tx - j.x, j.ty - j.y) > 6 && Math.random() < 0.5) {
        game.particles.push({
          x: j.x - (j.tx - j.x) * 0.1,
          y: j.y + stage.radius * 0.6,
          vx: (Math.random() - 0.5) * 20,
          vy: 30 + Math.random() * 20,
          life: 0.5,
          maxLife: 0.5,
          size: 2.5,
          color: stage.bodyColor,
        });
      }

      // ── 렌더 ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#020308");
      bg.addColorStop(0.7, "#070d1f");
      bg.addColorStop(1, "#0a1330");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 별
      for (const st of game.stars) {
        const a = 0.25 + (Math.sin(tNow / 1000 * st.speed + st.phase) * 0.5 + 0.5) * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(st.x * w, st.y * h * 0.7, st.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 지구 (하단 원호, 실시간 궤도 경도에 맞춰 자전)
      const R = w * 1.35;
      const cx = w / 2;
      const cy = h * 0.72 + R;
      const horizonY = cy - R;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      const tex = textureRef.current;
      if (tex) {
        const pos = joopsPositionAt(Date.now());
        const degSpan = 100; // 화면 폭이 커버하는 경도 범위
        const pxPerDeg = w / degSpan;
        const texPxPerDeg = tex.width / 360;
        const scale = pxPerDeg / texPxPerDeg;
        const drawW = tex.width * scale;
        const centerU = ((pos.lng + 180) / 360) * drawW;
        let offsetX = cx - centerU;
        offsetX = ((offsetX % drawW) + drawW) % drawW;
        const latY = ((90 - pos.lat) / 180) * tex.height * scale;
        const offsetY = horizonY - latY + (tex.height * scale) * 0.18;
        for (let k = -1; k <= 1; k++) {
          ctx.drawImage(
            tex,
            offsetX + k * drawW - drawW,
            offsetY,
            drawW,
            tex.height * scale
          );
        }
      } else {
        ctx.fillStyle = "#123c6b";
        ctx.fillRect(0, horizonY, w, h - horizonY);
      }
      // 표면 음영
      const shade = ctx.createLinearGradient(0, horizonY, 0, h);
      shade.addColorStop(0, "rgba(140, 200, 255, 0.14)");
      shade.addColorStop(0.35, "rgba(0, 0, 0, 0)");
      shade.addColorStop(1, "rgba(0, 0, 10, 0.55)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, horizonY, w, h - horizonY);
      ctx.restore();

      // 대기권 글로우
      ctx.save();
      ctx.strokeStyle = "rgba(103, 232, 249, 0.8)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(103, 232, 249, 0.9)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();

      // 쓰레기
      for (const d of game.debris) drawDebris(ctx, d);

      // 친구 줍스(NPC)
      for (const n of game.npcs) {
        const ny = n.y + Math.sin(n.bobPhase) * 6;
        drawCreature(ctx, n.x, ny, 16, n.color, "rgba(253, 164, 175, 0.35)", tNow, {
          happy: n.greeted,
        });
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.name, n.x, ny - 34);
        if (n.bubble && tNow < n.bubbleUntil) {
          ctx.font = "12px sans-serif";
          const tw = ctx.measureText(n.bubble).width + 16;
          const bx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, n.x));
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.beginPath();
          ctx.roundRect(bx - tw / 2, ny - 66, tw, 22, 11);
          ctx.fill();
          ctx.fillStyle = "#0f172a";
          ctx.fillText(n.bubble, bx, ny - 51);
        }
      }

      // 줍스 (피격 무적 중 깜빡임)
      const visible = game.invuln <= 0 || Math.floor(tNow / 90) % 2 === 0;
      if (visible) {
        // 도달 범위 표시
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(j.x, j.y, REACH_PX, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        drawCreature(ctx, j.x, j.y, stage.radius, stage.bodyColor, stage.glowColor, tNow, {
          ring: level >= 8,
          aura: level >= 14,
        });
      }

      // 입자·텍스트
      for (const pt of game.particles) {
        const a = Math.max(0, pt.life / pt.maxLife);
        if (pt.text) {
          ctx.globalAlpha = a;
          ctx.font = `bold ${pt.size}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = pt.color;
          ctx.fillText(pt.text, pt.x, pt.y);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // 피격 비네트
      if (game.flash > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${(game.flash * 0.4).toFixed(2)})`;
        ctx.fillRect(0, 0, w, h);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      {/* 상단 오버레이 */}
      <div className="pointer-events-none absolute left-3 top-2 text-[10px] text-white/60">
        <p>고도 550km · 궤도 속도 7.6km/s</p>
      </div>
      {multiplier > 1 && (
        <div className="pointer-events-none absolute right-3 top-2 animate-pulse rounded-full bg-amber-400/90 px-3 py-1 text-xs font-bold text-black">
          🏠 상공 부스트 x{multiplier}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/45">
        드래그: 이동 · 파편 탭: 부수기/먹기 · 친구 줍스 탭: 인사 💫
      </div>
    </div>
  );
}
