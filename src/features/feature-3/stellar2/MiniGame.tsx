"use client";

// 회피 훈련 미니게임 (개선 지시서 Phase 2-6)
// 3개 궤도 레인 위에서 좌/우 탭으로 이동하며 낙하하는 케슬러 파편을 피하고
// 스파크를 모은다. 성적(점수)이 XP·기분에 반영된다.

import { useEffect, useRef, useState } from "react";
import { getStellar2Store } from "./store2";
import { TRAIN, DEBRIS_TIERS } from "./balance";
import { loadSprites2 } from "./sprites2";
import { sfx } from "./audio";

type Result = {
  score: number;
  dodged: number;
  sparks: number;
  xpGained: number;
  isBest: boolean;
};

type Falling = {
  kind: "hazard" | "spark";
  lane: number;
  y: number;
  v: number;
  tier: number;
  rot: number;
};

const TAU = Math.PI * 2;

export default function MiniGame({ onClose }: { onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [hud, setHud] = useState<{ timeLeft: number; score: number; lives: number }>({
    timeLeft: TRAIN.durationSec,
    score: 0,
    lives: TRAIN.lives,
  });

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const store = getStellar2Store();
    const sprites = loadSprites2();
    const snap = store.getSnapshot();
    const stageIndex = snap?.stageIndex ?? 0;
    const branch = snap?.branch ?? "none";
    const glow = snap?.branchDef?.glowColor ?? snap?.stage.glowColor ?? "#4dd0c0";

    let w = 0;
    let h = 0;
    const resize = () => {
      const r = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const laneX = (lane: number) => w * (0.25 + lane * 0.25);
    let lane = 1;
    let joopsX = 0;
    let joopsInit = false;
    let t = 0;
    let spawnT = 0.8;
    let score = 0;
    let dodged = 0;
    let sparks = 0;
    let lives: number = TRAIN.lives;
    let flash = 0;
    let running = true;
    const falling: Falling[] = [];

    const finish = () => {
      if (!running) return;
      running = false;
      const res = store.applyTraining(score);
      sfx.levelUp();
      setResult({ score, dodged, sparks, xpGained: res.xpGained, isBest: res.isBest });
    };

    const onPointer = (e: PointerEvent) => {
      if (!running) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      lane = x < w / 2 ? Math.max(0, lane - 1) : Math.min(2, lane + 1);
      sfx.tap();
    };
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointer);

    let raf = 0;
    let lastT = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      if (running) {
        t += dt;
        if (t >= TRAIN.durationSec) finish();

        // 스폰 (시간이 지날수록 촘촘하게)
        spawnT -= dt;
        if (spawnT <= 0) {
          const isSpark = Math.random() < TRAIN.sparkChance;
          const tier = 1 + Math.floor(Math.random() * 4);
          falling.push({
            kind: isSpark ? "spark" : "hazard",
            lane: Math.floor(Math.random() * 3),
            y: -40,
            v: 200 + t * 6 + (isSpark ? 0 : tier * 12),
            tier,
            rot: Math.random() * TAU,
          });
          spawnT = Math.max(TRAIN.minSpawnSec, TRAIN.spawnSec - t * 0.015);
        }

        const jy = h * 0.8;
        if (!joopsInit) {
          joopsX = laneX(lane);
          joopsInit = true;
        }
        joopsX += (laneX(lane) - joopsX) * Math.min(1, dt * 14);

        for (let i = falling.length - 1; i >= 0; i--) {
          const f = falling[i];
          f.y += f.v * dt;
          f.rot += dt * 1.5;
          const hitR = f.kind === "spark" ? 40 : 26 + f.tier * 4;
          if (Math.abs(f.y - jy) < hitR && Math.abs(laneX(f.lane) - joopsX) < w * 0.11) {
            if (f.kind === "spark") {
              score += 2;
              sparks += 1;
              sfx.eat(1);
            } else {
              lives -= 1;
              flash = 0.6;
              sfx.hurt();
              if (lives <= 0) finish();
            }
            falling.splice(i, 1);
            continue;
          }
          if (f.y > h + 40) {
            if (f.kind === "hazard") {
              dodged += 1;
              score += 1;
            }
            falling.splice(i, 1);
          }
        }
        flash = Math.max(0, flash - dt * 1.8);

        setHud((prev) => {
          const next = {
            timeLeft: Math.max(0, Math.ceil(TRAIN.durationSec - t)),
            score,
            lives,
          };
          return prev.timeLeft === next.timeLeft &&
            prev.score === next.score &&
            prev.lives === next.lives
            ? prev
            : next;
        });
      }

      // ---- 그리기 ----
      ctx.clearRect(0, 0, w, h);
      // 레인 가이드
      ctx.strokeStyle = "rgba(94,234,212,0.18)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      for (let l = 0; l < 3; l++) {
        ctx.beginPath();
        ctx.moveTo(laneX(l), 0);
        ctx.lineTo(laneX(l), h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 낙하물
      for (const f of falling) {
        const x = laneX(f.lane);
        if (f.kind === "spark") {
          ctx.save();
          ctx.translate(x, f.y);
          ctx.rotate(f.rot);
          ctx.fillStyle = "#fde68a";
          ctx.shadowColor = "#fbbf24";
          ctx.shadowBlur = 14;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const rr = i % 2 === 0 ? 13 : 6;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const img = sprites.debris[f.tier - 1];
          const s = Math.max(30, DEBRIS_TIERS[f.tier - 1].radius * 3.2);
          ctx.save();
          ctx.translate(x, f.y);
          ctx.rotate(f.rot);
          if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
          else {
            ctx.fillStyle = "#94a3b8";
            ctx.beginPath();
            ctx.arc(0, 0, s / 3, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // 줍스
      const jy = h * 0.8;
      const jImg =
        (branch !== "none" ? sprites.joopsByBranch[branch] : null) ??
        sprites.joopsByStage[stageIndex];
      const jw = 84;
      ctx.save();
      ctx.translate(joopsInit ? joopsX : laneX(1), jy);
      ctx.rotate((laneX(lane) - joopsX) * 0.002);
      ctx.shadowColor = glow;
      ctx.shadowBlur = 20;
      if (jImg) ctx.drawImage(jImg, -jw / 2, -jw / 2, jw, jw);
      else {
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // 피격 플래시
      if (flash > 0) {
        ctx.fillStyle = `rgba(220,38,38,${0.28 * flash})`;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#03060f]/97">
      {/* 훈련 HUD */}
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold tabular-nums">
          ⏱ {hud.timeLeft}s
        </span>
        <span className="text-sm font-bold text-teal-300 tabular-nums">
          점수 {hud.score}
        </span>
        <span className="text-sm" aria-label={`남은 생명 ${hud.lives}개`}>
          {"❤️".repeat(Math.max(0, hud.lives))}
          {"🖤".repeat(Math.max(0, TRAIN.lives - hud.lives))}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="훈련 그만두기"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-base"
        >
          ✕
        </button>
      </div>
      <p className="shrink-0 pb-1 text-center text-[11px] text-white/45">
        화면 왼쪽/오른쪽을 탭해 레인을 바꾸세요 — 파편은 피하고 ⭐는 모으세요
      </p>
      <div ref={boxRef} className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* 결과 */}
      {result && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-[#0b1220] border border-white/10 p-5 text-center flex flex-col gap-3">
            <span className="text-4xl" aria-hidden>
              🎯
            </span>
            <h3 className="text-lg font-bold">훈련 종료!</h3>
            <p className="text-3xl font-bold text-teal-300 tabular-nums">
              {result.score}점 {result.isBest && <span className="text-sm text-amber-300">신기록!</span>}
            </p>
            <p className="text-xs text-white/60">
              회피 {result.dodged}회 · 스파크 {result.sparks}개
            </p>
            <p className="text-sm text-white/80">
              보상: <b className="text-teal-300">+{result.xpGained} XP</b> · 기분 +
              {TRAIN.moodGain}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl bg-teal-400 text-black font-bold active:scale-[0.98] transition-transform"
            >
              돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
