"use client";

import Link from "next/link";
import { useState } from "react";
import { EVOLUTION_STAGES, stageIndexForTotal } from "./constants";
import { fmtInt, fmtMass, josa } from "./format";
import GameCanvas from "./GameCanvas";
import PetAvatar from "./PetAvatar";
import type { PetState } from "./types";

export default function GameView({
  pet,
  onEat,
  onRename,
}: {
  pet: PetState;
  onEat: (massKg: number, label: string) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pet.name);
  const [showHint, setShowHint] = useState(true);

  const stageIdx = stageIndexForTotal(pet.totalEaten);
  const stage = EVOLUTION_STAGES[stageIdx];
  const next = EVOLUTION_STAGES[stageIdx + 1];
  const progress = next
    ? Math.min(
        1,
        (pet.totalEaten - stage.threshold) / (next.threshold - stage.threshold)
      )
    : 1;
  const altitudeKm = 420 + (pet.hue % 330);

  const commitName = () => {
    onRename(draft);
    setEditing(false);
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <GameCanvas
        hue={pet.hue}
        stage={stageIdx}
        onEat={onEat}
        onInteract={() => setShowHint(false)}
      />

      {/* 상단 HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="메인으로 돌아가기"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-lg text-white backdrop-blur transition-colors hover:bg-white/15"
          >
            ←
          </Link>

          {editing ? (
            <form
              className="pointer-events-auto flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                commitName();
              }}
            >
              <input
                autoFocus
                value={draft}
                maxLength={12}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                aria-label="펫 이름"
                className="h-11 w-36 rounded-full border border-white/25 bg-black/50 px-4 text-sm text-white outline-none backdrop-blur placeholder:text-white/40"
                placeholder="펫 이름"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(pet.name);
                setEditing(true);
              }}
              aria-label="펫 이름 바꾸기"
              className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/40 pl-1.5 pr-4 backdrop-blur transition-colors hover:bg-white/15"
            >
              <PetAvatar hue={pet.hue} stage={stageIdx} size={32} />
              <span className="text-sm font-semibold text-white">{pet.name}</span>
              <span className="text-[10px] text-white/50">✎</span>
            </button>
          )}

          <span className="ml-auto rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[10px] text-cyan-200/90 backdrop-blur">
            LEO {altitudeKm} km
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur">
            {stage.emoji} {stage.name}
          </span>
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-white/80 backdrop-blur">
            오늘 +{fmtInt(pet.todayEaten)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-white/80 backdrop-blur">
            누적 {fmtInt(pet.totalEaten)}
          </span>
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-white/80 backdrop-blur">
            정화 {fmtMass(pet.totalKg)}
          </span>
        </div>

        <div className="max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300 transition-[width] duration-700"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-white/55">
            {next
              ? `다음 진화 ${next.emoji} ${next.name}까지 ${fmtInt(next.threshold - pet.totalEaten)}개`
              : "최종 진화 완료 — 궤도의 전설"}
          </p>
        </div>
      </div>

      {/* 하단 힌트 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-4 text-center">
        {showHint && (
          <p className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-white/85 backdrop-blur">
            화면을 탭하면 {pet.name}
            {josa(pet.name, "이", "가")} 그곳으로 헤엄쳐요
          </p>
        )}
        <p className="text-[10px] text-white/40">
          자리를 비워도 {pet.name}
          {josa(pet.name, "은", "는")} 계속 궤도를 돌며 수거해요 ✨
        </p>
      </div>
    </div>
  );
}
