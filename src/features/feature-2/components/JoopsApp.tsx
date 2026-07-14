"use client";

// 줍스 앱 루트 — 세이브 로드, 지도 데이터 로드, 탭 내비게이션, 모달

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { levelFromXp, stageForLevel } from "../lib/gameConfig";
import { buildEarthTextures, type EarthTextures } from "../lib/earthTexture";
import { parseCountries, type Country } from "../lib/geo";
import { setMuted } from "../lib/sound";
import {
  getState,
  loadOrCreate,
  mutate,
  persist,
  useSave,
  type OfflineReport,
} from "../lib/store";
import FlyView from "./FlyView";
import TrackerView from "./TrackerView";
import CareView from "./CareView";
import InfoView from "./InfoView";

type Tab = "fly" | "track" | "care" | "info";

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: "fly", emoji: "🚀", label: "비행" },
  { id: "track", emoji: "🛰️", label: "관제" },
  { id: "care", emoji: "💗", label: "돌봄" },
  { id: "info", emoji: "📖", label: "정보" },
];

export default function JoopsApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("fly");
  const [report, setReport] = useState<OfflineReport | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const texturesRef = useRef<EarthTextures | null>(null);
  const save = useSave();

  useEffect(() => {
    const { report } = loadOrCreate();
    const s = getState();
    if (s) setMuted(s.muted);
    if (report) setReport(report);
    if (s && !s.introSeen) setShowIntro(true);

    let cancelled = false;
    (async () => {
      let parsed: Country[] | null = null;
      try {
        const res = await fetch("/feature-2/countries-50m.json");
        if (res.ok) parsed = parseCountries(await res.json());
      } catch {
        parsed = null; // 지도 없이도 게임은 진행
      }
      if (cancelled) return;
      texturesRef.current = buildEarthTextures(parsed);
      setCountries(parsed);
      setReady(true);
    })();

    const onUnload = () => persist();
    const persistTimer = setInterval(persist, 20_000);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      cancelled = true;
      clearInterval(persistTimer);
      window.removeEventListener("beforeunload", onUnload);
      persist();
    };
  }, []);

  const level = save ? levelFromXp(save.xp) : 1;
  const stage = save ? stageForLevel(level) : null;

  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#030611] font-sans text-slate-100">
      {/* 상단 바 — 메인 복귀 내비게이션 필수 */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 px-2">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-slate-300 transition-colors hover:bg-white/10"
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-bold">👾 {save?.name ?? "줍스"}</span>
          {stage && (
            <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300 min-[380px]:inline">
              {stage.name}
            </span>
          )}
          <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
            Lv.{level}
          </span>
        </div>
        <button
          aria-label={save?.muted ? "소리 켜기" : "소리 끄기"}
          onClick={() => {
            mutate((s) => {
              s.muted = !s.muted;
              setMuted(s.muted);
            });
          }}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-base transition-colors hover:bg-white/10"
        >
          {save?.muted ? "🔇" : "🔊"}
        </button>
      </header>

      {/* 본문 */}
      <main className="relative min-h-0 flex-1">
        {!ready || !save ? (
          <Splash />
        ) : (
          <>
            {tab === "fly" && texturesRef.current && (
              <FlyView
                textures={texturesRef.current}
                countries={countries}
                onNeedCare={() => setTab("care")}
              />
            )}
            {tab === "track" && texturesRef.current && (
              <TrackerView textures={texturesRef.current} countries={countries} />
            )}
            {tab === "care" && <CareView />}
            {tab === "info" && <InfoView />}
          </>
        )}
      </main>

      {/* 하단 탭 (터치 타깃 44px 이상) */}
      <nav className="grid shrink-0 grid-cols-4 border-t border-white/10 bg-black/40 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map((t) => {
          const active = tab === t.id;
          const alert = t.id === "care" && save?.careNeeded;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                active ? "text-cyan-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="text-lg">{t.emoji}</span>
              {t.label}
              {alert && (
                <span className="absolute right-[calc(50%-18px)] top-2.5 h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              )}
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-cyan-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* 첫 방문 인트로 */}
      {showIntro && save && (
        <IntroModal
          onStart={(name) => {
            mutate((s) => {
              s.introSeen = true;
              if (name.trim()) s.name = name.trim().slice(0, 10);
            });
            persist();
            setShowIntro(false);
          }}
        />
      )}

      {/* 부재중 보고서 */}
      {report && !showIntro && (
        <ReportModal report={report} name={save?.name ?? "줍스"} onClose={() => setReport(null)} />
      )}
    </div>
  );
}

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <span className="animate-bounce text-5xl">👾</span>
      <p className="animate-pulse text-sm text-slate-400">궤도의 줍스와 교신 중…</p>
    </div>
  );
}

function IntroModal({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("줍스");
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-5">
        <p className="text-center text-4xl">🌏💥🛰️</p>
        <h2 className="mt-3 text-center text-base font-bold text-white">
          케슬러 신드롬의 시대
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          연쇄 충돌로 불어난 우주쓰레기가 궤도를 뒤덮자, 세계의 과학자들은 우주에서
          살아가는 애완 생명체 <b className="text-cyan-300">줍스</b>를 만들어냈어요.
          줍스는 우주쓰레기를 먹으며 추진력과 에너지를 얻고, 성장하고, 진화해요.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          하지만 우주는 너무 넓어서, 지구 시민 모두의 도움이 필요해요. 당신의 줍스를
          보살피고 훈련시켜 주세요. 줍스는 당신이 없는 동안에도 궤도를 돌며 청소를
          계속한답니다.
        </p>
        <label className="mt-4 text-[11px] font-semibold text-slate-300">
          줍스의 이름을 지어주세요
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={10}
            className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
          />
        </label>
        <button
          onClick={() => onStart(name)}
          className="mt-4 h-12 w-full rounded-xl bg-cyan-500 text-sm font-bold text-black transition-colors hover:bg-cyan-400"
        >
          👾 줍스 입양하기
        </button>
      </div>
    </div>
  );
}

function ReportModal({
  report,
  name,
  onClose,
}: {
  report: OfflineReport;
  name: string;
  onClose: () => void;
}) {
  const h = report.hours;
  const durText =
    h >= 1 ? `${Math.floor(h)}시간 ${Math.round((h % 1) * 60)}분` : `${Math.round(h * 60)}분`;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5">
        <h2 className="text-center text-base font-bold text-white">📡 부재중 보고서</h2>
        <p className="mt-1 text-center text-[11px] text-slate-500">
          자리를 비운 {durText} 동안 {name}는 궤도를 지켰어요
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-xs text-slate-300">
          <li className="flex justify-between rounded-xl bg-white/[.05] px-3 py-2.5">
            <span>🧹 청소한 쓰레기</span>
            <b className="tabular-nums">
              {report.cleaned.toLocaleString()}개 (
              {report.massKg >= 1000
                ? `${(report.massKg / 1000).toFixed(2)}t`
                : `${report.massKg.toFixed(1)}kg`}
              )
            </b>
          </li>
          <li className="flex justify-between rounded-xl bg-white/[.05] px-3 py-2.5">
            <span>✨ 경험치</span>
            <b className="tabular-nums">
              +{report.xp.toLocaleString()}
              {report.levelAfter > report.levelBefore &&
                ` (Lv.${report.levelBefore}→${report.levelAfter}!)`}
            </b>
          </li>
          {report.encounters > 0 && (
            <li className="flex justify-between rounded-xl bg-white/[.05] px-3 py-2.5">
              <span>💞 줍스 친구 조우</span>
              <b>{report.encounters}번</b>
            </li>
          )}
          {report.snacks > 0 && (
            <li className="flex justify-between rounded-xl bg-white/[.05] px-3 py-2.5">
              <span>🍬 모은 간식</span>
              <b>{report.snacks}개</b>
            </li>
          )}
          {report.hazardHits > 0 && (
            <li className="flex justify-between rounded-xl bg-rose-500/10 px-3 py-2.5 text-rose-300">
              <span>💥 위험 물체와 충돌</span>
              <b>{report.hazardHits}번</b>
            </li>
          )}
        </ul>
        {report.careNeeded && (
          <p className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2 text-center text-xs text-rose-300">
            🚑 {name}가 다쳤어요! 돌봄 탭에서 치료해주세요
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-xl bg-cyan-500 text-sm font-bold text-black transition-colors hover:bg-cyan-400"
        >
          수고했어, {name}! 💙
        </button>
      </div>
    </div>
  );
}
