"use client";

// 첫 실행 — 케슬러 신드롬 배경 스토리와 줍스 입양(이름·홈 위치 설정).

import { useState } from "react";
import { HOME_PRESETS } from "./constants";
import JoopsPortrait from "../JoopsPortrait";
import { getJoopsStoreV2 } from "./store";

export default function AdoptScreenV2() {
  const [name, setName] = useState("");
  const [home, setHome] = useState(HOME_PRESETS[0]);
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHome({ label: "내 위치", lat: p.coords.latitude, lon: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const adopt = () => {
    getJoopsStoreV2().create(name, home);
  };

  return (
    <div className="flex min-h-full flex-col items-center overflow-y-auto bg-[radial-gradient(ellipse_at_20%_10%,rgba(88,70,160,0.28),transparent_55%),radial-gradient(ellipse_at_80%_30%,rgba(30,110,140,0.22),transparent_55%)] p-4">
      <div className="my-auto flex w-full max-w-sm flex-col items-center gap-4 py-6">
        <JoopsPortrait size={130} stageIndex={0} mood="happy" />

        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          줍줍스2
        </h1>

        <div className="rounded-xl border border-white/10 bg-[#0a1526]/80 p-4 text-sm leading-relaxed text-white/75">
          <p>
            궤도 파편의 연쇄 충돌 — <b className="text-white">케슬러 신드롬</b>이 현실이 된 시대.
            인류는 우주로 나가는 길을 잃을 위기에 처했습니다.
          </p>
          <p className="mt-2">
            세계의 과학자들이 내놓은 해답은 우주에서 살아가며{" "}
            <b className="text-cyan-300">우주쓰레기를 먹는 인공 생명체, 줍스</b>. 너무나 넓은
            우주의 아주 작은 쓰레기까지 치우려면, 지구 시민 모두가 한 마리의 줍스를 보살피고
            훈련시켜야 해요.
          </p>
          <p className="mt-2">이제 당신 차례예요. 🛰️</p>
        </div>

        <label className="w-full">
          <span className="mb-1 block text-xs font-semibold text-white/60">줍스의 이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="줍스"
            maxLength={10}
            className="h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-base text-white placeholder:text-white/30 focus:border-cyan-300/60 focus:outline-none"
          />
        </label>

        <div className="w-full">
          <span className="mb-1 block text-xs font-semibold text-white/60">
            홈 위치 (줍스가 이 상공을 지날 때 교신할 수 있어요)
          </span>
          <div className="flex flex-wrap gap-2">
            {HOME_PRESETS.slice(0, 5).map((h) => (
              <button
                key={h.label}
                onClick={() => setHome(h)}
                className={`h-11 rounded-full px-4 text-xs font-semibold transition-colors ${
                  home.label === h.label
                    ? "bg-cyan-300 text-cyan-950"
                    : "border border-white/15 bg-white/5 text-white/80"
                }`}
              >
                {h.label}
              </button>
            ))}
            <button
              onClick={useMyLocation}
              className="h-11 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 text-xs font-semibold text-cyan-200"
            >
              {locating ? "찾는 중…" : home.label === "내 위치" ? "📍 내 위치 ✓" : "📍 내 위치 사용"}
            </button>
          </div>
        </div>

        <button
          onClick={adopt}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 text-base font-bold text-slate-900 transition-transform active:scale-[0.98]"
        >
          {name.trim() || "줍스"} 입양하기 🚀
        </button>

        <p className="text-center text-[11px] leading-relaxed text-white/35">
          입양하면 줍스는 홈 상공 저궤도에서 여정을 시작하고,
          <br />
          당신이 접속하지 않는 동안에도 궤도를 돌며 청소를 계속해요.
        </p>
      </div>
    </div>
  );
}
