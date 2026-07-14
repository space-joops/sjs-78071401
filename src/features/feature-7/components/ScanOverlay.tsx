"use client";

import { RARITY_META, type JunkItem } from "../data/catalog";
import styles from "./archive.module.css";

type Props = {
  /** true면 스캔 연출, reveal이 있으면 발견 결과 표시 */
  scanning: boolean;
  reveal: JunkItem | null;
  onConfirm: () => void;
};

export default function ScanOverlay({ scanning, reveal, onConfirm }: Props) {
  if (!scanning && !reveal) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/90 px-6 text-center text-white">
      {scanning && (
        <>
          <div className={styles.radar} aria-hidden />
          <div>
            <p className="animate-pulse text-sm font-semibold">
              심우주 잔해 스캔 중…
            </p>
            <p className="mt-2 text-xs text-white/50">
              줍스가 궤도의 냄새를 맡고 있어요
            </p>
          </div>
        </>
      )}

      {!scanning && reveal && (
        <>
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute h-48 w-48 rounded-full blur-3xl ${RARITY_META[reveal.rarity].aura}`}
              aria-hidden
            />
            <span
              className={`relative text-7xl ${styles.pop} ${styles.float}`}
              aria-hidden
            >
              {reveal.icon}
            </span>
          </div>
          <div className={styles.pop}>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${RARITY_META[reveal.rarity].chip}`}
            >
              {RARITY_META[reveal.rarity].label}
            </span>
            <h2 className="mt-3 text-xl font-bold">{reveal.name}</h2>
            <p className="mt-1 text-xs text-white/60">
              도감에 새로 등록되었습니다!
            </p>
            <p className="mt-4 text-sm text-white/80">{`“${reveal.joopsNote}”`}</p>
          </div>
          <button
            onClick={onConfirm}
            className="h-12 rounded-full bg-white px-8 text-sm font-bold text-black transition-transform active:scale-95"
          >
            확인
          </button>
        </>
      )}
    </div>
  );
}
