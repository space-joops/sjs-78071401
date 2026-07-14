"use client";

import { HEAL_TAPS_REQUIRED, MAX_HP } from "../lib/game";
import Starfield from "./Starfield";
import styles from "../styles.module.css";

type Props = {
  hp: number;
  stopped: boolean;
  onTap: () => void;
  onClose: () => void;
};

export default function HealOverlay({ hp, stopped, onTap, onClose }: Props) {
  const taps = Math.round((hp / MAX_HP) * HEAL_TAPS_REQUIRED);
  const done = !stopped;

  return (
    <div className="fixed inset-0 z-50 flex touch-none select-none flex-col overscroll-contain bg-[#0b0716] text-white">
      <Starfield />

      <div className="relative z-10 flex items-center justify-between p-4">
        <h2 className="text-lg font-bold">🏥 응급 치료</h2>
        {!done && (
          <button
            onClick={onClose}
            className="min-h-11 px-3 text-sm text-white/60 underline underline-offset-4"
          >
            나중에
          </button>
        )}
      </div>

      {done ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="text-7xl">🛰️</span>
          <p className="text-xl font-bold text-emerald-300">✨ 치료 완료!</p>
          <p className="text-sm text-white/70">
            줍스가 기운을 차렸어요. 다시 궤도로 올려 보내요.
          </p>
          <button
            onClick={onClose}
            className="mt-2 h-14 w-full max-w-xs rounded-2xl bg-emerald-400 font-bold text-black transition-transform active:scale-[0.98]"
          >
            🚀 궤도 비행 재개
          </button>
        </div>
      ) : (
        <button
          onPointerDown={onTap}
          className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <span key={hp} className={`${styles.tapPulse} inline-block text-7xl`}>
            😵
          </span>
          <div className="w-full max-w-xs">
            <div className="h-3 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-red-400 transition-all"
                style={{ width: `${(hp / MAX_HP) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs tabular-nums text-white/60">
              HP {hp}/{MAX_HP}
            </p>
          </div>
          <p className="text-base font-semibold">화면을 연속으로 탭해 치료하세요</p>
          <p className="text-sm tabular-nums text-white/60">
            {taps} / {HEAL_TAPS_REQUIRED}
          </p>
        </button>
      )}
    </div>
  );
}
