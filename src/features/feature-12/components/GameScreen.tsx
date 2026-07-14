"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DestroyableGame = { destroy: (removeCanvas: boolean) => void };

export default function GameScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let game: DestroyableGame | undefined;
    let cancelled = false;

    (async () => {
      // Phaser는 window에 의존하므로 클라이언트에서만 동적 로드한다
      const { createGame } = await import("../game");
      if (cancelled || !hostRef.current) return;
      game = createGame(hostRef.current);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-[#060613] text-white">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="-ml-1 flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition-colors hover:bg-white/10 active:bg-white/15"
        >
          ←
        </Link>
        <h1 className="text-base font-semibold">줍스 스위퍼</h1>
        <span className="ml-auto hidden text-xs text-white/50 sm:inline">
          🧲 우주쓰레기 수거 아케이드
        </span>
      </header>

      <div ref={hostRef} className="relative min-h-0 flex-1 overflow-hidden">
        {loading && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
            게임 불러오는 중…
          </p>
        )}
      </div>
    </div>
  );
}
