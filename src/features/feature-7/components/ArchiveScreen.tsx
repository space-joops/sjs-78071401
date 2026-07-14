"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CATALOG,
  CATEGORY_META,
  CATEGORY_ORDER,
  MILESTONES,
  RARITY_META,
  RARITY_ORDER,
  type Category,
  type JunkItem,
} from "../data/catalog";
import {
  MAX_ENERGY,
  REGEN_MS,
  SCAN_DURATION_MS,
  applyRegen,
  consumeEnergy,
  createInitialState,
  loadState,
  pickDiscovery,
  saveState,
  type ArchiveState,
} from "../lib/store";

import ItemDetailSheet from "./ItemDetailSheet";
import ScanOverlay from "./ScanOverlay";

type Tab = Category | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  ...CATEGORY_ORDER.map((c) => ({ key: c as Tab, label: CATEGORY_META[c].short })),
];

export default function ArchiveScreen() {
  const [state, setState] = useState<ArchiveState>(createInitialState);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<JunkItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [reveal, setReveal] = useState<JunkItem | null>(null);
  const [now, setNow] = useState(0);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = Date.now();
    setState(applyRegen(loadState(), t));
    setNow(t);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((s) => applyRegen(s, t));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (loaded) saveState(state);
  }, [state, loaded]);

  useEffect(
    () => () => {
      if (scanTimer.current) clearTimeout(scanTimer.current);
    },
    []
  );

  const total = CATALOG.length;
  const discoveredCount = Object.keys(state.discovered).length;
  const pct = Math.round((discoveredCount / total) * 100);
  const remaining = total - discoveredCount;
  const items = tab === "all" ? CATALOG : CATALOG.filter((i) => i.category === tab);
  const regenSeconds =
    state.energy < MAX_ENERGY
      ? Math.max(0, Math.ceil((REGEN_MS - (now - state.lastRegenAt)) / 1000))
      : null;
  const canScan = loaded && !scanning && state.energy > 0 && remaining > 0;

  function startScan() {
    if (!canScan) return;
    const found = pickDiscovery(state);
    if (!found) return;
    setScanning(true);
    setState((s) => consumeEnergy(s, Date.now()));
    scanTimer.current = setTimeout(() => {
      setState((s) => ({
        ...s,
        discovered: { ...s.discovered, [found.id]: Date.now() },
        fresh: [...s.fresh, found.id],
      }));
      setScanning(false);
      setReveal(found);
    }, SCAN_DURATION_MS);
  }

  function openDetail(item: JunkItem) {
    setSelected(item);
    if (state.fresh.includes(item.id)) {
      setState((s) => ({ ...s, fresh: s.fresh.filter((id) => id !== item.id) }));
    }
  }

  return (
    <div className="font-sans flex min-h-dvh flex-col bg-white text-black dark:bg-[#0a0a0a] dark:text-white">
      <header className="flex w-full items-center gap-1 px-2 pb-2 pt-3 sm:mx-auto sm:max-w-2xl sm:px-0">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl transition-colors hover:bg-black/[.05] dark:hover:bg-white/[.08]"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">우주쓰레기 도감</h1>
          <p className="truncate text-[11px] text-black/50 dark:text-white/50">
            실제 우주 역사에서 온 잔해 아카이브
          </p>
        </div>
        <div className="shrink-0 pr-2 text-right">
          <div className="text-lg font-bold tabular-nums leading-tight">{pct}%</div>
          <div className="text-[10px] text-black/50 dark:text-white/50">
            {discoveredCount}/{total} 수집
          </div>
        </div>
      </header>

      <main className="w-full flex-1 overflow-y-auto px-3 pb-4 sm:mx-auto sm:max-w-2xl sm:px-0">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.1]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="도감 완성률"
        >
          <div
            className="h-full rounded-full bg-black transition-all duration-700 dark:bg-white"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {RARITY_ORDER.map((rarity) => {
            const all = CATALOG.filter((i) => i.rarity === rarity);
            const got = all.filter((i) => i.id in state.discovered).length;
            return (
              <span
                key={rarity}
                className="flex items-center gap-1 text-[11px] text-black/60 dark:text-white/60"
              >
                <span
                  className={`h-2 w-2 rounded-full ${RARITY_META[rarity].dot}`}
                  aria-hidden
                />
                {RARITY_META[rarity].label}{" "}
                <span className="tabular-nums font-semibold">
                  {got}/{all.length}
                </span>
              </span>
            );
          })}
        </div>

        <div className="mt-3 flex gap-1.5">
          {MILESTONES.map((m) => {
            const achieved = pct >= m.pct;
            return (
              <div
                key={m.pct}
                title={`${m.pct}% 달성 보상`}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center ${
                  achieved
                    ? "border-amber-400/70 bg-amber-50 dark:border-amber-400/50 dark:bg-amber-950/40"
                    : "border-black/[.07] opacity-50 dark:border-white/[.1]"
                }`}
              >
                <span className={achieved ? "" : "grayscale"} aria-hidden>
                  {m.icon}
                </span>
                <span className="text-[9px] font-semibold leading-tight">
                  {m.title}
                </span>
                <span className="text-[9px] text-black/45 dark:text-white/45">
                  {m.pct}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {TABS.map((t) => {
            const scope =
              t.key === "all" ? CATALOG : CATALOG.filter((i) => i.category === t.key);
            const got = scope.filter((i) => i.id in state.discovered).length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`h-11 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
                    : "border-black/[.1] text-black/60 hover:bg-black/[.04] dark:border-white/[.15] dark:text-white/60 dark:hover:bg-white/[.06]"
                }`}
              >
                {t.label}{" "}
                <span className="tabular-nums opacity-70">
                  {got}/{scope.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => {
            const discovered = item.id in state.discovered;
            const isFresh = state.fresh.includes(item.id);
            const rarity = RARITY_META[item.rarity];
            return (
              <button
                key={item.id}
                onClick={() => openDetail(item)}
                aria-label={discovered ? item.name : "미발견 잔해"}
                className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border p-1 transition-transform active:scale-95 ${
                  discovered
                    ? `${rarity.cardBorder} ${rarity.cardBg}`
                    : "border-dashed border-black/[.15] dark:border-white/[.15]"
                }`}
              >
                <span
                  className={`absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${rarity.dot}`}
                  aria-hidden
                />
                {isFresh && (
                  <span className="absolute right-1 top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
                    NEW
                  </span>
                )}
                <span
                  className={`text-2xl sm:text-3xl ${discovered ? "" : "opacity-35 grayscale"}`}
                  aria-hidden
                >
                  {discovered ? item.icon : "❔"}
                </span>
                <span
                  className={`w-full truncate px-1 text-center text-[10px] leading-tight ${
                    discovered
                      ? "font-semibold"
                      : "text-black/40 dark:text-white/40"
                  }`}
                >
                  {discovered ? item.name : "???"}
                </span>
              </button>
            );
          })}
        </div>

        {remaining === 0 && (
          <p className="mt-4 rounded-2xl border border-amber-400/60 bg-amber-50 p-3 text-center text-xs font-semibold dark:bg-amber-950/40">
            🎉 도감 완성! 당신은 진정한 {`‘우주 고고학자’`}입니다.
          </p>
        )}
      </main>

      <footer className="w-full border-t border-black/[.06] bg-white/90 px-3 py-3 backdrop-blur dark:border-white/[.08] dark:bg-[#0a0a0a]/90">
        <div className="flex items-center gap-3 sm:mx-auto sm:max-w-2xl">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1" aria-label="스캔 배터리">
              {Array.from({ length: MAX_ENERGY }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-5 rounded-full ${
                    i < state.energy
                      ? "bg-emerald-500"
                      : "bg-black/[.1] dark:bg-white/[.12]"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 truncate text-[11px] text-black/50 dark:text-white/50">
              {remaining === 0
                ? "모든 잔해를 수집했습니다"
                : regenSeconds !== null
                  ? `다음 배터리 충전까지 ${regenSeconds}초 · 미발견 ${remaining}점`
                  : `배터리 완충 · 미발견 ${remaining}점`}
            </p>
          </div>
          <button
            onClick={startScan}
            disabled={!canScan}
            className="h-12 shrink-0 rounded-full bg-black px-6 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {scanning
              ? "스캔 중…"
              : remaining === 0
                ? "도감 완성!"
                : "🛰️ 궤도 스캔"}
          </button>
        </div>
      </footer>

      {selected && (
        <ItemDetailSheet
          item={selected}
          discoveredAt={state.discovered[selected.id]}
          onClose={() => setSelected(null)}
        />
      )}
      <ScanOverlay
        scanning={scanning}
        reveal={reveal}
        onConfirm={() => setReveal(null)}
      />
    </div>
  );
}
