"use client";

import Link from "next/link";
import { useState } from "react";
import GameView from "./GameView";
import LoreView from "./LoreView";
import RankingView from "./RankingView";
import WelcomeBackModal from "./WelcomeBackModal";
import { useStellarPet } from "./useStellarPet";

type Tab = "swim" | "rank" | "lore";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "swim", label: "유영", emoji: "🪐" },
  { id: "rank", label: "랭킹", emoji: "🏆" },
  { id: "lore", label: "세계관", emoji: "📖" },
];

export default function StellarPetApp() {
  const { pet, report, eat, rename, dismissReport } = useStellarPet();
  const [tab, setTab] = useState<Tab>("swim");

  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#05060f] font-sans text-white">
      {pet ? (
        <>
          {tab === "swim" && (
            <GameView pet={pet} onEat={eat} onRename={rename} />
          )}
          {tab === "rank" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <TopBar />
              <RankingView pet={pet} />
            </div>
          )}
          {tab === "lore" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <TopBar />
              <LoreView onGoSwim={() => setTab("swim")} />
            </div>
          )}

          <nav
            aria-label="스텔라펫 메뉴"
            className="flex shrink-0 border-t border-white/10 bg-[#05060f]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                  tab === t.id ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {t.emoji}
                </span>
                {t.label}
              </button>
            ))}
          </nav>

          {report && (
            <WelcomeBackModal pet={pet} report={report} onClose={dismissReport} />
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <span className="animate-pulse text-4xl" aria-hidden>
            🪐
          </span>
          <p className="text-xs text-white/50">궤도와 교신 중…</p>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex shrink-0 items-center gap-2 p-3 sm:p-4">
      <Link
        href="/"
        aria-label="메인으로 돌아가기"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-lg text-white transition-colors hover:bg-white/15"
      >
        ←
      </Link>
      <span className="text-sm font-bold tracking-tight">STELLAR PET</span>
      <span className="font-mono text-[10px] text-white/35">ORBITA ACCORD</span>
    </div>
  );
}
