"use client";

// 줍줍스2 플레이 화면.
//
// v1 대비:
// - 상대 드래그 — 손가락이 줍스를 가리지 않는다 (터치는 손가락 위로 52px 띄움)
// - 첫 pointerdown에서 AudioContext 언락 (iOS 정책)
// - 백그라운드에서 rAF 정지 + 오디오 서스펜드 (배터리)
// - WebGL 컨텍스트 로스 복구 (모바일에서 흔하다)
// - HUD(콤보/품질)는 캔버스에 그리고, React로는 250ms마다만 올려 리렌더를 막는다

import { useEffect, useRef, useState } from "react";
import { ArcadeV2, type ArcadeHud, type ArcadeToast } from "./arcade";
import { getSfx } from "./audio";
import { EarthRenderer } from "../earthRenderer";
import { groundPointAt } from "../orbit";
import { BUDGETS, guessQuality, type Quality } from "./perf";
import { getJoopsStoreV2, type SnapshotV2 } from "./store";

export default function PlayScreenV2({
  snap,
  onToast,
  onGoCare,
  onArcadeReady,
  debug,
}: {
  snap: SnapshotV2;
  onToast: (t: ArcadeToast) => void;
  onGoCare: () => void;
  onArcadeReady: (a: ArcadeV2 | null) => void;
  debug?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;
  const readyRef = useRef(onArcadeReady);
  readyRef.current = onArcadeReady;

  const [touched, setTouched] = useState(false);
  const [hud, setHud] = useState<ArcadeHud | null>(null);
  const touchedRef = useRef(setTouched);
  touchedRef.current = setTouched;

  const exhausted = snap.st.health <= 15;

  useEffect(() => {
    const wrap = wrapRef.current;
    const glCanvas = glRef.current;
    const ovCanvas = ovRef.current;
    if (!wrap || !glCanvas || !ovCanvas) return;

    const store = getJoopsStoreV2();
    const sfx = getSfx();
    const settings = store.getSettings();
    const quality: Quality =
      settings.quality === "auto" ? guessQuality() : settings.quality;

    let earth = new EarthRenderer(glCanvas);
    earth.loadTextures("/feature-1/earth-day.jpg", "/feature-1/earth-clouds.jpg");

    const arcade = new ArcadeV2(ovCanvas, store, (t) => toastRef.current(t), quality);
    arcade.warmup();
    readyRef.current(arcade);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      earth.resize(r.width, r.height);
      arcade.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // 모바일에서 WebGL 컨텍스트는 종종 날아간다 — 복구
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    const onRestored = () => {
      earth.dispose();
      earth = new EarthRenderer(glCanvas);
      earth.loadTextures("/feature-1/earth-day.jpg", "/feature-1/earth-clouds.jpg");
      resize();
    };
    glCanvas.addEventListener("webglcontextlost", onLost);
    glCanvas.addEventListener("webglcontextrestored", onRestored);

    // ---- 포인터: 상대 드래그 ----
    let dragging = false;
    const local = (e: PointerEvent) => {
      const r = ovCanvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      touchedRef.current(true);
      sfx.unlock(); // iOS는 제스처 안에서만 오디오가 열린다
      try {
        ovCanvas.setPointerCapture(e.pointerId);
      } catch {}
      const p = local(e);
      const coarse = e.pointerType !== "mouse";
      arcade.beginDrag(p.x, p.y, coarse, store.getSettings().relativeDrag && coarse);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const p = local(e);
      arcade.dragTo(p.x, p.y);
    };
    const up = () => {
      dragging = false;
      arcade.endDrag();
    };
    ovCanvas.addEventListener("pointerdown", down);
    ovCanvas.addEventListener("pointermove", move);
    ovCanvas.addEventListener("pointerup", up);
    ovCanvas.addEventListener("pointercancel", up);

    // ---- 루프 ----
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;

    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const s = store.getSnapshot();
      if (s) {
        const set = s.st.settings;
        const pos = groundPointAt(Date.now(), s.st.orbit);
        earth.render(t / 1000, pos.lat, pos.lon);
        arcade.frame(dt, {
          stage: s.stage,
          stageIndex: s.stageIndex,
          exhausted: s.st.health <= 15,
          commActive: s.comm.active,
          energy: s.st.energy,
          sound: set.sound,
          haptics: set.haptics,
          relativeDrag: set.relativeDrag,
        });
        // HUD는 250ms마다만 React로 — 매 프레임 setState하면 모바일에서 60fps가 무너진다
        if (t - hudAt > 250) {
          hudAt = t;
          setHud(arcade.hud());
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // 백그라운드에서는 완전히 멈춘다 (배터리 + 복귀 시 dt 폭주 방지)
    const onVis = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        sfx.suspend();
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      glCanvas.removeEventListener("webglcontextlost", onLost);
      glCanvas.removeEventListener("webglcontextrestored", onRestored);
      ovCanvas.removeEventListener("pointerdown", down);
      ovCanvas.removeEventListener("pointermove", move);
      ovCanvas.removeEventListener("pointerup", up);
      ovCanvas.removeEventListener("pointercancel", up);
      earth.dispose();
      readyRef.current(null);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 touch-none select-none overflow-hidden overscroll-none [-webkit-touch-callout:none]"
    >
      <canvas ref={glRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <canvas ref={ovRef} className="absolute inset-0 h-full w-full" aria-label="줍스 조종 영역" />

      {/* 상태 칩 — 세이프에어리어를 존중 */}
      <div
        className="pointer-events-none absolute flex flex-col items-start gap-1.5"
        style={{
          left: "max(0.75rem, env(safe-area-inset-left))",
          top: "0.75rem",
        }}
      >
        <span className="rounded-full border border-white/10 bg-[#081226]/70 px-3 py-1.5 text-xs text-sky-100 backdrop-blur">
          🛰️ {snap.region.name} 상공
        </span>
        {snap.comm.active && (
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 backdrop-blur">
            📡 {snap.comm.viaGlobalLink ? "글로벌 링크" : "교신 중"} · XP ×2
          </span>
        )}
        {snap.streakMult > 1 && (
          <span className="rounded-full border border-amber-300/25 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur">
            🔥 {snap.st.streak.count}일 연속 · XP ×{snap.streakMult.toFixed(2)}
          </span>
        )}
      </div>

      {debug && hud && (
        <div
          className="pointer-events-none absolute rounded-lg bg-black/60 px-2 py-1 font-mono text-[10px] leading-relaxed text-lime-300"
          style={{ right: "max(0.5rem, env(safe-area-inset-right))", top: "0.5rem" }}
        >
          fps {hud.fps} · {hud.quality}
          <br />
          dpr {BUDGETS[hud.quality].dpr} · combo {hud.combo}
        </div>
      )}

      {!touched && !exhausted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-4">
          <span className="animate-pulse rounded-full bg-black/45 px-4 py-2 text-center text-sm text-white/85 backdrop-blur">
            화면을 드래그하세요 👆 {snap.st.name}가 손가락 위로 따라와요
          </span>
        </div>
      )}

      {exhausted && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#050a16]/70 p-6 backdrop-blur-sm">
          <div className="text-4xl">💫</div>
          <p className="text-center text-base font-semibold text-white">
            {snap.st.name}가 너무 지쳤어요
          </p>
          <p className="max-w-xs text-center text-sm text-white/65">
            충돌로 체력이 고갈됐어요. 주인의 보살핌이 필요해요.
          </p>
          <button
            onClick={onGoCare}
            className="h-12 rounded-full bg-emerald-400 px-6 text-sm font-bold text-emerald-950 transition-transform active:scale-95"
          >
            돌보러 가기 💚
          </button>
        </div>
      )}
    </div>
  );
}
