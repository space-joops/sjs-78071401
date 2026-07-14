"use client";

// 부재 중 자율 비행 보고서 — 접속하지 않는 동안 줍스가 해낸 일

import type { AwayReport } from "./store";

function formatAway(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 ${min % 60}분`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간`;
}

type Props = { report: AwayReport; name: string; onClose: () => void };

export default function AwayReportModal({ report, name, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div className="w-full sm:max-w-sm rounded-2xl bg-[#0b1220] border border-white/10 p-5 flex flex-col gap-4">
        <header className="text-center">
          <div className="text-4xl" aria-hidden>
            📡
          </div>
          <h2 className="mt-2 text-lg font-bold">부재 중 비행 보고서</h2>
          <p className="mt-1 text-xs text-white/50">
            {formatAway(report.awayMs)} 동안 {name}는 혼자서도 궤도를 청소했어요
          </p>
        </header>

        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex justify-between rounded-xl bg-white/[.05] px-4 py-3">
            <span className="text-white/70">🗑️ 청소한 우주쓰레기</span>
            <b className="text-teal-300">{report.debris.toLocaleString()}개</b>
          </li>
          <li className="flex justify-between rounded-xl bg-white/[.05] px-4 py-3">
            <span className="text-white/70">✨ 획득 경험치</span>
            <b className="text-teal-300">+{report.xp.toLocaleString()} XP</b>
          </li>
          <li className="flex justify-between rounded-xl bg-white/[.05] px-4 py-3">
            <span className="text-white/70">💞 다른 줍스와 조우</span>
            <b className="text-pink-300">{report.encounters}회</b>
          </li>
          {report.collisions > 0 && (
            <li className="flex justify-between rounded-xl bg-red-400/10 px-4 py-3">
              <span className="text-red-200/80">💥 파편 충돌 사고</span>
              <b className="text-red-300">
                {report.collisions}회 (체력 -{report.healthLost})
              </b>
            </li>
          )}
        </ul>

        {report.collisions > 0 && (
          <p className="text-xs text-amber-200/70 text-center">
            충돌로 지친 {name}에게 수리와 보살핌이 필요해요!
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-xl bg-teal-400 text-black font-bold active:scale-[0.98] transition-transform"
        >
          {name} 만나러 가기
        </button>
      </div>
    </div>
  );
}
