"use client";
// 줍스 스웜 허브 — 기록·진화 현황·조작법. localStorage는 마운트 후에만 읽는다(SSR 불일치 방지).
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EVOLUTION_ICONS,
  EVOLUTION_NAMES,
  EVOLUTION_THRESHOLDS,
  RUSH_SECONDS,
} from "../lib/constants";
import { loadSave, nextEvolutionAt, stageFor, type SwarmSave } from "../lib/state";

export default function HubScreen() {
  const [save, setSave] = useState<SwarmSave | null>(null);

  useEffect(() => {
    setSave(loadSave());
  }, []);

  const stage = save ? stageFor(save.totalCollected) : 0;
  const nextAt = save ? nextEvolutionAt(save.totalCollected) : EVOLUTION_THRESHOLDS[1];
  const prevAt = EVOLUTION_THRESHOLDS[stage];
  const progress =
    save && nextAt !== null
      ? Math.min(100, Math.round(((save.totalCollected - prevAt) / (nextAt - prevAt)) * 100))
      : 100;

  return (
    <div className="flex min-h-dvh flex-col bg-[#050a16] text-white">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-[#050a16]/80 p-3 backdrop-blur">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 transition-colors hover:bg-white/10"
        >
          ←
        </Link>
        <h1 className="text-base font-bold">🧲 줍스 스웜</h1>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* 진화 현황 */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
          <div className="text-6xl" aria-hidden>
            {EVOLUTION_ICONS[stage]}
          </div>
          <h2 className="mt-2 text-lg font-bold">{EVOLUTION_NAMES[stage]}</h2>
          <p className="mt-1 text-xs text-white/50">
            {save
              ? nextAt !== null
                ? `다음 진화까지 파편 ${Math.max(0, nextAt - save.totalCollected)}개`
                : "최종 진화 완료!"
              : "…"}
          </p>
          <div className="mx-auto mt-3 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-amber-300 transition-[width] duration-500"
              style={{ width: `${save ? progress : 0}%` }}
            />
          </div>
        </section>

        {/* 기록 */}
        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-xl font-black tabular-nums text-teal-300">
              {save?.best ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-white/50">최고 점수</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-xl font-black tabular-nums text-sky-300">
              {save?.totalCollected ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-white/50">누적 수거 파편</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-xl font-black tabular-nums text-amber-300">
              ×{save?.bestCombo ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-white/50">최대 콤보</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-xl font-black tabular-nums text-white/80">
              {save?.plays ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-white/50">출동 횟수</div>
          </div>
        </section>

        {/* 조작법 */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-bold text-white/80">브리핑</h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-white/60">
            <li>🧲 화면을 드래그하면 줍스가 따라가며 주변 파편을 빨아들입니다.</li>
            <li>⏱ 제한 시간 {RUSH_SECONDS}초. 연속 수거 콤보로 점수가 커집니다.</li>
            <li>🔥 게이지를 가득 채우면 피버 — 반경 확대, 점수 2배, 빨간 파편도 수거!</li>
            <li>💥 평소에 빨간 가시 파편과 부딪히면 -6초. 조심하세요.</li>
            <li>✨ 파편을 누적 수거하면 줍스가 4단계까지 진화합니다.</li>
          </ul>
        </section>

        <div className="flex-1" />

        <Link
          href="/features/11/play"
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-teal-300 text-base font-bold text-black transition-transform active:scale-95"
        >
          🚀 대청소 출동
        </Link>
      </main>
    </div>
  );
}
