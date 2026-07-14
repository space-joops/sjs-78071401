"use client";

// 플레이 화면 — WebGL 지구 배경 + 2D 아케이드 오버레이.
// 드래그/터치로 줍스를 조종해 쓰레기를 먹는다.

import { useEffect, useRef, useState } from "react";
import { Arcade, type ArcadeToast } from "./arcade";
import { EarthRenderer } from "./earthRenderer";
import { groundPointAt } from "./orbit";
import { getJoopsStore, type Snapshot } from "./store";

export default function PlayScreen({
  snap,
  onToast,
  onGoCare,
}: {
  snap: Snapshot;
  onToast: (t: ArcadeToast) => void;
  onGoCare: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;
  const [touched, setTouched] = useState(false);
  const touchedRef = useRef(setTouched);
  touchedRef.current = setTouched;

  const exhausted = snap.st.health <= 15;

  useEffect(() => {
    const wrap = wrapRef.current;
    const glCanvas = glRef.current;
    const ovCanvas = ovRef.current;
    if (!wrap || !glCanvas || !ovCanvas) return;
    const store = getJoopsStore();

    const earth = new EarthRenderer(glCanvas);
    earth.loadTextures("/feature-1/earth-day.jpg", "/feature-1/earth-clouds.jpg");
    const arcade = new Arcade(ovCanvas, store, (t) => toastRef.current(t));

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      earth.resize(r.width, r.height);
      arcade.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let dragging = false;
    const setTarget = (e: PointerEvent) => {
      const r = ovCanvas.getBoundingClientRect();
      arcade.setTarget(e.clientX - r.left, e.clientY - r.top);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      touchedRef.current(true);
      try {
        ovCanvas.setPointerCapture(e.pointerId);
      } catch {}
      setTarget(e);
    };
    const move = (e: PointerEvent) => {
      if (dragging) setTarget(e);
    };
    const up = () => {
      dragging = false;
    };
    ovCanvas.addEventListener("pointerdown", down);
    ovCanvas.addEventListener("pointermove", move);
    ovCanvas.addEventListener("pointerup", up);
    ovCanvas.addEventListener("pointercancel", up);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const s = store.getSnapshot();
      if (s) {
        // 지구는 실제 궤도 직하점을 따라 회전한다 (관제 화면과 동일한 위치)
        const pos = groundPointAt(Date.now(), s.st.orbit);
        earth.render(t / 1000, pos.lat, pos.lon);
        arcade.frame(t, dt, {
          stage: s.stage,
          stageIndex: s.stageIndex,
          exhausted: s.st.health <= 15,
          commActive: s.comm.active,
          energy: s.st.energy,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ovCanvas.removeEventListener("pointerdown", down);
      ovCanvas.removeEventListener("pointermove", move);
      ovCanvas.removeEventListener("pointerup", up);
      ovCanvas.removeEventListener("pointercancel", up);
      earth.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden touch-none select-none">
      <canvas ref={glRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <canvas ref={ovRef} className="absolute inset-0 h-full w-full" aria-label="줍스 조종 영역" />

      {/* 현재 상공 · 교신 상태 */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
        <span className="rounded-full border border-white/10 bg-[#081226]/70 px-3 py-1.5 text-xs text-sky-100 backdrop-blur">
          🛰️ {snap.region.name} 상공
        </span>
        {snap.comm.active && (
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 backdrop-blur">
            📡 {snap.comm.viaGlobalLink ? "글로벌 링크" : "교신 중"} · XP ×2
          </span>
        )}
      </div>

      {/* 조작 안내 */}
      {!touched && !exhausted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <span className="animate-pulse rounded-full bg-black/40 px-4 py-2 text-sm text-white/85 backdrop-blur">
            화면을 드래그해서 {snap.st.name}를 조종하세요 👆
          </span>
        </div>
      )}

      {/* 체력 고갈 오버레이 */}
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
