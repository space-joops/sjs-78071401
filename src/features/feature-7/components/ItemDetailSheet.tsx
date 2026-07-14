"use client";

import { CATEGORY_META, RARITY_META, type JunkItem } from "../data/catalog";
import styles from "./archive.module.css";

type Props = {
  item: JunkItem;
  /** 발견 시각(ms). undefined면 미발견 상태로 표시 */
  discoveredAt?: number;
  onClose: () => void;
};

export default function ItemDetailSheet({ item, discoveredAt, onClose }: Props) {
  const discovered = discoveredAt !== undefined;
  const rarity = RARITY_META[item.rarity];
  const category = CATEGORY_META[item.category];

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={discovered ? item.name : "미발견 잔해"}
    >
      <div
        className={`${styles.sheetUp} max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 dark:bg-[#111] sm:max-w-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`text-5xl ${discovered ? "" : "opacity-40 grayscale"}`}
            aria-hidden
          >
            {discovered ? item.icon : "❔"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug">
              {discovered ? item.name : "??? — 미확인 잔해"}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rarity.chip}`}
              >
                {rarity.label}
              </span>
              <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-[11px] font-medium text-black/60 dark:bg-white/[.08] dark:text-white/60">
                {category.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-black/50 transition-colors hover:bg-black/[.05] dark:text-white/50 dark:hover:bg-white/[.08]"
          >
            ✕
          </button>
        </div>

        {discovered ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["연대", String(item.year)],
                ["출처", item.origin],
                ["질량", item.mass],
                ["궤도", item.orbit],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-black/[.04] px-3 py-2 dark:bg-white/[.06]"
                >
                  <dt className="text-[10px] text-black/45 dark:text-white/45">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-xs font-semibold leading-snug">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-black/45 dark:text-white/45">
              아카이브 기록
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-black/75 dark:text-white/75">
              {item.lore}
            </p>

            <div className="mt-4 rounded-2xl border border-black/[.08] bg-black/[.03] p-3 dark:border-white/[.1] dark:bg-white/[.05]">
              <p className="text-[11px] font-semibold text-black/50 dark:text-white/50">
                🛰️ 줍스의 한마디
              </p>
              <p className="mt-1 text-sm leading-snug">{`“${item.joopsNote}”`}</p>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-black/45 dark:text-white/45">
              {category.label} 계열의 쓰레기를 많이 먹으면 {`‘${category.evolution}’`}{" "}
              진화에 가까워집니다 · 수집일{" "}
              {new Date(discoveredAt).toLocaleDateString("ko-KR")}
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 text-sm leading-relaxed text-black/70 dark:text-white/70">
              {item.hint}
            </p>
            <p className="mt-3 text-[11px] text-black/45 dark:text-white/45">
              아직 발견하지 못한 잔해입니다. 궤도 스캔으로 줍스를 보내
              찾아보세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
