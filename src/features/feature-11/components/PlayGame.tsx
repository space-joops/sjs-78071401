"use client";
// 줍스 스웜 게임 셸 — pixi.js 초기화/정리 + React DOM 오버레이(HUD·시작·게임오버).
// pixi는 SSR/Turbopack 평가를 피하기 위해 effect 안에서 dynamic import.
// Application.init()이 async라 disposed 체크를 3중(import 후/init 후/cleanup)으로 둔다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Application } from "pixi.js";
import { getSfx } from "../lib/audio";
import {
  EVOLUTION_ICONS,
  EVOLUTION_NAMES,
  RUSH_SECONDS,
  type HudSnapshot,
  type RunStats,
} from "../lib/constants";
import { createSwarmGame, type SwarmGame } from "../lib/game";
import { addCollected, loadSave, mergeRun, saveMuted, stageFor } from "../lib/state";

type Phase = "loading" | "ready" | "playing" | "over" | "error";

type OverResult = {
  stats: RunStats;
  isRecord: boolean;
  evolvedFrom: number;
  evolvedTo: number;
};

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  timeLeft: RUSH_SECONDS,
  combo: 0,
  gauge: 0,
  fever: false,
  wave: 1,
  collected: 0,
};

export default function PlayGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<SwarmGame | null>(null);
  const flushedRef = useRef(0);
  const waveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [fever, setFever] = useState(false);
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(0);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<OverResult | null>(null);
  const [waveToast, setWaveToast] = useState<number | null>(null);
  const [hitFlash, setHitFlash] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const save = loadSave();
    setBest(save.best);
    setMuted(save.muted);
    setStage(stageFor(save.totalCollected));
    const sfx = getSfx();
    sfx.setMuted(save.muted);

    let disposed = false;
    let app: Application | null = null;

    (async () => {
      try {
        const PIXI = await import("pixi.js");
        if (disposed) return;
        const a = new PIXI.Application();
        await a.init({
          resizeTo: host,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          autoDensity: true,
          background: 0x050a16,
          antialias: false,
          preference: "webgl",
          powerPreference: "high-performance",
        });
        if (disposed) {
          // StrictMode: init await 중 cleanup이 먼저 돈 경우 — 즉시 파괴
          a.destroy(true, { children: true, texture: true, textureSource: true });
          return;
        }
        app = a;
        a.canvas.className = "absolute inset-0 touch-none select-none";
        host.appendChild(a.canvas);
        gameRef.current = createSwarmGame(
          PIXI,
          a,
          host,
          {
            onHud: setHud,
            onWave: (w) => {
              if (w <= 1) return;
              setWaveToast(w);
              if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
              waveTimerRef.current = setTimeout(() => setWaveToast(null), 1600);
            },
            onFever: setFever,
            onHit: () => {
              setHitFlash((c) => c + 1);
              if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
              hitTimerRef.current = setTimeout(() => setHitFlash(0), 900);
            },
            onGameOver: (stats) => {
              const merge = mergeRun(stats, flushedRef.current);
              flushedRef.current = stats.collected;
              setBest(merge.save.best);
              setResult({
                stats,
                isRecord: merge.isRecord,
                evolvedFrom: merge.evolvedFrom,
                evolvedTo: merge.evolvedTo,
              });
              if (merge.evolvedTo > merge.evolvedFrom) {
                setStage(merge.evolvedTo);
                gameRef.current?.setEvolutionStage(merge.evolvedTo);
                getSfx().evolve();
              }
              setFever(false);
              setPhase("over");
            },
          },
          sfx,
          stageFor(save.totalCollected),
        );
        setPhase("ready");
      } catch {
        // WebGL 미지원 등 초기화 실패 — 로딩에 멈추지 않게 안내로 전환
        if (!disposed) setPhase("error");
      }
    })();

    return () => {
      disposed = true;
      gameRef.current?.destroy();
      gameRef.current = null;
      const canvas = app?.canvas ?? null;
      app?.destroy(true, { children: true, texture: true, textureSource: true });
      // destroy는 WebGL 컨텍스트를 GC에 맡긴다 — 브라우저 컨텍스트 상한(~16개) 방어
      if (canvas) {
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      }
      app = null;
    };
  }, []);

  // 이탈 시 이번 판 수거량 중간 플러시 + 오디오 절전
  useEffect(() => {
    const flush = () => {
      const g = gameRef.current;
      if (!g) return;
      const collected = g.getCollected();
      const delta = collected - flushedRef.current;
      if (delta > 0) {
        addCollected(delta);
        flushedRef.current = collected;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
        getSfx().suspend();
      } else {
        getSfx().resume();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
      if (hitTimerRef.current) clearTimeout(hitTimerRef.current);
    };
  }, []);

  const start = () => {
    const sfx = getSfx();
    sfx.unlock();
    sfx.uiTap();
    setResult(null);
    setHud(INITIAL_HUD);
    setFever(false);
    setWaveToast(null);
    gameRef.current?.start();
    flushedRef.current = 0;
    setPhase("playing");
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    getSfx().setMuted(next);
    saveMuted(next);
    if (!next) getSfx().uiTap();
  };

  const timeLeft = Math.ceil(hud.timeLeft);
  const inGame = phase === "playing";

  return (
    <div
      ref={hostRef}
      className="font-sans relative h-dvh min-h-dvh touch-none overflow-hidden bg-[#050a16]"
    >
      {/* 상단 HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3">
        <Link
          href="/features/11"
          aria-label="줍스 스웜 허브로 돌아가기"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur"
        >
          ←
        </Link>
        <div className="flex-1 text-center">
          {(inGame || phase === "over") && (
            <div className="inline-flex flex-col items-center">
              <span className="text-2xl font-black tabular-nums text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                {hud.score}
              </span>
              {hud.combo >= 2 && (
                <span className="text-xs font-bold text-teal-300">콤보 ×{hud.combo}</span>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <div
            className={`flex h-11 min-w-16 items-center justify-center rounded-full bg-black/40 px-3 text-sm font-bold tabular-nums backdrop-blur ${
              inGame && timeLeft <= 10 ? "text-red-400" : "text-white"
            }`}
          >
            ⏱ {inGame || phase === "over" ? timeLeft : RUSH_SECONDS}초
          </div>
          {hitFlash > 0 && (
            <span
              key={hitFlash}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 animate-pulse text-sm font-black text-red-400"
            >
              -6초
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-lg backdrop-blur"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* 피버 게이지 */}
      {inGame && (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-10 px-4">
          <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${
                fever
                  ? "animate-pulse bg-amber-300"
                  : "bg-gradient-to-r from-teal-400 to-amber-300"
              }`}
              style={{ width: `${Math.round(hud.gauge)}%` }}
            />
          </div>
        </div>
      )}

      {/* 피버 배너 */}
      {inGame && fever && (
        <p className="pointer-events-none absolute inset-x-0 top-[84px] z-10 animate-pulse text-center text-sm font-black text-amber-300">
          🔥 피버! 점수 ×2 — 빨간 파편도 먹어치우세요!
        </p>
      )}

      {/* 웨이브 토스트 */}
      {inGame && waveToast !== null && (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 z-10 animate-pulse text-center text-xl font-black text-white/90">
          웨이브 {waveToast}
        </p>
      )}

      {/* 초반 조작 힌트 */}
      {inGame && hud.collected < 5 && (
        <p className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 animate-pulse pb-[env(safe-area-inset-bottom)] text-center text-xs text-white/70">
          화면을 드래그해서 줍스로 파편을 빨아들이세요! 빨간 가시 파편은 피하세요!
        </p>
      )}

      {/* 로딩 */}
      {phase === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <p className="animate-pulse text-sm text-white/60">불러오는 중…</p>
        </div>
      )}

      {/* 초기화 실패 */}
      {phase === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0a1024] p-6 text-center text-white">
            <div className="text-4xl" aria-hidden>
              🛠️
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              게임을 실행할 수 없어요.
              <br />이 브라우저는 WebGL을 지원하지 않는 것 같습니다.
            </p>
            <Link
              href="/features/11"
              className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold"
            >
              ← 돌아가기
            </Link>
          </div>
        </div>
      )}

      {/* 시작 오버레이 */}
      {phase === "ready" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0a1024] p-6 text-center text-white">
            <div className="text-5xl" aria-hidden>
              🧲
            </div>
            <h2 className="mt-2 text-lg font-bold">줍스 스웜</h2>
            <p className="mt-1 text-xs text-white/50">
              {EVOLUTION_ICONS[stage]} {EVOLUTION_NAMES[stage]} · 최고 {best}점
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {RUSH_SECONDS}초 동안 궤도의 우주쓰레기를 빨아들이세요.
              <br />
              연속 수거로 게이지를 채우면 <b className="text-amber-300">피버</b>!
              <br />
              <b className="text-red-400">빨간 가시 파편</b>에 부딪히면 -6초.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-black transition-transform active:scale-95"
            >
              대청소 시작
            </button>
          </div>
        </div>
      )}

      {/* 게임오버 모달 */}
      {phase === "over" && result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0a1024] p-6 text-center text-white">
            <div className="text-4xl" aria-hidden>
              ⏱
            </div>
            <h2 className="mt-2 text-lg font-bold">시간 종료!</h2>
            {result.isRecord && (
              <p className="mt-1 text-xs font-semibold text-amber-300">🏆 신기록 달성!</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold tabular-nums text-teal-300">
                  {result.stats.score}
                </div>
                <div className="text-[11px] text-white/50">점수</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold tabular-nums text-sky-300">
                  {result.stats.collected}
                </div>
                <div className="text-[11px] text-white/50">수거</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold tabular-nums text-amber-300">
                  ×{result.stats.bestCombo}
                </div>
                <div className="text-[11px] text-white/50">최대 콤보</div>
              </div>
            </div>
            {result.evolvedTo > result.evolvedFrom && (
              <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3">
                <p className="text-sm font-bold text-amber-300">
                  ✨ 진화! {EVOLUTION_ICONS[result.evolvedTo]}{" "}
                  {EVOLUTION_NAMES[result.evolvedTo]}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  줍스의 모습이 바뀌고 자석 반경이 넓어졌어요
                </p>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={start}
                className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-black transition-transform active:scale-95"
              >
                다시 도전
              </button>
              <Link
                href="/features/11"
                className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold"
              >
                그만하기
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
