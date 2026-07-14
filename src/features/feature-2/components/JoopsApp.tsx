"use client";

// 스텔라펫(STELLAPET) — 줍스 앱 루트.
// 로파이 오로라 배경 위에 글래스모피즘 크롬을 얹고,
// 탭 전환은 부드러운 페이드 인으로 처리한다.

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
import styles from "./stellar.module.css";

type Tab = "fly" | "track" | "care" | "info";

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: "fly", emoji: "🌙", label: "산책" },
  { id: "track", emoji: "🛰️", label: "관제" },
  { id: "care", emoji: "💗", label: "돌봄" },
  { id: "info", emoji: "🏛️", label: "전시관" },
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
    <div
      className={`relative flex h-dvh min-h-dvh flex-col overflow-hidden font-sans text-pink-50 ${styles.aurora}`}
    >
      <div className={styles.auroraGlow} aria-hidden />

      {/* 상단 바 — 메인 복귀 내비게이션 필수 */}
      <header className="relative flex h-14 shrink-0 items-center gap-1 border-b border-white/10 bg-white/[.06] px-2 backdrop-blur-xl">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg text-pink-100/80 transition-all duration-300 hover:bg-white/10"
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold">👾 {save?.name ?? "줍스"}</span>
            {stage && (
              <span className="hidden rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] text-pink-100/80 backdrop-blur-sm min-[380px]:inline">
                {stage.name}
              </span>
            )}
            <span className="rounded-full border border-pink-200/20 bg-pink-300/15 px-2 py-0.5 text-[10px] font-semibold text-pink-200">
              Lv.{level}
            </span>
          </div>
          <span className="text-[8px] font-medium leading-tight tracking-[0.4em] text-pink-200/50">
            STELLAPET
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
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-base transition-all duration-300 hover:bg-white/10"
        >
          {save?.muted ? "🔇" : "🔊"}
        </button>
      </header>

      {/* 본문 — 탭 전환 시 페이드 인 */}
      <main className="relative min-h-0 flex-1">
        {!ready || !save ? (
          <Splash />
        ) : (
          <div key={tab} className={`h-full ${styles.fadeIn}`}>
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
          </div>
        )}
      </main>

      {/* 하단 글래스 독 (터치 타깃 44px 이상) */}
      <nav className="relative grid shrink-0 grid-cols-4 border-t border-white/10 bg-white/[.07] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {TABS.map((t) => {
          const active = tab === t.id;
          const alert = t.id === "care" && save?.careNeeded;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] transition-all duration-300 ${
                active ? "text-pink-200" : "text-purple-200/50 hover:text-pink-100/80"
              }`}
            >
              <span
                className={`text-lg transition-transform duration-300 ${
                  active ? "-translate-y-0.5 drop-shadow-[0_0_10px_rgba(249,168,212,0.7)]" : ""
                }`}
              >
                {t.emoji}
              </span>
              {t.label}
              {alert && (
                <span className="absolute right-[calc(50%-18px)] top-2.5 h-2 w-2 animate-pulse rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
              )}
              {active && (
                <span className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-gradient-to-r from-violet-300 to-pink-300 shadow-[0_0_10px_rgba(244,114,182,0.8)]" />
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
      <span className="animate-bounce text-5xl drop-shadow-[0_0_18px_rgba(249,168,212,0.8)]">
        👾
      </span>
      <div className="flex flex-col items-center gap-1">
        <p className="text-[10px] font-medium tracking-[0.5em] text-pink-200/70">STELLAPET</p>
        <p className="animate-pulse text-sm text-pink-100/70">궤도의 줍스와 교신 중…</p>
      </div>
    </div>
  );
}

function IntroModal({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("줍스");
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#160b28]/70 p-4 backdrop-blur-sm">
      <div
        className={`flex max-h-full w-full max-w-sm flex-col overflow-y-auto rounded-3xl border border-white/20 bg-white/[.08] p-5 shadow-[0_8px_60px_rgba(120,60,160,0.45)] backdrop-blur-2xl ${styles.fadeInSlow}`}
      >
        <p className="text-center text-4xl drop-shadow-[0_0_16px_rgba(196,181,253,0.8)]">🌏💫👾</p>
        <p className="mt-3 text-center text-[9px] font-medium tracking-[0.5em] text-pink-200/60">
          STELLAPET
        </p>
        <h2 className="mt-1 text-center text-base font-bold text-pink-50">
          별빛 궤도의 작은 친구
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-pink-100/70">
          연쇄 충돌로 불어난 우주쓰레기가 궤도를 뒤덮자, 세계의 과학자들은 우주에서
          살아가는 애완 생명체 <b className="text-pink-200">줍스</b>를 만들어냈어요.
          줍스는 우주쓰레기를 먹으며 추진력과 에너지를 얻고, 성장하고, 진화해요.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-pink-100/70">
          하지만 우주는 너무 넓어서, 지구 시민 모두의 도움이 필요해요. 당신의 줍스를
          보살피고 훈련시켜 주세요. 줍스는 당신이 없는 동안에도 별빛 사이를 유영하며
          청소를 계속한답니다.
        </p>
        <label className="mt-4 text-[11px] font-semibold text-pink-100/80">
          줍스의 이름을 지어주세요
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={10}
            className="mt-1.5 h-11 w-full rounded-2xl border border-white/20 bg-white/[.07] px-3 text-sm text-pink-50 outline-none backdrop-blur-sm transition-all duration-300 focus:border-pink-300/60 focus:bg-white/[.1]"
          />
        </label>
        <button
          onClick={() => onStart(name)}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-400 to-pink-400 text-sm font-bold text-white shadow-[0_4px_24px_rgba(244,114,182,0.45)] transition-all duration-300 hover:shadow-[0_4px_32px_rgba(244,114,182,0.7)]"
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
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#160b28]/70 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-sm rounded-3xl border border-white/20 bg-white/[.08] p-5 shadow-[0_8px_60px_rgba(120,60,160,0.45)] backdrop-blur-2xl ${styles.fadeInSlow}`}
      >
        <h2 className="text-center text-base font-bold text-pink-50">🌙 별빛 근무 일지</h2>
        <p className="mt-1 text-center text-[11px] text-pink-100/60">
          자리를 비운 {durText} 동안 {name}는 궤도를 지켰어요
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-xs text-pink-100/85">
          <li className="flex justify-between rounded-2xl border border-white/10 bg-white/[.07] px-3 py-2.5 backdrop-blur-sm">
            <span>🧹 청소한 쓰레기</span>
            <b className="tabular-nums">
              {report.cleaned.toLocaleString()}개 (
              {report.massKg >= 1000
                ? `${(report.massKg / 1000).toFixed(2)}t`
                : `${report.massKg.toFixed(1)}kg`}
              )
            </b>
          </li>
          <li className="flex justify-between rounded-2xl border border-white/10 bg-white/[.07] px-3 py-2.5 backdrop-blur-sm">
            <span>✨ 경험치</span>
            <b className="tabular-nums">
              +{report.xp.toLocaleString()}
              {report.levelAfter > report.levelBefore &&
                ` (Lv.${report.levelBefore}→${report.levelAfter}!)`}
            </b>
          </li>
          {report.encounters > 0 && (
            <li className="flex justify-between rounded-2xl border border-white/10 bg-white/[.07] px-3 py-2.5 backdrop-blur-sm">
              <span>💞 줍스 친구 조우</span>
              <b>{report.encounters}번</b>
            </li>
          )}
          {report.snacks > 0 && (
            <li className="flex justify-between rounded-2xl border border-white/10 bg-white/[.07] px-3 py-2.5 backdrop-blur-sm">
              <span>🍬 모은 간식</span>
              <b>{report.snacks}개</b>
            </li>
          )}
          {report.hazardHits > 0 && (
            <li className="flex justify-between rounded-2xl border border-rose-300/20 bg-rose-400/15 px-3 py-2.5 text-rose-200 backdrop-blur-sm">
              <span>💥 위험 물체와 충돌</span>
              <b>{report.hazardHits}번</b>
            </li>
          )}
        </ul>
        {report.careNeeded && (
          <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/15 px-3 py-2 text-center text-xs text-rose-200">
            🚑 {name}가 다쳤어요! 돌봄 탭에서 치료해주세요
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-400 to-pink-400 text-sm font-bold text-white shadow-[0_4px_24px_rgba(244,114,182,0.45)] transition-all duration-300 hover:shadow-[0_4px_32px_rgba(244,114,182,0.7)]"
        >
          수고했어, {name}! 💜
        </button>
      </div>
    </div>
  );
}
