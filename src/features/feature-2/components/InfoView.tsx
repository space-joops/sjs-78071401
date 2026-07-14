"use client";

// 전시관 모드 — 세계관, 진화 도감, 우주쓰레기 전시관, 통계.
// 쓰레기 도감은 박물관 쇼케이스처럼 은은한 핀조명 아래 전시한다 (디자인 가이드 4).

import { useState } from "react";
import {
  coverageRadiusKm,
  DEBRIS_TIERS,
  levelFromXp,
  maxTierForLevel,
  STAGES,
} from "../lib/gameConfig";
import { resetSave, useSave } from "../lib/store";
import styles from "./stellar.module.css";

const DEBRIS_EMOJI = ["🎨", "🔩", "⚙️", "🚀", "🛰️"];

const glassPanel =
  "rounded-3xl border border-white/15 bg-white/[.08] p-4 backdrop-blur-xl";

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
        <section className={glassPanel}>
          <h2 className="text-sm font-bold text-pink-50">🌏 케슬러 신드롬, 그리고 줍스</h2>
          <p className="mt-2 text-xs leading-relaxed text-pink-100/70">
            연쇄 충돌로 불어난 우주쓰레기가 지구 궤도를 뒤덮은 시대. 세계의
            과학자들은 우주 환경에서 살아가며 쓰레기를 먹어 추진력과 에너지를 얻는
            애완 생명체 <b className="text-pink-200">줍스(Joops)</b>를 만들어냈어요.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-pink-100/70">
            너무나 넓은 우주와 너무나 작은 쓰레기들 — 그래서 지구 시민 모두가 한
            마리 이상의 줍스와 교감하고, 보살피고, 조종 훈련을 시켜야 해요. 당신의
            줍스는 당신이 잠든 사이에도 별빛 사이를 유영하며 지구를 청소하고
            있답니다.
          </p>
        </section>

        {/* 통계 */}
        <section className={glassPanel}>
          <h2 className="text-sm font-bold text-pink-50">📊 {save.name}의 기록</h2>
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

        {/* 우주쓰레기 전시관 — 박물관 쇼케이스 */}
        <section className={glassPanel}>
          <h2 className="text-sm font-bold text-pink-50">🏛️ 우주쓰레기 전시관</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-purple-200/55">
            줍스가 수거하는 궤도의 유물들. 진화할수록 더 큰 전시품을 소화할 수
            있어요. 잠긴 쇼케이스(🔒)와 인공위성은 아직 피해 다니세요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {DEBRIS_TIERS.map((d) => {
              const edible = d.tier <= maxTier;
              return (
                <div
                  key={d.tier}
                  className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#241537] via-[#1a0f29] to-[#120a1e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_28px_rgba(40,15,70,0.5)]"
                >
                  {/* 핀조명 */}
                  <div className={styles.spotlight} aria-hidden />
                  <div className="relative flex flex-col items-center px-3 pb-3 pt-7">
                    <span
                      className={`text-4xl transition-all duration-500 ${
                        edible
                          ? "drop-shadow-[0_8px_18px_rgba(255,220,250,0.4)]"
                          : "opacity-50 grayscale"
                      }`}
                      aria-hidden
                    >
                      {DEBRIS_EMOJI[d.tier - 1]}
                    </span>
                    {/* 전시대 바닥의 빛 고임 */}
                    <div className={`${styles.pedestal} mt-1.5 h-2 w-16`} aria-hidden />
                    {/* 박물관 명패 */}
                    <div className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[.06] px-2 py-2 text-center backdrop-blur-sm">
                      <p className="text-[11px] font-semibold text-pink-50">{d.name}</p>
                      <p className="mt-0.5 text-[9px] tracking-wide text-purple-200/55">
                        {d.sizeLabel} · {d.massKg >= 1 ? `${d.massKg}kg` : `${d.massKg * 1000}g`}
                      </p>
                      <p
                        className={`mt-1 text-[9px] font-semibold ${
                          edible ? "text-emerald-200" : "text-purple-200/50"
                        }`}
                      >
                        {edible ? `✓ 소화 가능 · +${d.xp} XP` : "🔒 진화하면 열려요"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* 위성 경고 쇼케이스 */}
            <div className="relative overflow-hidden rounded-3xl border border-rose-300/20 bg-gradient-to-b from-[#2d1428] to-[#160a16] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className={styles.spotlight} aria-hidden />
              <div className="relative flex flex-col items-center px-3 pb-3 pt-7">
                <span className="text-4xl opacity-80" aria-hidden>
                  📡
                </span>
                <div className={`${styles.pedestal} mt-1.5 h-2 w-16`} aria-hidden />
                <div className="mt-3 w-full rounded-2xl border border-rose-300/15 bg-rose-400/10 px-2 py-2 text-center backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-rose-100">운용 중인 인공위성</p>
                  <p className="mt-0.5 text-[9px] tracking-wide text-rose-200/60">
                    전시품 아님 · 접근 금지
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-rose-200">
                    ⚠️ 충돌 시 크게 다쳐요
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 진화 도감 */}
        <section className={glassPanel}>
          <h2 className="text-sm font-bold text-pink-50">🧬 진화 도감</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {STAGES.map((s) => {
              const reached = level >= s.minLevel;
              const current = s.stage === stage;
              return (
                <li
                  key={s.stage}
                  className={`flex items-start gap-3 rounded-2xl border p-3 backdrop-blur-sm transition-all duration-300 ${
                    current
                      ? "border-pink-300/40 bg-pink-300/10 shadow-[0_0_24px_rgba(249,168,212,0.15)]"
                      : "border-white/[.08] bg-white/[.03]"
                  } ${reached ? "" : "opacity-45"}`}
                >
                  <span
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 10px ${s.glow}` }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-pink-50">
                      {reached ? s.name : "???"}
                      <span className="ml-2 font-normal text-purple-200/55">
                        Lv.{s.minLevel}+{current && " · 현재"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-pink-100/60">
                      {reached ? s.desc : "더 성장하면 만날 수 있어요"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 조작법 */}
        <section className={glassPanel}>
          <h2 className="text-sm font-bold text-pink-50">🎮 노는 법</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-pink-100/70">
            <li>산책 탭에서 화면을 드래그해 줍스를 조종하고 쓰레기를 먹여요.</li>
            <li>쓰레기를 먹으면 추진력이 붙고 경험치·에너지를 얻어요.</li>
            <li>주인 상공(관제 탭에서 확인)에서는 경험치 2배 + 돌봄이 가능해요.</li>
            <li>다치면 자동 청소가 멈춰요 — 돌봄 탭에서 응급 처치를 해주세요.</li>
            <li>접속하지 않아도 줍스는 궤도를 돌며 스스로 청소를 계속해요.</li>
          </ul>
        </section>

        {/* 초기화 */}
        <section className="rounded-3xl border border-rose-300/15 bg-rose-400/[.06] p-4 backdrop-blur-xl">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="h-11 w-full rounded-2xl text-xs font-semibold text-rose-300/90 transition-all duration-300 hover:bg-rose-400/10"
            >
              처음부터 다시 키우기 (초기화)
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs text-rose-200">
                정말 {save.name}와의 모든 기록을 지울까요? 되돌릴 수 없어요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="h-11 flex-1 rounded-2xl border border-white/15 bg-white/[.06] text-xs font-semibold text-pink-100/80 backdrop-blur-sm"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    resetSave();
                    setConfirmReset(false);
                  }}
                  className="h-11 flex-1 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-400 text-xs font-semibold text-white shadow-[0_4px_18px_rgba(251,113,133,0.4)]"
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
    <div className="rounded-2xl border border-white/10 bg-white/[.04] px-2 py-3 backdrop-blur-sm">
      <p className="text-sm font-bold tabular-nums text-pink-50">{value}</p>
      <p className="mt-0.5 text-[10px] text-purple-200/55">{label}</p>
    </div>
  );
}
