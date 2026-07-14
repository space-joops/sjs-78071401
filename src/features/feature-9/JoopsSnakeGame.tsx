"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const GRID = 21;
const START_LEN = 3;
const BASE_TICK_MS = 160;
const TICK_STEP_MS = 3;
const MIN_TICK_MS = 70;
const SCORE_PER_DEBRIS = 10;
const INITIAL_OBSTACLES = 5;
const MAX_OBSTACLES = 12;
const OBSTACLE_EVERY = 4;
const TAPS_TO_HEAL = 5;
const TAP_WINDOW_MS = 700;
const SWIPE_MIN_PX = 24;
const BEST_KEY = "joops-snake-best";

type Vec = { x: number; y: number };
type Obstacle = Vec & { angle: number };
type Status = "ready" | "playing" | "injured";

type Game = {
  status: Status;
  snake: Vec[];
  dir: Vec;
  dirQueue: Vec[];
  food: Vec;
  obstacles: Obstacle[];
  score: number;
  eaten: number;
  tickMs: number;
  acc: number;
  taps: number;
  lastTapAt: number;
  stars: { x: number; y: number; r: number; phase: number }[];
  continents: { x: number; y: number; rx: number; ry: number; rot: number }[];
};

function randomCell(): Vec {
  return {
    x: Math.floor(Math.random() * GRID),
    y: Math.floor(Math.random() * GRID),
  };
}

function occupied(cell: Vec, cells: Vec[]): boolean {
  return cells.some((c) => c.x === cell.x && c.y === cell.y);
}

function spawnFood(g: Game): Vec {
  let cell = randomCell();
  while (occupied(cell, g.snake) || occupied(cell, g.obstacles)) {
    cell = randomCell();
  }
  return cell;
}

function spawnObstacle(g: Game): Obstacle | null {
  const head = g.snake[0];
  for (let i = 0; i < 200; i++) {
    const cell = randomCell();
    const nearHead = Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) < 5;
    if (
      !nearHead &&
      !occupied(cell, g.snake) &&
      !occupied(cell, g.obstacles) &&
      !(cell.x === g.food.x && cell.y === g.food.y)
    ) {
      return { ...cell, angle: Math.random() * Math.PI };
    }
  }
  return null;
}

function resetRun(g: Game) {
  const cy = Math.floor(GRID / 2);
  g.snake = Array.from({ length: START_LEN }, (_, i) => ({
    x: Math.floor(GRID / 2) - i,
    y: cy,
  }));
  g.dir = { x: 1, y: 0 };
  g.dirQueue = [];
  g.score = 0;
  g.eaten = 0;
  g.tickMs = BASE_TICK_MS;
  g.acc = 0;
  g.obstacles = [];
  g.food = { x: -1, y: -1 };
  for (let i = 0; i < INITIAL_OBSTACLES; i++) {
    const o = spawnObstacle(g);
    if (o) g.obstacles.push(o);
  }
  g.food = spawnFood(g);
}

function newGame(): Game {
  const g: Game = {
    status: "ready",
    snake: [],
    dir: { x: 1, y: 0 },
    dirQueue: [],
    food: { x: -1, y: -1 },
    obstacles: [],
    score: 0,
    eaten: 0,
    tickMs: BASE_TICK_MS,
    acc: 0,
    taps: 0,
    lastTapAt: 0,
    stars: Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.3,
      phase: Math.random() * Math.PI * 2,
    })),
    continents: Array.from({ length: 5 }, () => ({
      x: (Math.random() - 0.5) * 0.7,
      y: (Math.random() - 0.5) * 0.7,
      rx: 0.1 + Math.random() * 0.18,
      ry: 0.05 + Math.random() * 0.1,
      rot: Math.random() * Math.PI,
    })),
  };
  resetRun(g);
  return g;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  filled: boolean
) {
  const x = cx;
  const y = cy - size / 2;
  const w = size;
  const h = size;
  const top = h * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y + top);
  ctx.bezierCurveTo(x, y, x - w / 2, y, x - w / 2, y + top);
  ctx.bezierCurveTo(x - w / 2, y + (h + top) / 2, x, y + (h + top) / 2, x, y + h);
  ctx.bezierCurveTo(x, y + (h + top) / 2, x + w / 2, y + (h + top) / 2, x + w / 2, y + top);
  ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + top);
  ctx.closePath();
  if (filled) {
    ctx.save();
    ctx.shadowColor = "rgba(248,113,113,0.9)";
    ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = "#f87171";
    ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = "rgba(252,165,165,0.45)";
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.stroke();
  }
}

function drawJoopsFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dir: Vec,
  mood: "happy" | "hurt"
) {
  const half = size / 2;
  ctx.save();
  ctx.shadowColor = mood === "happy" ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.6)";
  ctx.shadowBlur = size * 0.3;
  ctx.fillStyle = mood === "happy" ? "#6ee7b7" : "#86c5a8";
  roundedRect(ctx, cx - half, cy - half, size, size, size * 0.32);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = mood === "happy" ? "#10b981" : "#9ca3af";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();

  const ex = dir.x * size * 0.08;
  const ey = dir.y * size * 0.08;
  const eyeY = cy - size * 0.08 + ey;
  const eyeR = size * 0.09;
  ctx.strokeStyle = "#064e3b";
  ctx.fillStyle = "#064e3b";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.lineCap = "round";

  if (mood === "happy") {
    ctx.beginPath();
    ctx.arc(cx - size * 0.18 + ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.18 + ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + ex, cy + size * 0.14 + ey, size * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    for (const side of [-1, 1]) {
      const x0 = cx + side * size * 0.18;
      ctx.beginPath();
      ctx.moveTo(x0 - eyeR, eyeY - eyeR);
      ctx.lineTo(x0 + eyeR, eyeY + eyeR);
      ctx.moveTo(x0 + eyeR, eyeY - eyeR);
      ctx.lineTo(x0 - eyeR, eyeY + eyeR);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.24, size * 0.11, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    // 반창고
    ctx.save();
    ctx.translate(cx - size * 0.28, cy - size * 0.3);
    ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = "#f8fafc";
    roundedRect(ctx, -size * 0.16, -size * 0.055, size * 0.32, size * 0.11, size * 0.05);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export default function JoopsSnakeGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const g = newGame();
    let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
    setBest(bestScore);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const startRun = () => {
      resetRun(g);
      setScore(0);
      g.status = "playing";
    };

    const injure = () => {
      g.status = "injured";
      g.taps = 0;
      g.lastTapAt = 0;
      if (g.score > bestScore) {
        bestScore = g.score;
        localStorage.setItem(BEST_KEY, String(bestScore));
        setBest(bestScore);
      }
      if (typeof navigator.vibrate === "function") navigator.vibrate(150);
    };

    const healTap = () => {
      const now = performance.now();
      g.taps = now - g.lastTapAt > TAP_WINDOW_MS ? 1 : g.taps + 1;
      g.lastTapAt = now;
      if (g.taps >= TAPS_TO_HEAL) startRun();
    };

    const pushDir = (d: Vec) => {
      const cur = g.dirQueue.length > 0 ? g.dirQueue[g.dirQueue.length - 1] : g.dir;
      if (d.x === -cur.x && d.y === -cur.y) return; // 180도 역주행 금지
      if (d.x === cur.x && d.y === cur.y) return;
      if (g.dirQueue.length < 3) g.dirQueue.push(d);
    };

    const step = () => {
      const next = g.dirQueue.shift();
      if (next) g.dir = next;
      const head = g.snake[0];
      const nx = head.x + g.dir.x;
      const ny = head.y + g.dir.y;

      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return injure();
      const newHead = { x: nx, y: ny };
      if (occupied(newHead, g.obstacles)) return injure();

      const eating = nx === g.food.x && ny === g.food.y;
      const body = eating ? g.snake : g.snake.slice(0, -1);
      if (occupied(newHead, body)) return injure();

      g.snake.unshift(newHead);
      if (eating) {
        g.eaten += 1;
        g.score += SCORE_PER_DEBRIS;
        g.tickMs = Math.max(MIN_TICK_MS, BASE_TICK_MS - g.eaten * TICK_STEP_MS);
        setScore(g.score);
        if (g.eaten % OBSTACLE_EVERY === 0 && g.obstacles.length < MAX_OBSTACLES) {
          const o = spawnObstacle(g);
          if (o) g.obstacles.push(o);
        }
        g.food = spawnFood(g);
      } else {
        g.snake.pop();
      }
    };

    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const s = canvas.width / dpr;
      if (s <= 1) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = s / GRID;

      // 우주 배경
      const bg = ctx.createLinearGradient(0, 0, 0, s);
      bg.addColorStop(0, "#050510");
      bg.addColorStop(1, "#0a1029");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s, s);

      for (const star of g.stars) {
        const tw = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(now / 900 + star.phase));
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.beginPath();
        ctx.arc(star.x * s, star.y * s, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 지구 (하단에서 떠오르는 행성)
      const ex = s * 0.5;
      const ey = s * 1.3;
      const er = s * 0.62;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(96,165,250,0.5)";
      ctx.lineWidth = s * 0.01;
      ctx.shadowColor = "rgba(96,165,250,0.8)";
      ctx.shadowBlur = s * 0.06;
      ctx.stroke();
      ctx.shadowBlur = 0;
      const eg = ctx.createRadialGradient(ex, ey - er * 0.6, er * 0.1, ex, ey, er);
      eg.addColorStop(0, "rgba(56,130,206,0.55)");
      eg.addColorStop(1, "rgba(9,30,66,0.75)");
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = "rgba(74,167,120,0.3)";
      for (const b of g.continents) {
        ctx.save();
        ctx.translate(ex + b.x * er, ey + b.y * er);
        ctx.rotate(b.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, b.rx * er, b.ry * er, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // 격자
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * c, 0);
        ctx.lineTo(i * c, s);
        ctx.moveTo(0, i * c);
        ctx.lineTo(s, i * c);
        ctx.stroke();
      }

      // 장애물 (거대 위성 잔해)
      for (const o of g.obstacles) {
        const ox = (o.x + 0.5) * c;
        const oy = (o.y + 0.5) * c;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(o.angle);
        ctx.fillStyle = "#7f1d1d";
        roundedRect(ctx, -c * 0.4, -c * 0.4, c * 0.8, c * 0.8, c * 0.15);
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = Math.max(1, c * 0.08);
        ctx.stroke();
        ctx.strokeStyle = "rgba(239,68,68,0.7)";
        ctx.lineWidth = Math.max(1, c * 0.05);
        ctx.beginPath();
        ctx.moveTo(-c * 0.25, -c * 0.1);
        ctx.lineTo(c * 0.05, c * 0.05);
        ctx.lineTo(c * 0.25, -c * 0.2);
        ctx.moveTo(0, c * 0.4);
        ctx.lineTo(0, c * 0.6);
        ctx.stroke();
        ctx.restore();
      }

      // 우주쓰레기 (반짝이는 파란 점)
      if (g.food.x >= 0) {
        const fx = (g.food.x + 0.5) * c;
        const fy = (g.food.y + 0.5) * c;
        const pulse = 0.75 + 0.25 * Math.sin(now / 280);
        ctx.save();
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = c * 0.6 * pulse;
        ctx.fillStyle = "#7dd3fc";
        ctx.beginPath();
        ctx.arc(fx, fy, c * 0.26 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(186,230,253,${0.8 * pulse})`;
        ctx.lineWidth = Math.max(1, c * 0.06);
        ctx.beginPath();
        ctx.moveTo(fx - c * 0.45 * pulse, fy);
        ctx.lineTo(fx + c * 0.45 * pulse, fy);
        ctx.moveTo(fx, fy - c * 0.45 * pulse);
        ctx.lineTo(fx, fy + c * 0.45 * pulse);
        ctx.stroke();
        ctx.restore();
      }

      // 줍스 꼬리 (에너지 궤적)
      const len = g.snake.length;
      for (let i = len - 1; i >= 1; i--) {
        const seg = g.snake[i];
        const t = i / len;
        const sz = c * (0.74 - 0.28 * t);
        const sx = (seg.x + 0.5) * c - sz / 2;
        const sy = (seg.y + 0.5) * c - sz / 2;
        ctx.save();
        ctx.shadowColor = "rgba(45,212,191,0.5)";
        ctx.shadowBlur = c * 0.25;
        ctx.fillStyle = `rgba(52,211,153,${0.9 - 0.55 * t})`;
        roundedRect(ctx, sx, sy, sz, sz, sz * 0.35);
        ctx.fill();
        ctx.restore();
      }

      // 줍스 머리
      if (len > 0) {
        const head = g.snake[0];
        drawJoopsFace(
          ctx,
          (head.x + 0.5) * c,
          (head.y + 0.5) * c,
          c * 0.95,
          g.dir,
          g.status === "injured" ? "hurt" : "happy"
        );
      }

      // 오버레이 (캔버스 내부 UI)
      if (g.status === "ready") {
        ctx.fillStyle = "rgba(3,7,18,0.72)";
        ctx.fillRect(0, 0, s, s);
        drawJoopsFace(ctx, s * 0.5, s * 0.3, s * 0.17, { x: 0, y: 0 }, "happy");
        ctx.textAlign = "center";
        ctx.fillStyle = "#e0f2fe";
        ctx.font = `bold ${s * 0.065}px sans-serif`;
        ctx.fillText("줍스 스네이크", s * 0.5, s * 0.49);
        ctx.fillStyle = "rgba(224,242,254,0.85)";
        ctx.font = `${s * 0.035}px sans-serif`;
        ctx.fillText("우주쓰레기를 먹고 줍스를 키우세요", s * 0.5, s * 0.57);
        ctx.fillText("붉은 위성 잔해와 벽, 꼬리를 조심!", s * 0.5, s * 0.63);
        ctx.fillStyle = "#7dd3fc";
        ctx.font = `bold ${s * 0.04}px sans-serif`;
        ctx.fillText("탭 또는 방향키로 출발", s * 0.5, s * 0.74);
        ctx.fillStyle = "rgba(224,242,254,0.6)";
        ctx.font = `${s * 0.03}px sans-serif`;
        ctx.fillText("조작: 스와이프 · 방향키(WASD)", s * 0.5, s * 0.81);
      } else if (g.status === "injured") {
        if (performance.now() - g.lastTapAt > TAP_WINDOW_MS) g.taps = 0;
        ctx.fillStyle = "rgba(30,7,7,0.8)";
        ctx.fillRect(0, 0, s, s);
        drawJoopsFace(ctx, s * 0.5, s * 0.28, s * 0.17, { x: 0, y: 0 }, "hurt");
        ctx.textAlign = "center";
        ctx.fillStyle = "#fca5a5";
        ctx.font = `bold ${s * 0.05}px sans-serif`;
        ctx.fillText("줍스가 충돌했습니다!", s * 0.5, s * 0.45);
        ctx.fillStyle = "#fee2e2";
        ctx.font = `${s * 0.038}px sans-serif`;
        ctx.fillText("응급 치료가 필요합니다", s * 0.5, s * 0.52);
        for (let i = 0; i < TAPS_TO_HEAL; i++) {
          drawHeart(ctx, s * (0.5 + (i - 2) * 0.1), s * 0.61, s * 0.055, i < g.taps);
        }
        ctx.fillStyle = "#7dd3fc";
        ctx.font = `bold ${s * 0.035}px sans-serif`;
        ctx.fillText("빠르게 5회 연속 탭하여 치료하세요", s * 0.5, s * 0.72);
        ctx.fillStyle = "rgba(254,226,226,0.7)";
        ctx.font = `${s * 0.03}px sans-serif`;
        ctx.fillText(`점수 ${g.score} · 최고 ${bestScore}`, s * 0.5, s * 0.79);
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;
      if (g.status === "playing") {
        g.acc += dt;
        while (g.acc >= g.tickMs) {
          g.acc -= g.tickMs;
          step();
          if (g.status !== "playing") break;
        }
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const KEY_DIRS: Record<string, Vec> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key] ?? KEY_DIRS[e.key.toLowerCase()];
      if (dir) {
        e.preventDefault();
        if (g.status === "ready") startRun();
        if (g.status === "playing") pushDir(dir);
        return;
      }
      if ((e.key === " " || e.key === "Enter") && g.status === "injured") {
        e.preventDefault();
        healTap();
      }
    };

    let swipeStart: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      if (g.status === "ready") return startRun();
      if (g.status === "injured") return healTap();
      swipeStart = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (g.status !== "playing" || !swipeStart) return;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
      pushDir(
        Math.abs(dx) > Math.abs(dy)
          ? { x: Math.sign(dx), y: 0 }
          : { x: 0, y: Math.sign(dy) }
      );
    };

    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-[#050510] text-white">
      <header className="flex items-center gap-2 p-3 sm:p-4">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[.145] text-lg transition-colors hover:bg-[#1a1a1a]"
        >
          ←
        </Link>
        <h1 className="flex-1 truncate text-base font-bold sm:text-lg">
          줍스 스네이크
        </h1>
        <div className="text-right text-xs leading-tight sm:text-sm">
          <div className="font-semibold text-sky-300">점수 {score}</div>
          <div className="text-white/50">최고 {best}</div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center p-2 sm:p-4">
        <div
          ref={wrapRef}
          className="flex min-h-0 w-full max-w-xl flex-1 items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            className="rounded-2xl border border-white/[.145] touch-none select-none"
          />
        </div>
        <p className="p-2 text-center text-xs text-white/40">
          스와이프 또는 방향키로 조작 · 충돌하면 연타로 줍스를 치료하세요
        </p>
      </main>
    </div>
  );
}
