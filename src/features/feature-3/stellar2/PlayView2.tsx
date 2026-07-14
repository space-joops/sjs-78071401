"use client";

// 플레이 화면: WebGL 지구 + 아케이드 캔버스 + HUD(상태 바, 교신, 보살핌)

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getStellar2Store, type Snapshot } from "./store2";
import { EarthRenderer } from "../earthRenderer";
import { ArcadeEngine, type ArcadeHooks } from "./arcade2";
import { groundPointAt, formatEta } from "../orbit";
import { CARE, STAGES, HATCH_TAPS } from "./balance";
import { sfx } from "./audio";
import MiniGame from "./MiniGame";
import CodexModal from "./CodexModal";

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
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${label} ${Math.round(value)} / ${max}`}
    >
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
  const [training, setTraining] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  /** 튜토리얼 2·3단계 진행 (1단계는 청소 수로 자동 진행) */
  const [tutPage, setTutPage] = useState(2);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tip = setTimeout(() => setShowTip(false), 7000);
    return () => clearTimeout(tip);
  }, []);

  // 업적 토스트 자동 닫힘
  const achNotice = store.achievementNotices[0] ?? null;
  useEffect(() => {
    if (!achNotice) return;
    const t = setTimeout(() => store.ackAchievementNotice(), 2400);
    return () => clearTimeout(t);
  }, [achNotice, store]);

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
      onEat: (tier) => {
        const before = store.getSnapshot()?.level ?? 1;
        const xp = store.eatDebris(tier);
        sfx.eat(tier);
        if ((store.getSnapshot()?.level ?? 1) > before) sfx.levelUp();
        return xp;
      },
      onHurt: (dmg) => {
        store.collide(dmg);
        sfx.hurt();
      },
      onEncounter: () => {
        sfx.encounter();
        return store.encounter();
      },
      onGlobalItem: () => {
        store.pickGlobalItem();
        sfx.item();
      },
      onShowerStart: () => {
        store.startShower();
        sfx.item();
      },
      getStage: () => {
        const s = store.getSnapshot();
        const stage = s?.stage ?? STAGES[0];
        const branch = s?.branchDef ?? null;
        return {
          index: s?.stageIndex ?? 0,
          maxTier: stage.maxTier,
          size: stage.size,
          bodyColor: branch?.bodyColor ?? stage.bodyColor,
          glowColor: branch?.glowColor ?? stage.glowColor,
        };
      },
      getHealth: () => store.getSnapshot()?.st.health ?? 100,
      getEnergy: () => store.getSnapshot()?.st.energy ?? 100,
      getMood: () => store.getSnapshot()?.st.mood ?? 100,
      isComm: () => store.getSnapshot()?.comm.active ?? false,
      isHatched: () => store.getSnapshot()?.st.hatched ?? true,
      getEggTaps: () => store.getSnapshot()?.st.hatchTaps ?? 0,
      onEggTap: () => {
        const was = store.getSnapshot()?.st.hatched ?? false;
        store.tapEgg();
        if (!was && store.getSnapshot()?.st.hatched) sfx.hatch();
        else sfx.tap();
      },
      getBranch: () => store.getSnapshot()?.branch ?? "none",
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

    // 절전: 탭이 숨겨지면 게임 루프·오디오 정지
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        engine.stop();
        sfx.suspend();
      } else {
        engine.start();
        sfx.resume();
      }
    };
    document.addEventListener("visibilitychange", onVis);

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
      document.removeEventListener("visibilitychange", onVis);
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
      sfx.care();
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
    <div
      ref={boxRef}
      className="relative flex-1 min-h-0 overflow-hidden select-none"
      onPointerDown={() => sfx.unlock()}
    >
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
                {snap.st.hatched
                  ? `Lv.${snap.level} ${snap.branchDef?.name ?? snap.stage.name}`
                  : "알"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCodexOpen(true)}
              aria-label="도감과 업적 열기"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-base border border-white/10"
            >
              <span aria-hidden>📔</span>
            </button>
            <button
              type="button"
              onClick={() => store.toggleMuted()}
              aria-label={snap.muted ? "효과음 켜기" : "효과음 끄기"}
              aria-pressed={snap.muted}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-base border border-white/10"
            >
              <span aria-hidden>{snap.muted ? "🔇" : "🔊"}</span>
            </button>
            <button
              type="button"
              onClick={onOpenTrack}
              className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-3.5 text-sm border border-white/10"
            >
              <span aria-hidden>🗺️</span>
              <span className="font-medium">관제</span>
            </button>
          </div>
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
            {snap.showerRemainMs > 0 && (
              <span className="rounded-full bg-orange-400/20 border border-orange-300/50 px-3 py-1.5 text-[11px] text-orange-200 font-semibold">
                ☄️ 소나기 {Math.ceil(snap.showerRemainMs / 1000)}s · XP ×1.5
              </span>
            )}
          </div>
        </div>

        {/* 알 모드 안내 */}
        {!snap.st.hatched && (
          <p className="mt-4 text-center text-sm font-semibold text-teal-200">
            🥚 알을 톡톡 두드려 깨워주세요 ({snap.st.hatchTaps}/{HATCH_TAPS})
          </p>
        )}

        {/* 조작 팁 */}
        {showTip && snap.st.hatched && (
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

        {/* 하단: 실적 + 보살핌 (부화 후에만) */}
        <div className={`px-3 pb-4 flex-col gap-2 ${snap.st.hatched ? "flex" : "hidden"}`}>
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
            {(() => {
              const cd = store.trainCooldownRemainMs(snap.now);
              const disabled = cd > 0;
              return (
                <button
                  type="button"
                  onClick={() => setTraining(true)}
                  disabled={disabled}
                  aria-label="회피 훈련 시작"
                  className={`pointer-events-auto flex h-12 flex-1 max-w-32 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold backdrop-blur-sm transition-all active:scale-95 ${
                    disabled
                      ? "bg-white/5 text-white/30 border border-white/5"
                      : "bg-amber-400/20 text-amber-200 border border-amber-300/30"
                  }`}
                >
                  <span aria-hidden>🎯</span>
                  <span>{disabled ? `${Math.ceil(cd / 60000)}분` : "훈련"}</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 온보딩 튜토리얼 (부화 후 3단계) */}
      {snap.st.hatched && !snap.st.tutorialDone && !training && !codexOpen && (
        <div className="absolute inset-x-3 bottom-24 z-10 mx-auto max-w-sm rounded-2xl bg-[#0b1220]/95 border border-teal-300/30 p-4 backdrop-blur-sm">
          {snap.st.debrisCleaned < 3 ? (
            <>
              <p className="text-xs font-bold text-teal-300">튜토리얼 1/3</p>
              <p className="mt-1 text-sm text-white/85">
                화면을 드래그해 {snap.st.name}를 조종하고, 작은 우주쓰레기를{" "}
                <b>3개</b> 먹여보세요. ({snap.st.debrisCleaned}/3)
              </p>
            </>
          ) : tutPage === 2 ? (
            <>
              <p className="text-xs font-bold text-teal-300">튜토리얼 2/3</p>
              <p className="mt-1 text-sm text-white/85">
                잘했어요! 왼쪽 위 <b>체력·에너지·기분</b> 바를 확인하세요. 시간이
                지나면 줄어들고, 낮아지면 표정이 시무룩해져요.
              </p>
              <button
                type="button"
                onClick={() => setTutPage(3)}
                className="mt-3 h-11 w-full rounded-xl bg-white/10 text-sm font-semibold"
              >
                다음
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-teal-300">튜토리얼 3/3</p>
              <p className="mt-1 text-sm text-white/85">
                교신 중(● 표시)에는 <b>먹이·수리·쓰다듬기</b>로 보살필 수 있고,{" "}
                <b>🎯 훈련</b>으로 경험치를 벌 수 있어요. 접속하지 않아도{" "}
                {snap.st.name}는 궤도를 돌며 청소를 계속한답니다!
              </p>
              <button
                type="button"
                onClick={() => store.completeTutorial()}
                className="mt-3 h-11 w-full rounded-xl bg-teal-400 text-sm font-bold text-black"
              >
                시작하기!
              </button>
            </>
          )}
        </div>
      )}

      {/* 업적 달성 토스트 */}
      {achNotice && (
        <div
          role="status"
          className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-300/95 px-4 py-2 text-black shadow-lg"
        >
          <span aria-hidden>{achNotice.icon}</span>
          <span className="text-xs font-bold whitespace-nowrap">
            업적 달성 — {achNotice.name}
          </span>
        </div>
      )}

      {/* 도감·업적 */}
      {codexOpen && <CodexModal snap={snap} onClose={() => setCodexOpen(false)} />}

      {/* 회피 훈련 미니게임 */}
      {training && <MiniGame onClose={() => setTraining(false)} />}

      {/* 일일 보급 */}
      {snap.hasDaily && snap.st.hatched && !training && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-[#0b1220] border border-white/10 p-5 text-center flex flex-col gap-3">
            <span className="text-4xl" aria-hidden>
              📦
            </span>
            <h3 className="text-lg font-bold">일일 보급 도착!</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              오늘의 첫 교신 보상이에요
              <br />
              에너지 +30 · XP +100 · 글로벌 링크 5분
            </p>
            <button
              type="button"
              onClick={() => {
                store.claimDaily();
                sfx.item();
                showToast("보급 수령 완료! 📦");
              }}
              className="h-11 rounded-xl bg-teal-400 text-black font-bold active:scale-[0.98] transition-transform"
            >
              보급 받기
            </button>
          </div>
        </div>
      )}

      {/* 진화 분기 알림 */}
      {store.branchNotice && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-[#0b1220] border border-amber-300/30 p-5 text-center flex flex-col gap-3">
            <span className="text-4xl" aria-hidden>
              ✨
            </span>
            <h3 className="text-lg font-bold text-amber-300">
              {store.branchNotice.name}로 진화!
            </h3>
            <p className="text-xs text-white/60 leading-relaxed">
              {store.branchNotice.desc}
            </p>
            <button
              type="button"
              onClick={() => store.ackBranchNotice()}
              className="h-11 rounded-xl bg-teal-400 text-black font-bold active:scale-[0.98] transition-transform"
            >
              멋져!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
