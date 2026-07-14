"use client";

// 도감·업적 (개선 지시서 Phase 2-8)
// - 쓰레기 도감: 먹어본 등급만 공개, 나머지는 실루엣
// - 형태 도감: 성장 단계 + 진화 분기 형태
// - 업적: 달성 시각과 함께 표시

import { useState } from "react";
import { STAGES, DEBRIS_TIERS, BRANCHES, ACHIEVEMENTS } from "./balance";
import type { Snapshot } from "./store2";

const DEBRIS_ART = [
  "/feature-3/art/debris-fleck.svg",
  "/feature-3/art/debris-screw.svg",
  "/feature-3/art/debris-panel.svg",
  "/feature-3/art/debris-rocket.svg",
  "/feature-3/art/debris-satellite.svg",
];

const DEBRIS_LORE = [
  "궤도에서 가장 흔한 미세 쓰레기. 새끼 줍스의 주식.",
  "우주 어딘가에서 풀려 나온 스크루. 금속 계열.",
  "부서진 인공위성의 태양전지판 조각. 전자 계열.",
  "버려진 로켓의 노즐 부품. 단단한 금속 계열.",
  "수명이 다한 채 떠도는 위성. 가장 희귀한 전자 계열.",
];

type Tab = "debris" | "forms" | "achievements";

type Props = { snap: Snapshot; onClose: () => void };

export default function CodexModal({ snap, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("debris");
  const st = snap.st;

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      aria-pressed={tab === t}
      className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors ${
        tab === t ? "bg-teal-400/20 text-teal-200 border border-teal-300/40" : "bg-white/5 text-white/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#03060f]/97">
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          aria-label="도감 닫기"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-lg"
        >
          ←
        </button>
        <h2 className="text-sm font-bold">📔 도감 · 업적</h2>
        <span className="ml-auto text-[11px] text-white/40">
          업적 {Object.keys(st.achievements).length}/{ACHIEVEMENTS.length}
        </span>
      </header>

      <div className="flex gap-2 px-3 py-2 shrink-0">
        {tabBtn("debris", "쓰레기")}
        {tabBtn("forms", "형태")}
        {tabBtn("achievements", "업적")}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
        {tab === "debris" && (
          <ul className="flex flex-col gap-2 sm:max-w-md sm:mx-auto">
            {DEBRIS_TIERS.map((d, i) => {
              const eaten = st.cleanedByTier[i] ?? 0;
              const unlocked = eaten > 0;
              return (
                <li
                  key={d.tier}
                  className="flex items-center gap-3 rounded-2xl bg-white/[.05] p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DEBRIS_ART[i]}
                    alt=""
                    aria-hidden
                    className={`h-14 w-14 shrink-0 ${unlocked ? "" : "opacity-40 brightness-0 invert-[.25]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm">
                      {unlocked ? d.name : "???"}
                      <span className="ml-2 text-[10px] text-teal-300">TIER {d.tier}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50 leading-relaxed">
                      {unlocked ? DEBRIS_LORE[i] : "아직 먹어보지 못했다"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-white/60 tabular-nums">
                    ×{eaten.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "forms" && (
          <ul className="flex flex-col gap-2 sm:max-w-md sm:mx-auto">
            <li className="flex items-center gap-3 rounded-2xl bg-white/[.05] p-3">
              <span
                className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20 bg-gradient-to-b from-white to-[#9ee8d8]"
                aria-hidden
              />
              <div>
                <p className="font-bold text-sm">알</p>
                <p className="text-[11px] text-white/50">모든 줍스의 시작</p>
              </div>
              <span className="ml-auto text-[11px] text-teal-300">발견</span>
            </li>
            {STAGES.map((s) => {
              const seen = snap.level >= s.minLevel;
              return (
                <li key={s.name} className="flex items-center gap-3 rounded-2xl bg-white/[.05] p-3">
                  <span
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: seen ? s.bodyColor : "#1e293b" }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-bold text-sm">{seen ? s.name : "???"}</p>
                    <p className="text-[11px] text-white/50">
                      {seen ? `Lv.${s.minLevel}부터 · 처리 등급 ${s.maxTier}` : `Lv.${s.minLevel}에 성장`}
                    </p>
                  </div>
                  <span className={`ml-auto text-[11px] ${seen ? "text-teal-300" : "text-white/30"}`}>
                    {seen ? "발견" : "미발견"}
                  </span>
                </li>
              );
            })}
            {(Object.keys(BRANCHES) as (keyof typeof BRANCHES)[]).map((id) => {
              const b = BRANCHES[id];
              const seen = st.branch === id;
              return (
                <li key={id} className="flex items-center gap-3 rounded-2xl bg-white/[.05] p-3">
                  <span
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: seen ? b.bodyColor : "#1e293b" }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm">{seen ? b.name : "??? (진화 분기)"}</p>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      {seen ? b.desc : "성체가 될 때 먹은 쓰레기의 재질이 결정한다"}
                    </p>
                  </div>
                  <span className={`ml-auto shrink-0 text-[11px] ${seen ? "text-amber-300" : "text-white/30"}`}>
                    {seen ? "각성" : "미발견"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "achievements" && (
          <ul className="flex flex-col gap-2 sm:max-w-md sm:mx-auto">
            {ACHIEVEMENTS.map((a) => {
              const at = st.achievements[a.id];
              return (
                <li
                  key={a.id}
                  className={`flex items-center gap-3 rounded-2xl p-3 ${
                    at ? "bg-amber-400/10 border border-amber-300/20" : "bg-white/[.05]"
                  }`}
                >
                  <span className={`text-2xl shrink-0 ${at ? "" : "grayscale opacity-40"}`} aria-hidden>
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold text-sm ${at ? "" : "text-white/50"}`}>{a.name}</p>
                    <p className="text-[11px] text-white/50">{a.desc}</p>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] text-white/40 tabular-nums">
                    {at ? new Date(at).toLocaleDateString("ko-KR") : "잠김"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
