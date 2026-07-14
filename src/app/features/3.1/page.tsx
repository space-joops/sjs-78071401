import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "스텔라펫2 — Space Joops",
  description:
    "알에서 부화하는 줍스 2세대. 진화 분기·훈련 미니게임·도감·이벤트가 추가된 개선판.",
};

// 스캐폴드: 다음 커밋에서 Stellar2App으로 교체된다.
export default function Feature31Page() {
  return (
    <div className="font-sans min-h-dvh flex flex-col items-center justify-center gap-6 p-4 bg-[#02040a] text-white">
      <span className="text-5xl" aria-hidden>
        🐣
      </span>
      <h1 className="text-2xl font-bold">스텔라펫2</h1>
      <p className="text-sm text-white/60">부화 준비 중…</p>
      <Link
        href="/"
        className="rounded-full border border-white/15 px-5 h-11 flex items-center text-sm font-medium"
      >
        ← 메인으로 돌아가기
      </Link>
    </div>
  );
}
