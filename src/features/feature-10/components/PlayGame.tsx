"use client";
// 점프 러너 게임 셸 — kaplay 초기화/정리 + React DOM 오버레이(HUD·시작·게임오버).
// kaplay는 SSR/Turbopack 평가를 피하기 위해 effect 안에서 dynamic import.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { KAPLAYCtx } from "kaplay";
import type { GameStats } from "../lib/constants";
import { createJumpRunner, type JumpRunner } from "../lib/game";
import { loadBest, saveBest } from "../lib/state";

type Phase = "loading" | "ready" | "playing" | "over" | "error";

export default function PlayGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<JumpRunner | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<GameStats | null>(null);
  const [isRecord, setIsRecord] = useState(false);

  useEffect(() => {
    setBest(loadBest());
    const host = hostRef.current;
    if (!host) return;
    // StrictMode 이중 이펙트: cleanup이 import resolve보다 먼저 돌면 init을 건너뛴다
    let disposed = false;
    let k: KAPLAYCtx | null = null;
    let canvas: HTMLCanvasElement | null = null;

    (async () => {
      try {
        const { default: kaplay } = await import("kaplay");
        if (disposed) return;
        // 캔버스는 마운트마다 새로 생성 — 이전 인스턴스의 WebGL 컨텍스트/리스너 잔재 차단
        canvas = document.createElement("canvas");
        canvas.className = "absolute inset-0 h-full w-full";
        host.appendChild(canvas);
        k = kaplay({
          canvas,
          global: false,
          pixelDensity: Math.min(2, window.devicePixelRatio || 1),
          background: "#03030d",
          touchToMouse: true,
          debug: false,
        });
        gameRef.current = createJumpRunner(k, {
          onScore: setScore,
          onGameOver: (stats) => {
            setResult(stats);
            setIsRecord(saveBest(stats.score));
            setBest(loadBest());
            setPhase("over");
          },
        });
        setPhase("ready");
      } catch {
        // WebGL 미지원 등 초기화 실패 — "불러오는 중"에 멈추지 않게 안내로 전환
        if (!disposed) setPhase("error");
      }
    })();

    return () => {
      disposed = true;
      gameRef.current = null;
      try {
        k?.quit();
      } catch {
        // 이미 정리된 인스턴스면 무시
      }
      // quit()은 WebGL 컨텍스트를 GC에 맡긴다 — 브라우저 컨텍스트 상한(~16개) 방어
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      canvas?.remove();
      k = null;
      canvas = null;
    };
  }, []);

  const start = () => {
    setResult(null);
    setScore(0);
    setPhase("playing");
    gameRef.current?.restart();
  };

  return (
    <div
      ref={hostRef}
      className="font-sans relative h-dvh touch-none overflow-hidden bg-[#03030d]"
    >
      {/* 상단 HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3">
        <Link
          href="/features/10"
          aria-label="점프 러너 허브로 돌아가기"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur"
        >
          ←
        </Link>
        <div className="flex-1 text-center">
          {phase !== "ready" && phase !== "loading" && (
            <span className="text-2xl font-black tabular-nums text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              {score}
            </span>
          )}
        </div>
        <div className="flex h-11 min-w-11 items-center justify-center rounded-full bg-black/40 px-3 text-xs font-semibold tabular-nums text-amber-200 backdrop-blur">
          ★ {best}
        </div>
      </div>

      {/* 플레이 초반 조작 힌트 */}
      {phase === "playing" && score < 5 && (
        <p className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 animate-pulse text-center text-xs text-white/70">
          화면을 탭해서 점프!
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
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b22] p-6 text-center text-white">
            <div className="text-4xl" aria-hidden>
              🛠️
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              게임을 실행할 수 없어요.
              <br />
              이 브라우저는 WebGL을 지원하지 않는 것 같습니다.
            </p>
            <Link
              href="/features/10"
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
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b22] p-6 text-center text-white">
            <div className="text-5xl" aria-hidden>
              🌠
            </div>
            <h2 className="mt-2 text-lg font-bold">점프 러너</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              줍스가 달 표면을 자동으로 질주합니다.
              <br />
              화면 탭(또는 스페이스)으로 점프해 우주쓰레기를 넘고, 별 조각을
              모으세요!
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-black transition-transform active:scale-95"
            >
              게임 시작
            </button>
          </div>
        </div>
      )}

      {/* 게임오버 모달 */}
      {phase === "over" && result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b22] p-6 text-center text-white">
            <div className="text-4xl" aria-hidden>
              💥
            </div>
            <h2 className="mt-2 text-lg font-bold">게임 오버</h2>
            {isRecord && (
              <p className="mt-1 text-xs font-semibold text-amber-300">
                🏆 신기록 달성!
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold tabular-nums text-teal-300">
                  {result.score}
                </div>
                <div className="text-[11px] text-white/50">점수</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold tabular-nums text-amber-300">
                  {result.stars}
                </div>
                <div className="text-[11px] text-white/50">별 조각</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-lg font-bold tabular-nums text-sky-300">
                  {result.time}초
                </div>
                <div className="text-[11px] text-white/50">생존</div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={start}
                className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-black transition-transform active:scale-95"
              >
                다시 도전
              </button>
              <Link
                href="/features/10"
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
