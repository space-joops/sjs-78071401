"use client";
// 첫 방문 온보딩 — 케슬러 신드롬 세계관 소개 + 줍스 이름 짓기
import { useState } from "react";
import { CITIES } from "../lib/constants";
import { joopsDataUrl } from "../lib/joopsArt";
import type { OwnerLoc } from "../lib/types";

const SLIDES = [
  {
    icon: "💥",
    title: "2049년, 케슬러 신드롬",
    body: "폭주한 우주쓰레기가 서로 부딪히며 기하급수로 늘어나기 시작했어요. 이대로면 인류는 지구에 갇히고 말아요.",
  },
  {
    icon: "🧪",
    title: "과학자들의 마지막 시도",
    body: "세계의 과학자들이 힘을 모아 우주에서 살아가는 생명체를 만들었어요. 우주쓰레기를 먹고 추진력과 체력을 얻고, 먹을수록 진화하는 애완 생명체 — 줍스!",
  },
  {
    icon: "🌏",
    title: "지구 시민 모두가 한 마리씩",
    body: "너무 넓은 우주, 너무 작은 쓰레기. 모두가 자신의 줍스를 보살피고 훈련시켜야 궤도를 되찾을 수 있어요. 당신의 줍스를 깨워주세요.",
  },
];

export default function Onboarding({
  onCreate,
}: {
  onCreate: (name: string, owner: OwnerLoc) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [cityIdx, setCityIdx] = useState(0);
  const last = step >= SLIDES.length;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
        {!last ? (
          <>
            <div className="text-5xl">{SLIDES[step].icon}</div>
            <h2 className="mt-4 text-xl font-bold">{SLIDES[step].title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {SLIDES[step].body}
            </p>
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-5 bg-teal-300" : "w-1.5 bg-white/25"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setStep(step + 1)}
              className="mt-6 min-h-11 w-full rounded-full bg-teal-300 px-5 font-semibold text-[#062a24] transition-transform active:scale-95"
            >
              {step === SLIDES.length - 1 ? "줍스 깨우기" : "다음"}
            </button>
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="mt-2 min-h-11 w-full rounded-full text-sm text-white/50"
              >
                이전
              </button>
            )}
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={joopsDataUrl({ stage: 0, mood: "happy" })}
              alt="아기 줍스"
              className="mx-auto w-28 animate-bounce"
            />
            <h2 className="mt-2 text-xl font-bold">태어났어요!</h2>
            <p className="mt-2 text-sm text-white/70">
              당신의 아기 줍스에게 이름을 지어주세요.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
              placeholder="예: 뽀작이"
              className="mt-4 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-center text-base outline-none placeholder:text-white/30 focus:border-teal-300"
            />
            <label className="mt-4 block text-left text-xs text-white/60">
              관제소 위치 (줍스가 내 상공에 오면 교신할 수 있어요)
            </label>
            <select
              value={cityIdx}
              onChange={(e) => setCityIdx(Number(e.target.value))}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base outline-none focus:border-teal-300"
            >
              {CITIES.map((c, i) => (
                <option key={c.city} value={i} className="bg-[#0a0a1a]">
                  {c.city}
                </option>
              ))}
            </select>
            <button
              disabled={!name.trim()}
              onClick={() => onCreate(name.trim(), CITIES[cityIdx])}
              className="mt-5 min-h-11 w-full rounded-full bg-teal-300 px-5 font-semibold text-[#062a24] transition-transform active:scale-95 disabled:opacity-40"
            >
              첫 궤도에 올리기 🚀
            </button>
          </>
        )}
      </div>
    </div>
  );
}
