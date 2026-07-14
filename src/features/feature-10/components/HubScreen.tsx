"use client";
// 점프 러너 허브 — 소개·조작법·최고 기록·시작 버튼.
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadBest } from "../lib/state";

export default function HubScreen() {
  // 최고 기록은 localStorage 값이라 hydration 이후에 읽는다
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    setBest(loadBest());
  }, []);

  return (
    <div className="font-sans relative flex min-h-dvh flex-col overflow-hidden bg-[#050514] text-white">
      {/* 배경 별 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[
          "left-[12%] top-[18%]",
          "left-[78%] top-[12%]",
          "left-[62%] top-[32%]",
          "left-[24%] top-[46%]",
          "left-[88%] top-[54%]",
          "left-[8%] top-[70%]",
          "left-[70%] top-[78%]",
          "left-[40%] top-[8%]",
        ].map((cls) => (
          <span
            key={cls}
            className={`absolute h-1 w-1 rounded-full bg-white/50 ${cls}`}
          />
        ))}
      </div>

      <header className="z-10 flex items-center p-3">
        <Link
          href="/"
          className="flex h-11 items-center gap-1 rounded-full bg-white/10 px-4 text-sm font-medium backdrop-blur transition-colors hover:bg-white/15"
        >
          ← 메인으로
        </Link>
      </header>

      <main className="z-10 flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
        <div>
          <div className="text-6xl" aria-hidden>
            🌠
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">점프 러너</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/60">
            달 표면을 질주하는 줍스! 우주쓰레기를 뛰어넘고 별 조각을 모으며
            최대한 멀리 달려보세요.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-2 text-sm text-amber-200">
          <span aria-hidden>🏆</span>
          <span>
            최고 기록{" "}
            <strong className="tabular-nums">{best ?? "—"}</strong>점
          </span>
        </div>

        <ul className="w-full max-w-xs space-y-2 text-left text-sm text-white/70">
          <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="text-xl" aria-hidden>
              👆
            </span>
            화면 탭 또는 스페이스 키로 점프
          </li>
          <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="text-xl" aria-hidden>
              🗑️
            </span>
            우주쓰레기에 부딪히면 게임 오버
          </li>
          <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="text-xl" aria-hidden>
              ⭐
            </span>
            별 조각을 모으면 보너스 점수
          </li>
        </ul>
      </main>

      <footer className="z-10 p-4 pb-6">
        <Link
          href="/features/10/play"
          className="mx-auto flex min-h-12 w-full max-w-xs items-center justify-center rounded-full bg-teal-300 text-base font-bold text-black transition-transform active:scale-95"
        >
          게임 시작
        </Link>
      </footer>
    </div>
  );
}
