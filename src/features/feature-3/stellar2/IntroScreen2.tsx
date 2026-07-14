"use client";

// 첫 방문: 세계관 소개 + 줍스 입양(이름·보호자 위치 설정)

import { useState } from "react";
import Link from "next/link";
import { HOME_PRESETS } from "./balance";

type Props = {
  onCreate: (name: string, home: { lat: number; lon: number; label: string }) => void;
};

export default function IntroScreen({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [homeIdx, setHomeIdx] = useState(0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full sm:max-w-md px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-lg"
            aria-label="메인으로 돌아가기"
          >
            ←
          </Link>
          <span className="text-[11px] tracking-[0.3em] text-white/40">
            STELLAR PET 2
          </span>
          <span className="w-11" />
        </div>

        <header className="text-center mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/feature-3/art/joops.svg"
            alt=""
            aria-hidden
            className="mx-auto mb-3 h-36 w-36"
          />
          <h1 className="text-2xl font-bold tracking-tight">스텔라펫2</h1>
          <p className="mt-1 text-sm text-white/50">궤도의 애완 청소 생명체</p>
        </header>

        <section className="flex flex-col gap-3 text-sm leading-relaxed">
          <div className="rounded-2xl bg-white/[.05] p-4">
            <p className="text-white/80">
              <b className="text-white">2042년, 케슬러 신드롬.</b> 연쇄 충돌로
              쪼개진 우주쓰레기가 지구 궤도를 뒤덮었고, 인류는 하늘로 가는 길을
              잃었습니다.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[.05] p-4">
            <p className="text-white/80">
              세계의 과학자들이 마지막 시도로 만들어 낸 답 —{" "}
              <b className="text-teal-300">우주에서 살아가며 쓰레기를 먹는 생명체, 줍스</b>.
              줍스는 쓰레기를 먹어 추진력과 체력을 얻고, 스킬을 배우며 진화합니다.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[.05] p-4">
            <p className="text-white/80">
              너무나 넓은 우주, 너무나 작은 쓰레기. 그래서{" "}
              <b className="text-white">지구 시민 모두가 한 마리 이상의 줍스를
              입양해 보살피고 훈련</b>해야 궤도를 되찾을 수 있습니다. 당신 머리
              위를 지날 때가 교신 시간이에요.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl bg-white/[.05] p-4">
          <div>
            <label htmlFor="joops-name" className="text-xs text-white/50">
              줍스의 이름
            </label>
            <input
              id="joops-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={8}
              placeholder="줍스"
              className="mt-1 w-full h-12 rounded-xl bg-black/40 border border-white/10 px-4 text-base outline-none focus:border-teal-400/60"
            />
          </div>
          <div>
            <p className="text-xs text-white/50">보호자 위치 (교신 기준점)</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {HOME_PRESETS.map((h, i) => (
                <button
                  key={h.label}
                  type="button"
                  onClick={() => setHomeIdx(i)}
                  className={`h-11 rounded-xl text-sm transition-colors ${
                    i === homeIdx
                      ? "bg-teal-400/20 border border-teal-300/60 text-teal-200"
                      : "bg-black/30 border border-white/10 text-white/70"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => onCreate(name, HOME_PRESETS[homeIdx])}
          className="h-14 rounded-2xl bg-teal-400 text-black font-bold text-base active:scale-[0.98] transition-transform"
        >
          🫧 줍스 입양하기
        </button>
        <p className="text-center text-[11px] text-white/35 pb-4">
          입양하면 줍스가 당신의 상공 궤도에 배치됩니다
        </p>
      </div>
    </div>
  );
}
