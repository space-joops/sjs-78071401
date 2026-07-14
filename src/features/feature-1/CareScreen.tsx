"use client";

// 돌보기 화면 — 다마고치식 보살핌.
// 교신 중(머리 위 반경 안 또는 글로벌 링크)에만 먹이/수리/쓰다듬기가 가능하다.

import { useState } from "react";
import type { ArcadeToast } from "./arcade";
import { CARE, DEBRIS_TIERS, STAGES } from "./constants";
import { formatEta } from "./orbit";
import JoopsPortrait from "./JoopsPortrait";
import type { JoopsMood } from "./joopsSprite";
import { getJoopsStore, type Snapshot } from "./store";

type CareKind = keyof typeof CARE;

const CARE_UI: { kind: CareKind; emoji: string; label: string; effect: string }[] = [
  { kind: "feed", emoji: "🍯", label: "먹이 주기", effect: `에너지 +${CARE.feed.energy}` },
  { kind: "repair", emoji: "🔧", label: "수리하기", effect: `체력 +${CARE.repair.health}` },
  { kind: "pet", emoji: "💞", label: "쓰다듬기", effect: `기분 +${CARE.pet.mood}` },
];

export default function CareScreen({
  snap,
  onToast,
}: {
  snap: Snapshot;
  onToast: (t: ArcadeToast) => void;
}) {
  const store = getJoopsStore();
  const [fx, setFx] = useState<{ id: number; emoji: string } | null>(null);

  const mood: JoopsMood =
    snap.st.health <= 15 ? "hurt" : snap.st.energy < 25 ? "tired" : snap.st.mood >= 45 ? "happy" : "tired";

  const doCare = (kind: CareKind, emoji: string) => {
    const res = store.care(kind);
    if (!res.ok) {
      onToast({ text: res.reason ?? "지금은 할 수 없어요", tone: "info" });
      return;
    }
    onToast({ text: `${CARE[kind].label} 완료! ${emoji}`, tone: "good" });
    setFx({ id: Date.now(), emoji });
    setTimeout(() => setFx(null), 900);
  };

  const daysOld = Math.max(0, Math.floor((snap.now - snap.st.bornAt) / 86_400_000));
  const nextStage = STAGES.find((s) => s.minLevel > snap.level);

  return (
    <div className="flex flex-col gap-3 p-3 sm:mx-auto sm:max-w-2xl sm:p-4">
      {/* 초상화 */}
      <section className="relative flex flex-col items-center rounded-xl border border-white/10 bg-gradient-to-b from-[#101d38] to-[#0a1526] py-4">
        <JoopsPortrait size={150} stageIndex={snap.stageIndex} mood={mood} />
        {fx && (
          <span key={fx.id} className="pointer-events-none absolute top-8 animate-ping text-4xl">
            {fx.emoji}
          </span>
        )}
        <p className="text-base font-bold text-white">{snap.st.name}</p>
        <p className="text-xs text-white/55">
          {snap.stage.name} · Lv.{snap.level} · 태어난 지 {daysOld === 0 ? "오늘" : `${daysOld}일`}
        </p>
        <p className="mt-1 text-xs text-white/45">
          {mood === "hurt"
            ? "많이 다쳤어요… 수리가 필요해요 🥺"
            : mood === "tired"
              ? "조금 지쳐 보여요. 먹이를 챙겨 주세요"
              : "기분이 좋아 보여요!"}
        </p>
      </section>

      {/* 교신 상태 */}
      {snap.comm.active ? (
        <section className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3">
          <p className="text-sm font-bold text-emerald-200">
            {snap.comm.viaGlobalLink ? "🌐 글로벌 링크로 교신 중" : "📡 머리 위를 지나는 중 — 교신 양호"}
          </p>
          <p className="mt-0.5 text-xs text-emerald-100/70">
            지금 보살필 수 있어요. 교신 중에는 획득 XP도 2배!
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-3">
          <p className="text-sm font-bold text-amber-200">
            📡 교신 대기 — 홈 상공 도달 {formatEta(snap.comm.etaSec)}
          </p>
          <p className="mt-0.5 text-xs text-amber-100/70">
            줍스가 홈 반경 {snap.comm.rangeKm.toLocaleString()}km 안에 들어오면 보살필 수 있어요.
            플레이 중 🌐 글로벌 링크 코어를 먹으면 어디서든 10분간 교신돼요.
          </p>
        </section>
      )}

      {/* 상태 게이지 */}
      <section className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-[#0a1526]/80 p-3">
        <Bar label="체력" emoji="❤️" value={snap.st.health} color="#ff8f8f" />
        <Bar label="에너지" emoji="⚡" value={snap.st.energy} color="#ffd97a" />
        <Bar label="기분" emoji="😊" value={snap.st.mood} color="#8ff0c8" />
        <div>
          <div className="mb-1 flex justify-between text-xs text-white/60">
            <span>⭐ Lv.{snap.level}</span>
            <span className="font-mono">
              {Math.floor(snap.xpInLevel)}/{snap.xpNeeded} XP
              {nextStage ? ` · Lv.${nextStage.minLevel}에 진화` : " · 최종 진화"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300 transition-[width] duration-500"
              style={{ width: `${Math.min(100, (snap.xpInLevel / snap.xpNeeded) * 100)}%` }}
            />
          </div>
        </div>
      </section>

      {/* 보살핌 버튼 */}
      <section className="grid grid-cols-3 gap-2">
        {CARE_UI.map(({ kind, emoji, label, effect }) => {
          const cooldown = store.careCooldownRemainMs(kind, snap.now);
          const disabled = !snap.comm.active || cooldown > 0;
          return (
            <button
              key={kind}
              onClick={() => doCare(kind, emoji)}
              disabled={disabled}
              className={`flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-all active:scale-95 ${
                disabled
                  ? "border-white/10 bg-white/5 opacity-45"
                  : "border-emerald-300/30 bg-emerald-400/10"
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs font-bold text-white">{label}</span>
              <span className="text-[10px] text-white/55">
                {cooldown > 0 ? `${Math.ceil(cooldown / 1000)}초 후` : effect}
              </span>
            </button>
          );
        })}
      </section>

      {/* 청소 실적 */}
      <section className="rounded-xl border border-white/10 bg-[#0a1526]/80 p-3">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
          청소 실적
        </h3>
        <p className="text-2xl font-bold text-white">
          {snap.st.debrisCleaned.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-white/55">개의 우주쓰레기 제거</span>
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {DEBRIS_TIERS.map((d, i) => (
            <div key={d.tier} className="flex items-center justify-between text-xs">
              <span className={d.tier <= snap.stage.maxTier ? "text-white/75" : "text-white/35"}>
                {d.name}
                {d.tier > snap.stage.maxTier && " 🔒"}
              </span>
              <span className="font-mono text-white/60">
                {(snap.st.cleanedByTier[i] ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 border-t border-white/10 pt-2 text-xs text-white/55">
          <span>💚 조우 {snap.st.encounters}회</span>
          <span>💥 충돌 {snap.st.collisions}회</span>
        </div>
      </section>

      {/* 위험 구역 */}
      <details className="rounded-xl border border-white/10 bg-[#0a1526]/60 p-3">
        <summary className="cursor-pointer text-xs text-white/40">위험 구역</summary>
        <button
          onClick={() => {
            if (window.confirm(`${snap.st.name}와 작별하고 처음부터 다시 시작할까요?`)) {
              store.reset();
            }
          }}
          className="mt-2 h-11 w-full rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs font-semibold text-rose-300"
        >
          작별하고 새 줍스 입양하기
        </button>
      </details>
    </div>
  );
}

function Bar({
  label,
  emoji,
  value,
  color,
}: {
  label: string;
  emoji: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-white/60">
        <span>
          {emoji} {label}
        </span>
        <span className="font-mono">{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
