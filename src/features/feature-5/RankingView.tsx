"use client";

import { useState } from "react";
import { EVOLUTION_STAGES, stageIndexForTotal } from "./constants";
import {
  PILOTS,
  pilotActivityLog,
  pilotEvolution,
  pilotMissionDays,
} from "./demo-pilots";
import { fmtDateISO, fmtInt, fmtMass } from "./format";
import PetAvatar from "./PetAvatar";
import type { PetState, Pilot } from "./types";

const MEDALS = ["🥇", "🥈", "🥉"];

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[10px] text-white/30">—</span>;
  return delta > 0 ? (
    <span className="text-[10px] text-emerald-300">▲{delta}</span>
  ) : (
    <span className="text-[10px] text-rose-300">▼{Math.abs(delta)}</span>
  );
}

function PilotSheet({ pilot, rank, onClose }: { pilot: Pilot; rank: number; onClose: () => void }) {
  const stageIdx = stageIndexForTotal(pilot.totalEaten);
  const stage = EVOLUTION_STAGES[stageIdx];
  const days = pilotMissionDays(pilot);
  const evolution = pilotEvolution(pilot);
  const log = pilotActivityLog(pilot);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0a0e22] sm:max-w-md sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-[#0a0e22]/95 p-4 backdrop-blur">
          <PetAvatar hue={pilot.hue} stage={stageIdx} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">#{rank}</span>
              <h3 className="truncate text-lg font-bold text-white">{pilot.petName}</h3>
            </div>
            <p className="text-xs text-white/60">
              {stage.emoji} {stage.name}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {pilot.countryFlag} {pilot.countryName} · 주인 {pilot.owner}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="상세 닫기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 pb-8">
          <p className="text-sm leading-relaxed text-white/75">“{pilot.bio}”</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <p className="text-[10px] text-white/45">누적 수거</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-white">
                {fmtInt(pilot.totalEaten)}개
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <p className="text-[10px] text-white/45">정화 질량</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-white">
                {fmtMass(pilot.totalKg)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <p className="text-[10px] text-white/45">하루 평균</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-white">
                {fmtInt(pilot.totalEaten / days)}개
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <p className="text-[10px] text-white/45">현재 궤도</p>
              <p className="mt-0.5 font-mono text-base font-semibold text-white">
                LEO {pilot.altitudeKm} km
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h4 className="text-xs font-semibold text-white/80">🚀 발사 기록</h4>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">발사장</dt>
                <dd className="text-right text-white/85">
                  {pilot.countryFlag} {pilot.launchSite}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">발사일</dt>
                <dd className="font-mono text-white/85">{fmtDateISO(pilot.launchDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">임무 경과</dt>
                <dd className="font-mono text-white/85">D+{days}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h4 className="text-xs font-semibold text-white/80">🌱 진화 연대기</h4>
            <ol className="mt-3 space-y-0">
              {evolution.map((e, i) => {
                const s = EVOLUTION_STAGES[e.stageIndex];
                const isLast = i === evolution.length - 1;
                return (
                  <li key={e.stageIndex} className="relative flex gap-3 pb-3 last:pb-0">
                    {!isLast && (
                      <span className="absolute left-[9px] top-5 h-full w-px bg-white/15" />
                    )}
                    <span className="z-10 flex h-5 w-5 items-center justify-center text-sm leading-none">
                      {s.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-xs ${isLast ? "font-semibold text-white" : "text-white/75"}`}>
                        {s.name}
                        {isLast && <span className="ml-1.5 text-[10px] text-cyan-300">현재</span>}
                      </p>
                      <p className="font-mono text-[10px] text-white/40">{e.dateLabel}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h4 className="text-xs font-semibold text-white/80">📡 최근 활동</h4>
            <ul className="mt-2 divide-y divide-white/[.06]">
              {log.map((entry, i) => (
                <li key={i} className="py-2.5 first:pt-1 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs text-white/85">{entry.text}</p>
                    <span className="shrink-0 font-mono text-[10px] text-white/35">
                      {entry.agoLabel}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="mt-0.5 text-[10px] text-white/45">{entry.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RankingView({ pet }: { pet: PetState }) {
  const [selected, setSelected] = useState<number | null>(null);

  const myStageIdx = stageIndexForTotal(pet.totalEaten);
  const myStage = EVOLUTION_STAGES[myStageIdx];
  // 데모용 추정 순위 — 먹을수록 2억 3,400만 참가자 사이를 치고 올라간다
  const myRank = Math.max(21, Math.floor(234_000_000 / (1 + pet.totalEaten)));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-8">
        <header>
          <h2 className="text-lg font-bold text-white">우주 정화 랭킹</h2>
          <p className="mt-1 text-xs text-white/50">
            오르비타 협약 공식 리더보드 · 2026. 7. 14. 기준 · 참가 2억 3,400만 명
          </p>
        </header>

        <ol className="flex flex-col gap-2">
          {PILOTS.map((pilot, i) => {
            const stageIdx = stageIndexForTotal(pilot.totalEaten);
            return (
              <li key={pilot.id}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-3 text-left transition-colors hover:border-white/25 hover:bg-white/[.08]"
                >
                  <span className="w-7 shrink-0 text-center font-mono text-sm text-white/60">
                    {MEDALS[i] ?? i + 1}
                  </span>
                  <PetAvatar hue={pilot.hue} stage={stageIdx} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-white">
                        {pilot.petName}
                      </span>
                      <span aria-hidden>{pilot.countryFlag}</span>
                      <DeltaBadge delta={pilot.delta} />
                    </span>
                    <span className="block truncate text-[11px] text-white/45">
                      {EVOLUTION_STAGES[stageIdx].emoji} {EVOLUTION_STAGES[stageIdx].name} ·{" "}
                      {pilot.countryName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm text-white">
                      {fmtInt(pilot.totalEaten)}
                    </span>
                    <span className="block font-mono text-[10px] text-white/40">
                      {fmtMass(pilot.totalKg)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40">내 스텔라펫</p>
          <div className="mt-2 flex items-center gap-3">
            <PetAvatar hue={pet.hue} stage={myStageIdx} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{pet.name}</p>
              <p className="text-[11px] text-white/45">
                {myStage.emoji} {myStage.name} · 누적 {fmtInt(pet.totalEaten)}개
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-cyan-300">#{fmtInt(myRank)}</p>
              <p className="text-[10px] text-white/40">전 지구 추정 순위</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/50">
            파편을 먹을수록 순위가 올라가요. 지금 이 순간에도 전 세계의 스텔라펫들이 함께
            궤도를 청소하고 있어요.
          </p>
        </div>
      </div>

      {selected !== null && (
        <PilotSheet
          pilot={PILOTS[selected]}
          rank={selected + 1}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
