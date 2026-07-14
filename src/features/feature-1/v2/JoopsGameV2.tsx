"use client";

// 줍줍스2 셸 — 탭, HUD, 토스트, 부재 보고서·진화 모달.
// v1 대비: 세이프에어리어 대응, 미션 완료 토스트, 진화 시 아케이드 슬로모 연출.

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import AdoptScreenV2 from "./AdoptScreenV2";
import type { ArcadeToast, ArcadeV2 } from "./arcade";
import CareScreenV2 from "./CareScreenV2";
import JoopsPortrait from "../JoopsPortrait";
import PlayScreenV2 from "./PlayScreenV2";
import TrackScreenV2 from "./TrackScreenV2";
import { getJoopsStoreV2 } from "./store";

type Tab = "play" | "track" | "care";
type Toast = ArcadeToast & { id: number };

const TABS: { key: Tab; emoji: string; label: string }[] = [
  { key: "play", emoji: "🚀", label: "플레이" },
  { key: "track", emoji: "🌍", label: "관제" },
  { key: "care", emoji: "💚", label: "돌보기" },
];

export default function JoopsGameV2({ debug }: { debug?: boolean }) {
  const store = getJoopsStoreV2();
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<Tab>("play");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [evolvedTo, setEvolvedTo] = useState<number | null>(null);
  const toastSeq = useRef(0);
  const prevStage = useRef<number | null>(null);
  const arcadeRef = useRef<ArcadeV2 | null>(null);

  useEffect(() => {
    store.load();
    setBooted(true);
  }, [store]);

  useEffect(() => {
    const save = () => store.saveNow();
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [store]);

  const addToast = useCallback((t: ArcadeToast) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 2800);
  }, []);

  // 진화 감지 → 아케이드 슬로모 + 모달
  useEffect(() => {
    const idx = snap?.stageIndex ?? null;
    if (idx !== null && prevStage.current !== null && idx > prevStage.current) {
      setEvolvedTo(idx);
      arcadeRef.current?.playEvolve();
    }
    prevStage.current = idx;
  }, [snap?.stageIndex]);

  // 미션 완료 토스트
  const missionsDone = snap?.missionsDone ?? 0;
  useEffect(() => {
    const done = store.takeJustCompleted();
    for (const m of done) {
      addToast({ text: `미션 달성! ${m.emoji} ${m.label} — 보상을 받으세요`, tone: "good" });
    }
  }, [missionsDone, store, addToast]);

  const away = store.awayReport;

  return (
    <div className="flex h-dvh flex-col overflow-hidden overscroll-none bg-[#050a16] font-sans text-white">
      {!booted ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/50">
          궤도에 접속하는 중… 🛰️
        </div>
      ) : !snap ? (
        <div className="relative min-h-0 flex-1">
          <div
            className="absolute z-10"
            style={{ left: "max(0.5rem, env(safe-area-inset-left))", top: "max(0.5rem, env(safe-area-inset-top))" }}
          >
            <BackButton />
          </div>
          <div className="h-full overflow-y-auto overscroll-contain">
            <AdoptScreenV2 />
          </div>
        </div>
      ) : (
        <>
          <header
            className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 px-1"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              height: "calc(3rem + env(safe-area-inset-top))",
              paddingLeft: "max(0.25rem, env(safe-area-inset-left))",
              paddingRight: "max(0.25rem, env(safe-area-inset-right))",
            }}
          >
            <BackButton />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {snap.st.name}
                <span className="ml-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                  {snap.stage.name}
                </span>
              </p>
            </div>
            <span className="rounded-full bg-fuchsia-400/15 px-2 py-0.5 font-mono text-[10px] font-bold text-fuchsia-200">
              v2
            </span>
            <span className="px-2 font-mono text-xs text-white/70">Lv.{snap.level}</span>
          </header>

          <div
            className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-1.5"
            style={{
              paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right))",
            }}
          >
            <MiniBar emoji="❤️" value={snap.st.health} color="#ff8f8f" />
            <MiniBar emoji="⚡" value={snap.st.energy} color="#ffd97a" />
            <MiniBar emoji="😊" value={snap.st.mood} color="#8ff0c8" />
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-300 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (snap.xpInLevel / snap.xpNeeded) * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-right font-mono text-[9px] leading-none text-white/40">
                XP {Math.floor(snap.xpInLevel)}/{snap.xpNeeded}
              </p>
            </div>
          </div>

          <main className="relative min-h-0 flex-1">
            {tab === "play" && (
              <PlayScreenV2
                snap={snap}
                onToast={addToast}
                onGoCare={() => setTab("care")}
                onArcadeReady={(a) => (arcadeRef.current = a)}
                debug={debug}
              />
            )}
            {tab === "track" && (
              <div className="h-full overflow-y-auto overscroll-contain">
                <TrackScreenV2 snap={snap} onToast={addToast} />
              </div>
            )}
            {tab === "care" && (
              <div className="h-full overflow-y-auto overscroll-contain">
                <CareScreenV2 snap={snap} onToast={addToast} />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-1 px-4">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className={`max-w-full truncate rounded-full border px-4 py-2 text-xs font-semibold backdrop-blur ${
                    t.tone === "good"
                      ? "border-emerald-300/30 bg-emerald-950/70 text-emerald-200"
                      : t.tone === "bad"
                        ? "border-rose-300/30 bg-rose-950/70 text-rose-200"
                        : "border-sky-300/30 bg-sky-950/70 text-sky-200"
                  }`}
                >
                  {t.text}
                </div>
              ))}
            </div>
          </main>

          <nav
            className="shrink-0 border-t border-white/10 bg-[#070f20]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="grid grid-cols-3">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                    tab === t.key ? "text-cyan-300" : "text-white/45"
                  }`}
                  aria-current={tab === t.key}
                >
                  <span className="text-lg leading-none">{t.emoji}</span>
                  {t.label}
                  {t.key === "care" && snap.missionsDone > 0 && (
                    <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-amber-300" />
                  )}
                </button>
              ))}
            </div>
          </nav>

          {away && (
            <Modal>
              <h2 className="text-lg font-bold text-white">부재 중 보고서 📡</h2>
              <p className="mt-1 text-xs text-white/55">
                {formatAway(away.awayMs)} 동안 {snap.st.name}는 혼자 궤도를 돌며 일했어요.
              </p>
              <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-white/5 p-3 text-sm text-white/80">
                <p>🧹 우주쓰레기 {away.debris.toLocaleString()}개 청소</p>
                <p>⭐ XP +{away.xp.toLocaleString()}</p>
                {away.encounters > 0 && <p>💚 떠돌이 줍스 {away.encounters}회 조우</p>}
                {away.collisions > 0 && (
                  <p>
                    💥 충돌 {away.collisions}회
                    {away.healthLost > 0 && ` (체력 -${away.healthLost})`}
                  </p>
                )}
              </div>
              {away.streakDelta > 0 && (
                <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-sm">
                  <p className="font-bold text-amber-200">
                    🔥 {away.streakCount}일 연속 접속!
                  </p>
                  <p className="mt-0.5 text-xs text-amber-100/70">
                    오늘의 미션이 도착했어요
                    {away.giftedLink && " · 글로벌 링크 코어 지급 🌐"}
                  </p>
                </div>
              )}
              <button
                onClick={() => store.dismissAwayReport()}
                className="mt-4 h-12 w-full rounded-xl bg-cyan-300 text-sm font-bold text-cyan-950 active:scale-[0.98]"
              >
                수고했어, {snap.st.name}! 💚
              </button>
            </Modal>
          )}

          {evolvedTo !== null && (
            <Modal glow={snap.stage.glowColor}>
              <div className="flex flex-col items-center">
                <p className="text-3xl">✨</p>
                <h2 className="mt-1 text-lg font-bold text-white">진화했어요!</h2>
                <JoopsPortrait size={130} stageIndex={evolvedTo} mood="happy" />
                <p className="text-base font-bold" style={{ color: snap.stage.bodyColor }}>
                  {snap.stage.name}
                </p>
                <div className="mt-3 w-full rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/75">
                  <p>🍽️ 처리 가능 쓰레기 등급 {snap.stage.maxTier}까지</p>
                  <p>📡 교신 반경 {snap.stage.rangeKm.toLocaleString()}km로 확장</p>
                </div>
                <button
                  onClick={() => setEvolvedTo(null)}
                  className="mt-4 h-12 w-full rounded-xl bg-cyan-300 text-sm font-bold text-cyan-950 active:scale-[0.98]"
                >
                  멋져! 계속하기
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

function BackButton() {
  return (
    <Link
      href="/features/1"
      className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 transition-colors hover:bg-white/10"
      aria-label="버전 선택으로 돌아가기"
    >
      ←
    </Link>
  );
}

function MiniBar({ emoji, value, color }: { emoji: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] leading-none">{emoji}</span>
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Modal({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1428] p-5"
        style={glow ? { boxShadow: `0 0 70px ${glow}66` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function formatAway(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 ${min % 60}분`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}
