"use client";

// 줍스 딥오비트 — React 셸.
// three.js 씬은 game.ts가 소유하고, 여기서는 HUD·오버레이·드래그 입력만 담당한다.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createGame, type Game, type Hud, type Popup } from "./game";
import { DEBRIS_TIERS, RUN } from "./constants";
import { EMPTY_RECORDS, getRecordStore, type RunResult } from "./store";

const INITIAL_HUD: Hud = {
  phase: "ready",
  score: 0,
  level: 1,
  stageName: "유생 줍스",
  maxTier: 1,
  lives: RUN.lives,
  combo: 0,
  comboMult: 1,
  xpInLevel: 0,
  xpNeeded: 24,
  speed: RUN.baseSpeed,
  debris: 0,
};

export default function DeepOrbit() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const store = getRecordStore();
  const records = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY_RECORDS,
  );

  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [result, setResult] = useState<(RunResult & { isBest: boolean }) | null>(null);

  const onHud = useCallback((h: Hud) => setHud(h), []);

  const onPopup = useCallback((p: Popup) => {
    setPopups((prev) => [...prev.slice(-2), p]);
    setTimeout(() => setPopups((prev) => prev.filter((x) => x.id !== p.id)), 1600);
  }, []);

  const onGameOver = useCallback(
    (r: RunResult) => {
      const isBest = getRecordStore().submit(r);
      setResult({ ...r, isBest });
    },
    [],
  );

  useEffect(() => {
    store.load();
  }, [store]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const game = createGame(wrap, onHud, onPopup, onGameOver);
    gameRef.current = game;

    // ---- 드래그 입력: 화면 좌표 → 정규화(-1~1) → 플레이 영역 ----
    let dragging = false;
    const aimFrom = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      // 화면 y는 아래로 증가, 월드 y는 위로 증가 → 부호 반전
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      game.aim(nx, ny);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      try {
        wrap.setPointerCapture(e.pointerId);
      } catch {}
      aimFrom(e);
    };
    const move = (e: PointerEvent) => {
      if (dragging) aimFrom(e);
    };
    const up = () => {
      dragging = false;
    };
    wrap.addEventListener("pointerdown", down);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(() => game.resize());
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      wrap.removeEventListener("pointerdown", down);
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerup", up);
      wrap.removeEventListener("pointercancel", up);
      game.dispose();
      gameRef.current = null;
    };
  }, [onHud, onPopup, onGameOver]);

  const start = () => {
    setResult(null);
    gameRef.current?.start();
  };

  const playing = hud.phase === "playing" && !result;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden overscroll-none bg-[#050a16] font-sans text-white">
      {/* 3D 캔버스 */}
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none select-none [-webkit-touch-callout:none]"
        aria-label="줍스 조종 영역"
      />

      {/* 상단 HUD */}
      <header
        className="pointer-events-none relative z-10 flex items-start justify-between p-3"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <Link
          href="/"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-lg text-white/80 backdrop-blur transition-colors hover:bg-black/60"
          aria-label="메인으로 돌아가기"
        >
          ←
        </Link>

        {playing && (
          <div className="flex flex-col items-end gap-1">
            <p className="font-mono text-2xl font-bold tabular-nums drop-shadow">
              {hud.score.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: RUN.lives }, (_, i) => (
                <span key={i} className={i < hud.lives ? "text-base" : "text-base opacity-25"}>
                  {i < hud.lives ? "💚" : "🖤"}
                </span>
              ))}
            </div>
            {hud.combo >= 4 && (
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-200 backdrop-blur">
                {hud.combo} COMBO ×{hud.comboMult}
              </span>
            )}
          </div>
        )}
      </header>

      {/* 하단 상태 바 */}
      {playing && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          }}
        >
          <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-black/40 p-2.5 backdrop-blur">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-semibold text-cyan-200">
                Lv.{hud.level} {hud.stageName}
              </span>
              <span className="font-mono text-white/50">
                {hud.maxTier}등급까지 흡수 · {hud.speed}u/s
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, (hud.xpInLevel / Math.max(1, hud.xpNeeded)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 팝업 */}
      <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex flex-col items-center gap-1 px-4">
        {popups.map((p) => (
          <span
            key={p.id}
            className="animate-pulse rounded-full bg-black/50 px-4 py-1.5 text-sm font-bold backdrop-blur"
            style={{ color: p.color }}
          >
            {p.text}
          </span>
        ))}
      </div>

      {/* 시작 화면 */}
      {hud.phase === "ready" && !result && (
        <Overlay>
          <p className="text-4xl">🌌</p>
          <h1 className="mt-2 text-2xl font-bold">줍스 딥오비트</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-white/65">
            지구 저궤도를 비행하며 다가오는 우주쓰레기를 삼키세요.
            <br />
            <b className="text-cyan-300">화면을 드래그</b>하면 줍스가 따라옵니다.
          </p>

          <div className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-relaxed text-white/70">
            <p className="mb-1.5 font-bold text-white/85">규칙</p>
            <p>
              <span className="text-cyan-300">◎ 시안 링</span> — 삼킬 수 있어요 (XP +)
            </p>
            <p>
              <span className="text-rose-400">◎ 빨간 링</span> — 아직 못 먹어요. 피하세요! (체력 -1)
            </p>
            <p className="mt-1.5 text-white/50">
              레벨이 오르면 더 큰 쓰레기를 삼킬 수 있어요:
              <br />
              {DEBRIS_TIERS.map((d) => d.name).join(" → ")}
            </p>
          </div>

          {records.bestScore > 0 && (
            <p className="mt-3 font-mono text-xs text-amber-200">
              🏆 최고 {records.bestScore.toLocaleString()}점 · 최고 Lv.{records.bestLevel} ·{" "}
              {records.totalRuns}회 비행
            </p>
          )}

          <button
            onClick={start}
            className="mt-4 h-14 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 text-base font-bold text-slate-900 transition-transform active:scale-[0.98]"
          >
            궤도 진입 🚀
          </button>
        </Overlay>
      )}

      {/* 게임 오버 */}
      {result && (
        <Overlay>
          <p className="text-4xl">{result.isBest ? "🏆" : "💫"}</p>
          <h2 className="mt-2 text-xl font-bold">
            {result.isBest ? "신기록!" : "궤도 이탈"}
          </h2>
          <p className="mt-3 font-mono text-4xl font-bold tabular-nums text-cyan-200">
            {result.score.toLocaleString()}
          </p>

          <div className="mt-4 grid w-full grid-cols-3 gap-2">
            <Stat label="도달 레벨" value={`Lv.${result.level}`} />
            <Stat label="최고 콤보" value={`${result.bestCombo}`} />
            <Stat label="청소" value={`${result.debris}개`} />
          </div>

          <p className="mt-3 font-mono text-xs text-white/45">
            🏆 최고 {records.bestScore.toLocaleString()}점 · 누적{" "}
            {records.totalDebris.toLocaleString()}개 청소
          </p>

          <button
            onClick={start}
            className="mt-4 h-14 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 text-base font-bold text-slate-900 transition-transform active:scale-[0.98]"
          >
            다시 비행 🚀
          </button>
          <Link
            href="/"
            className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-white/70"
          >
            메인으로
          </Link>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#050a16]/75 p-5 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-[#0b1428]/90 p-5">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-2 text-center">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] text-white/45">{label}</p>
    </div>
  );
}
