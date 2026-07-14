"use client";

// 일일 미션 + 접속 스트릭 — 재방문 동기.

import { getJoopsStoreV2, type SnapshotV2 } from "./store";
import { STREAK } from "./constants";

export default function MissionSheet({
  snap,
  onToast,
}: {
  snap: SnapshotV2;
  onToast: (t: { text: string; tone: "good" | "bad" | "info" }) => void;
}) {
  const store = getJoopsStoreV2();
  const { missions } = snap.st.daily;
  const streak = snap.st.streak;
  const toNextGift =
    STREAK.giftEveryDays - (streak.count % STREAK.giftEveryDays || STREAK.giftEveryDays);

  return (
    <section className="flex flex-col gap-3">
      {/* 스트릭 */}
      <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.07] p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
            접속 스트릭
          </h3>
          <span className="text-[10px] text-white/40">최고 {streak.best}일</span>
        </div>
        <p className="mt-1 text-xl font-bold text-white">
          🔥 {streak.count}일 연속
          <span className="ml-2 text-sm font-normal text-amber-200">
            XP ×{snap.streakMult.toFixed(2)}
          </span>
        </p>
        <p className="mt-1 text-xs text-white/45">
          {toNextGift === STREAK.giftEveryDays
            ? "오늘 글로벌 링크 코어를 받았어요! 🌐"
            : `${toNextGift}일 더 접속하면 글로벌 링크 코어를 받아요`}
        </p>
      </div>

      {/* 미션 */}
      <div className="rounded-xl border border-white/10 bg-[#0a1526]/80 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
            오늘의 미션
          </h3>
          <span className="text-[10px] text-white/40">
            {snap.missionsDone}/{missions.length} 완료
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {missions.map((m) => {
            const pct = Math.min(100, (m.progress / m.goal) * 100);
            return (
              <div key={m.id} className="rounded-lg bg-white/[0.04] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{m.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/85">
                    {m.label}
                  </span>
                  {m.done && !m.claimed ? (
                    <button
                      onClick={() => {
                        const xp = store.claimMission(m.id);
                        if (xp > 0) onToast({ text: `미션 완료! +${xp} XP 🎁`, tone: "good" });
                      }}
                      className="h-9 shrink-0 rounded-full bg-emerald-300 px-3 text-[11px] font-bold text-emerald-950 transition-transform active:scale-95"
                    >
                      +{m.rewardXp} 받기
                    </button>
                  ) : m.claimed ? (
                    <span className="shrink-0 text-[11px] font-bold text-emerald-300">완료 ✓</span>
                  ) : (
                    <span className="shrink-0 font-mono text-[11px] text-white/50">
                      {m.progress}/{m.goal}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      m.done ? "bg-emerald-300" : "bg-cyan-300"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-white/30">매일 자정에 새로운 미션이 도착해요</p>
      </div>
    </section>
  );
}
