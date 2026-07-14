"use client";

// 정보 모드 — 세계관, 진화 도감, 쓰레기 도감, 통계

import { useState } from "react";
import {
  coverageRadiusKm,
  DEBRIS_TIERS,
  levelFromXp,
  maxTierForLevel,
  STAGES,
} from "../lib/gameConfig";
import { resetSave, useSave } from "../lib/store";

export default function InfoView() {
  const save = useSave();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!save) return null;

  const level = levelFromXp(save.xp);
  const maxTier = maxTierForLevel(level);
  const stage = STAGES.filter((s) => level >= s.minLevel).length - 1;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-3 sm:p-4">
        {/* 세계관 */}
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h2 className="text-sm font-bold text-white">🌏 케슬러 신드롬, 그리고 줍스</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            연쇄 충돌로 불어난 우주쓰레기가 지구 궤도를 뒤덮은 시대. 세계의
            과학자들은 우주 환경에서 살아가며 쓰레기를 먹어 추진력과 에너지를 얻는
            애완 생명체 <b className="text-cyan-300">줍스(Joops)</b>를 만들어냈어요.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            너무나 넓은 우주와 너무나 작은 쓰레기들 — 그래서 지구 시민 모두가 한
            마리 이상의 줍스와 교감하고, 보살피고, 조종 훈련을 시켜야 해요. 당신의
            줍스는 당신이 잠든 사이에도 궤도를 돌며 묵묵히 지구를 청소하고 있답니다.
          </p>
        </section>

        {/* 통계 */}
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h2 className="text-sm font-bold text-white">📊 {save.name}의 기록</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <Stat label="청소한 쓰레기" value={`${save.cleanedCount.toLocaleString()}개`} />
            <Stat
              label="수거 질량"
              value={
                save.cleanedMassKg >= 1000
                  ? `${(save.cleanedMassKg / 1000).toFixed(2)}t`
                  : `${save.cleanedMassKg.toFixed(1)}kg`
              }
            />
            <Stat label="만난 줍스 친구" value={`${save.encounters}마리`} />
            <Stat label="교신 반경" value={`${coverageRadiusKm(level).toLocaleString()}km`} />
          </div>
        </section>

        {/* 진화 도감 */}
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h2 className="text-sm font-bold text-white">🧬 진화 도감</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {STAGES.map((s) => {
              const reached = level >= s.minLevel;
              const current = s.stage === stage;
              return (
                <li
                  key={s.stage}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    current
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : "border-white/[.06] bg-white/[.02]"
                  } ${reached ? "" : "opacity-45"}`}
                >
                  <span
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.glow}` }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">
                      {reached ? s.name : "???"}
                      <span className="ml-2 font-normal text-slate-500">
                        Lv.{s.minLevel}+{current && " · 현재"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                      {reached ? s.desc : "더 성장하면 만날 수 있어요"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 쓰레기 도감 */}
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h2 className="text-sm font-bold text-white">🗑️ 우주쓰레기 도감</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            진화할수록 더 큰 쓰레기를 소화할 수 있어요. 아직 처리 못 하는 물체(빨간
            테두리)와 인공위성은 피하세요!
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {DEBRIS_TIERS.map((d) => {
              const edible = d.tier <= maxTier;
              return (
                <li
                  key={d.tier}
                  className="flex items-center gap-3 rounded-xl bg-white/[.03] px-3 py-2"
                >
                  <span className="text-base">{edible ? "😋" : "⚠️"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">
                      {d.name}
                      <span className="ml-2 font-normal text-slate-500">{d.sizeLabel}</span>
                    </p>
                  </div>
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {edible ? `+${d.xp} XP` : "처리 불가"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 조작법 */}
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h2 className="text-sm font-bold text-white">🎮 노는 법</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-slate-400">
            <li>비행 탭에서 화면을 드래그해 줍스를 조종하고 쓰레기를 먹여요.</li>
            <li>쓰레기를 먹으면 추진력이 붙고 경험치·에너지를 얻어요.</li>
            <li>주인 상공(관제 탭에서 확인)에서는 경험치 2배 + 돌봄이 가능해요.</li>
            <li>다치면 자동 청소가 멈춰요 — 돌봄 탭에서 응급 처치를 해주세요.</li>
            <li>접속하지 않아도 줍스는 궤도를 돌며 스스로 청소를 계속해요.</li>
          </ul>
        </section>

        {/* 초기화 */}
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/[.05] p-4">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="h-11 w-full rounded-xl text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10"
            >
              처음부터 다시 키우기 (초기화)
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs text-rose-300">
                정말 {save.name}와의 모든 기록을 지울까요? 되돌릴 수 없어요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="h-11 flex-1 rounded-xl border border-white/15 text-xs font-semibold text-slate-300"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    resetSave();
                    setConfirmReset(false);
                  }}
                  className="h-11 flex-1 rounded-xl bg-rose-500 text-xs font-semibold text-white"
                >
                  초기화
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[.03] px-2 py-3">
      <p className="text-sm font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
