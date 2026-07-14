"use client";

// 플레이 화면: WebGL 지구 + 아케이드 캔버스 + HUD(상태 바, 교신, 보살핌)

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getStellar2Store, type Snapshot } from "./store2";
import { EarthRenderer } from "../earthRenderer";
import { ArcadeEngine, type ArcadeHooks } from "./arcade2";
import { groundPointAt, formatEta } from "../orbit";
import { CARE, STAGES } from "./balance";

type Props = { snap: Snapshot; onOpenTrack: () => void };

function Bar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 text-[10px] text-white/60 text-right shrink-0">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export default function PlayView({ snap, onOpenTrack }: Props) {
  const store = getStellar2Store();
  const boxRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const arcadeRef = useRef<HTMLCanvasElement>(null);
  const [glOk, setGlOk] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tip = setTimeout(() => setShowTip(false), 7000);
    return () => clearTimeout(tip);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const glCanvas = glRef.current;
    const arcadeCanvas = arcadeRef.current;
    if (!box || !glCanvas || !arcadeCanvas) return;

    const renderer = new EarthRenderer(glCanvas);
    if (renderer.ok) {
      renderer.loadTextures("/feature-3/earth-day.jpg", "/feature-3/earth-clouds.jpg");
    } else {
      setGlOk(false);
    }

    const hooks: ArcadeHooks = {
      onEat: (tier) => store.eatDebris(tier),
      onHurt: (dmg) => store.collide(dmg),
      onEncounter: () => store.encounter(),
      onGlobalItem: () => store.pickGlobalItem(),
      getStage: () => {
        const s = store.getSnapshot();
        const stage = s?.stage ?? STAGES[0];
        return {
          index: s?.stageIndex ?? 0,
          maxTier: stage.maxTier,
          size: stage.size,
          bodyColor: stage.bodyColor,
          glowColor: stage.glowColor,
        };
      },
      getHealth: () => store.getSnapshot()?.st.health ?? 100,
      getEnergy: () => store.getSnapshot()?.st.energy ?? 100,
      getMood: () => store.getSnapshot()?.st.mood ?? 100,
      isComm: () => store.getSnapshot()?.comm.active ?? false,
    };
    const engine = new ArcadeEngine(arcadeCanvas, hooks);

    const resize = () => {
      const r = box.getBoundingClientRect();
      renderer.resize(r.width, r.height);
      engine.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    engine.start();

    const orbit = store.getSnapshot()?.st.orbit;
    let raf = 0;
    const loop = (t: number) => {
      if (orbit && renderer.ok) {
        const pos = groundPointAt(Date.now(), orbit);
        renderer.render(t / 1000, pos.lat, pos.lon);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      engine.dispose();
      renderer.dispose();
    };
  }, [store]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  const doCare = (kind: "feed" | "repair" | "pet") => {
    const res = store.care(kind);
    if (!res.ok) {
      showToast(res.reason ?? "지금은 안 돼요");
    } else {
      showToast(
        kind === "feed" ? "냠냠! 에너지 회복 🍬" : kind === "repair" ? "수리 완료 🔧" : "기분 최고 💕",
      );
    }
  };

  const comm = snap.comm;
  const glMs = snap.globalLinkRemainMs;

  const careBtn = (kind: "feed" | "repair" | "pet", emoji: string) => {
    const cd = store.careCooldownRemainMs(kind, snap.now);
    const disabled = !comm.active || cd > 0;
    return (
      <button
        key={kind}
        type="button"
        onClick={() => doCare(kind)}
        disabled={disabled}
        className={`pointer-events-auto flex h-12 flex-1 max-w-32 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold backdrop-blur-sm transition-all active:scale-95 ${
          disabled
            ? "bg-white/5 text-white/30 border border-white/5"
            : "bg-white/15 text-white border border-white/20"
        }`}
      >
        <span aria-hidden>{emoji}</span>
        <span>{cd > 0 ? `${Math.ceil(cd / 1000)}초` : CARE[kind].label}</span>
      </button>
    );
  };

  return (
    <div ref={boxRef} className="relative flex-1 min-h-0 overflow-hidden select-none">
      {!glOk && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#02040a] via-[#0a1428] to-[#1a3a5c]" />
      )}
      <canvas ref={glRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={arcadeRef} className="absolute inset-0 h-full w-full" />

      {/* ---- HUD ---- */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* 상단 바 */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <Link
            href="/"
            aria-label="메인으로 돌아가기"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-lg border border-white/10"
          >
            ←
          </Link>
          <div className="flex flex-col items-center pt-1">
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5 border border-white/10">
              <span className="font-bold text-sm">{snap.st.name}</span>
              <span className="text-[10px] text-teal-300">
                Lv.{snap.level} {snap.stage.name}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenTrack}
            className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-3.5 text-sm border border-white/10"
          >
            <span aria-hidden>🗺️</span>
            <span className="font-medium">관제</span>
          </button>
        </div>

        {/* 상태 바 + 교신 칩 */}
        <div className="mt-2 flex items-start justify-between gap-3 px-3">
          <div className="w-40 flex flex-col gap-1 rounded-xl bg-black/35 backdrop-blur-sm p-2 border border-white/10">
            <Bar value={snap.st.health} max={100} color="#f87171" label="체력" />
            <Bar value={snap.st.energy} max={100} color="#fbbf24" label="에너지" />
            <Bar value={snap.st.mood} max={100} color="#f472b6" label="기분" />
            <Bar value={snap.xpInLevel} max={snap.xpNeeded} color="#5eead4" label="XP" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {comm.active ? (
              <span className="rounded-full bg-emerald-400/15 border border-emerald-300/40 px-3 py-1.5 text-[11px] text-emerald-300 font-semibold">
                ● 교신 중 · XP ×2
              </span>
            ) : (
              <span className="rounded-full bg-black/40 border border-white/10 px-3 py-1.5 text-[11px] text-white/60">
                ○ 권역 밖 · 교신 {formatEta(comm.etaSec)}
              </span>
            )}
            {glMs > 0 && (
              <span className="rounded-full bg-amber-400/15 border border-amber-300/40 px-3 py-1.5 text-[11px] text-amber-300 font-semibold">
                ⭐ 글로벌 링크 {Math.floor(glMs / 60000)}:
                {String(Math.floor((glMs % 60000) / 1000)).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        {/* 조작 팁 */}
        {showTip && (
          <p className="mt-4 text-center text-xs text-white/55 transition-opacity">
            드래그로 {snap.st.name} 조종 · 더블 탭 대시(진화 필요) ·{" "}
            <b className="text-white/80">등급이 높은 잔해·위성은 피하세요!</b>
          </p>
        )}

        {/* 토스트 */}
        {toast && (
          <p className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur-sm border border-white/10">
            {toast}
          </p>
        )}

        <div className="flex-1" />

        {/* 하단: 실적 + 보살핌 */}
        <div className="px-3 pb-4 flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <span className="text-[11px] text-white/50">
              🗑️ {snap.st.debrisCleaned.toLocaleString()}개 청소 · 🤝{" "}
              {snap.st.encounters}회 조우
            </span>
            {!comm.active && (
              <span className="text-[11px] text-white/40">
                보살핌은 교신 중에만 가능
              </span>
            )}
          </div>
          <div className="flex justify-center gap-2">
            {careBtn("feed", "🍬")}
            {careBtn("repair", "🔧")}
            {careBtn("pet", "🤍")}
          </div>
        </div>
      </div>
    </div>
  );
}
