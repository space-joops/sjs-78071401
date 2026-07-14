"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HOME_BOOST_MULTIPLIER } from "../constants";
import { expProgress, homeRadiusKm, maxHpForLevel, stageForLevel } from "../lib/level";
import { isOverHome } from "../lib/orbit";
import { loadSave, persistSave, settleOffline } from "../lib/storage";
import type { OfflineReport, SaveData } from "../types";
import CareMode from "./CareMode";
import ControlCenter from "./ControlCenter";
import FlightGame from "./FlightGame";

type Tab = "control" | "flight" | "care";

export type GainEvent = {
  exp?: number;
  debris?: number;
  greet?: number;
  capsules?: number;
  globalBoost?: number;
};

export function getMultiplier(save: SaveData, now: number): number {
  if (save.boostUntil > now) return HOME_BOOST_MULTIPLIER;
  const level = expProgress(save.joops.exp).level;
  if (isOverHome(now, save.home, homeRadiusKm(level))) {
    return HOME_BOOST_MULTIPLIER;
  }
  return 1;
}

function formatElapsed(ms: number): string {
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export default function JoopsOdyssey() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [report, setReport] = useState<OfflineReport | null>(null);
  const [tab, setTab] = useState<Tab>("flight");
  const [now, setNow] = useState(0);
  const saveRef = useRef<SaveData | null>(null);
  saveRef.current = save;

  // 최초 로드 + 오프라인(방치) 진행 정산
  useEffect(() => {
    const t = Date.now();
    const { save: settled, report: r } = settleOffline(loadSave(t), t);
    setSave(settled);
    setReport(r);
    setNow(t);
    if (settled.care !== null) setTab("care");
  }, []);

  // 변경 시 저장
  useEffect(() => {
    if (save) persistSave(save);
  }, [save]);

  // 1초 틱: ETA·부스트 상태 갱신 / 15초마다 lastSeenAt 갱신(영속성 기준점)
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const heartbeat = setInterval(() => {
      setSave((s) => (s ? { ...s, lastSeenAt: Date.now() } : s));
    }, 15000);
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
    };
  }, []);

  const updateSave = useCallback((fn: (s: SaveData) => SaveData) => {
    setSave((s) => (s ? fn(s) : s));
  }, []);

  const onGain = useCallback(
    (gain: GainEvent) => {
      updateSave((s) => {
        const mult = getMultiplier(s, Date.now());
        const stressPenalty = s.joops.stress >= 70 ? 0.5 : 1;
        const exp = Math.round((gain.exp ?? 0) * mult * stressPenalty);
        return {
          ...s,
          joops: {
            ...s.joops,
            exp: s.joops.exp + exp,
            debrisCleaned: s.joops.debrisCleaned + (gain.debris ?? 0),
            greetCount: s.joops.greetCount + (gain.greet ?? 0),
          },
          items: {
            capsules: s.items.capsules + (gain.capsules ?? 0),
            globalBoost: s.items.globalBoost + (gain.globalBoost ?? 0),
          },
        };
      });
    },
    [updateSave]
  );

  const onDamage = useCallback(
    (damage: number) => {
      let disabled = false;
      updateSave((s) => {
        const hp = Math.max(0, s.joops.hp - damage);
        const stress = Math.min(100, s.joops.stress + 8);
        disabled = hp <= 0 && s.care === null;
        return {
          ...s,
          joops: { ...s.joops, hp, stress },
          care: disabled ? "debris" : s.care,
        };
      });
      if (disabled) setTab("care");
    },
    [updateSave]
  );

  if (!save) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#05070f] text-white">
        <span className="animate-pulse text-4xl">🛰️</span>
        <p className="text-sm text-white/60">관제 센터 연결 중…</p>
      </div>
    );
  }

  const { level, current, needed } = expProgress(save.joops.exp);
  const stage = stageForLevel(level);
  const maxHp = maxHpForLevel(level);
  const multiplier = getMultiplier(save, now);
  const careNeeded = save.care !== null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "control", label: "관제 센터", icon: "🌍" },
    { id: "flight", label: "비행", icon: "🚀" },
    { id: "care", label: "보살핌", icon: "💗" },
  ];

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[#05070f] font-sans text-white">
      {/* 헤더 */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-2">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10"
        >
          ←
        </Link>
        <h1 className="text-sm font-bold tracking-tight">줍스 오디세이</h1>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
          <span aria-hidden>{stage.emoji}</span>
          {stage.name} Lv.{level}
        </span>
        {multiplier > 1 && (
          <span className="animate-pulse rounded-full bg-amber-400/20 px-2 py-1 text-xs font-bold text-amber-300">
            x{multiplier}
          </span>
        )}
      </header>

      {/* 상태 바 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-1.5 text-[10px]">
        <div className="flex flex-1 items-center gap-1.5">
          <span className="w-5 shrink-0 text-white/50">HP</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${
                careNeeded ? "bg-red-500" : "bg-emerald-400"
              }`}
              style={{ width: `${(save.joops.hp / maxHp) * 100}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-white/60">
            {save.joops.hp}/{maxHp}
          </span>
        </div>
        <div className="flex flex-1 items-center gap-1.5">
          <span className="w-6 shrink-0 text-white/50">EXP</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${Math.min(100, (current / needed) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 본문 */}
      <main className="relative flex min-h-0 flex-1 flex-col">
        {tab === "control" && (
          <ControlCenter save={save} updateSave={updateSave} now={now} />
        )}
        {tab === "flight" &&
          (careNeeded ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="text-5xl" aria-hidden>
                🆘
              </span>
              <p className="text-lg font-bold">줍스 기능 정지!</p>
              <p className="text-sm text-white/60">
                충돌로 체력이 고갈됐어요. 보살핌으로 줍스를 회복시켜야 다시
                비행할 수 있어요.
              </p>
              <button
                onClick={() => setTab("care")}
                className="h-12 rounded-full bg-rose-500 px-6 text-sm font-bold transition-colors hover:bg-rose-400"
              >
                💗 보살피러 가기
              </button>
            </div>
          ) : (
            <FlightGame
              save={save}
              multiplier={multiplier}
              onGain={onGain}
              onDamage={onDamage}
            />
          ))}
        {tab === "care" && <CareMode save={save} updateSave={updateSave} />}
      </main>

      {/* 하단 탭 바 */}
      <nav className="flex shrink-0 border-t border-white/10 bg-[#080b16] pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              tab === t.id ? "text-white" : "text-white/40"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {t.icon}
            </span>
            {t.label}
            {t.id === "care" && careNeeded && (
              <span className="absolute right-[calc(50%-24px)] top-1.5 h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </nav>

      {/* 오프라인 진행 리포트 */}
      {report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1224] p-6 text-center">
            <span className="text-4xl" aria-hidden>
              🛰️✨
            </span>
            <h2 className="mt-3 text-lg font-bold">부재 중 궤도 청소 완료!</h2>
            <p className="mt-2 text-sm text-white/60">
              {formatElapsed(report.elapsedMs)} 동안 줍스가 혼자서 궤도를 돌며
              우주를 청소했어요.
            </p>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {report.debrisCleaned}
                </p>
                <p className="text-xs text-white/50">청소한 쓰레기</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-sky-300">
                  +{report.expGained}
                </p>
                <p className="text-xs text-white/50">획득 EXP</p>
              </div>
            </div>
            <button
              onClick={() => setReport(null)}
              className="mt-5 h-12 w-full rounded-full bg-sky-500 text-sm font-bold transition-colors hover:bg-sky-400"
            >
              줍스 만나러 가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
