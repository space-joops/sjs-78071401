"use client";
// 허브 — 줍스 돌봄(다마고치), 교신 상태, 메뉴, 성장 로드맵
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import {
  CITIES,
  EXHAUSTED_HP,
  STAGES,
  WORLDS,
  stageForLevel,
  xpNeeded,
} from "../lib/constants";
import { loadWorld, placeLabel, type WorldData } from "../lib/geo";
import { joopsDataUrl } from "../lib/joopsArt";
import { groundPoint, isInContact, nextContact } from "../lib/orbit";
import {
  LOG_TIME_FMT,
  SAVE_KEY,
  boosterActive,
  careFeed,
  careHeal,
  carePet,
  coverageKmOf,
  isExhausted,
  renameJoops,
  setOwnerCity,
  shareText,
  toggleRest,
  useBooster,
} from "../lib/state";
import type { Mood } from "../lib/types";
import Onboarding from "./Onboarding";
import SpaceBackdrop from "./SpaceBackdrop";
import StatBar from "./StatBar";

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function HubScreen() {
  const { save, ready, report, dismissReport, mutate, create } = useGameState();
  const [now, setNow] = useState(() => Date.now());
  const [world, setWorld] = useState<WorldData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    loadWorld().then(setWorld);
  }, []);

  const contactInfo = useMemo(() => {
    if (!save?.onboarded) return null;
    const coverage = coverageKmOf(save, now);
    const inContact = isInContact(save.orbit, save.owner, coverage, now);
    const win = nextContact(save.orbit, save.owner, coverage, now);
    return { coverage, inContact, win };
    // now는 1초 단위로 변한다
  }, [save, now]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-white/60">
        <SpaceBackdrop />
        <span className="animate-pulse">궤도 신호 수신 중…</span>
      </div>
    );
  }
  if (!save || !save.onboarded) {
    return (
      <>
        <SpaceBackdrop />
        <Onboarding onCreate={create} />
      </>
    );
  }

  const j = save.joops;
  const stage = stageForLevel(j.level);
  const nextStage = STAGES.find((s) => s.idx === stage.idx + 1) ?? null;
  const exhausted = isExhausted(save);
  const booster = boosterActive(save, now);
  const mood: Mood = j.resting
    ? "sleeping"
    : exhausted
      ? "tired"
      : j.mood >= 55
        ? "happy"
        : "neutral";
  const gp = groundPoint(save.orbit, now);
  const place = placeLabel(world, gp.lon, gp.lat);
  const inContact = contactInfo?.inContact ?? false;
  const win = contactInfo?.win ?? null;

  const statusChip = j.resting
    ? { icon: "😴", text: "궤도 요람에서 휴식 중" }
    : exhausted
      ? { icon: "😵", text: "지쳐서 표류 중 — 보살핌이 필요해요!" }
      : j.satiety <= 0
        ? { icon: "🥺", text: "배가 고파 추진력이 없어요" }
        : { icon: "🧹", text: `${place}에서 청소 중` };

  const share = async () => {
    const text = shareText(save);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      throw new Error("no share");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // 클립보드도 막힌 환경이면 조용히 무시
      }
    }
  };

  const resetSave = () => {
    if (window.confirm("정말 처음부터 새 줍스를 입양할까요? 지금 줍스와의 기록이 모두 사라져요.")) {
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    }
  };

  const careBtn =
    "flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium transition active:scale-95 disabled:opacity-35 disabled:active:scale-100";

  return (
    <div className="flex min-h-dvh flex-col text-white">
      <SpaceBackdrop />

      {/* 헤더 */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-[#060515]/80 px-3 py-2.5 backdrop-blur">
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg transition hover:bg-white/10"
          aria-label="메인으로 돌아가기"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">줍스 오비트</h1>
          <p className="truncate text-[11px] text-white/50">
            케슬러 신드롬에 맞서는 궤도 대청소
          </p>
        </div>
        <span className="rounded-full border border-teal-300/40 bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-200">
          LV.{j.level}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 pb-10">
        {/* 부재중 보고 모달 */}
        {report && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b22] p-6 text-center">
              <div className="text-4xl">📮</div>
              <h2 className="mt-2 text-lg font-bold">부재중 활동 보고</h2>
              <p className="mt-1 text-xs text-white/50">
                당신이 없는 동안에도 {j.name}는 궤도를 돌았어요
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-lg font-bold text-teal-300">
                    {report.cleaned.toLocaleString()}개
                  </div>
                  <div className="text-[11px] text-white/50">청소한 쓰레기</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-lg font-bold text-amber-300">
                    +{report.xpGained.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-white/50">획득 XP</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-lg font-bold text-pink-300">
                    {report.friendsMet}번
                  </div>
                  <div className="text-[11px] text-white/50">친구 조우</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-lg font-bold text-red-300">
                    {report.collisions}번
                  </div>
                  <div className="text-[11px] text-white/50">충돌 사고</div>
                </div>
              </div>
              {report.leveledTo && (
                <p className="mt-3 text-sm text-amber-200">
                  🎉 부재중에 LV.{report.leveledTo}에 도달했어요!
                </p>
              )}
              <button
                onClick={dismissReport}
                className="mt-5 min-h-11 w-full rounded-full bg-teal-300 font-semibold text-[#062a24] active:scale-95"
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* 줍스 카드 */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={joopsDataUrl({ stage: stage.idx, mood })}
                alt={j.name}
                className="w-24 animate-[float4_3.2s_ease-in-out_infinite]"
              />
              <style>{`@keyframes float4{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}`}</style>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h2 className="truncate text-lg font-bold">{j.name}</h2>
                <span className="shrink-0 text-xs text-white/50">{stage.name}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">
                {stage.desc}
              </p>
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[11px] text-white/60">
                  <span>XP</span>
                  <span className="tabular-nums">
                    {j.xp}/{xpNeeded(j.level)}
                    {nextStage && ` · LV.${nextStage.minLevel} 진화`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-400 transition-[width] duration-500"
                    style={{ width: `${(j.xp / xpNeeded(j.level)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-xs">
            {statusChip.icon} {statusChip.text}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatBar icon="❤️" label="체력" value={j.hp} color="#fb7185" />
            <StatBar icon="🍙" label="포만감" value={j.satiety} color="#fbbf24" />
            <StatBar icon="🌈" label="기분" value={j.mood} color="#7ef2d8" />
          </div>
          {exhausted && (
            <p className="mt-2 text-[11px] text-red-300">
              ⚠️ 체력이 {EXHAUSTED_HP} 이하예요. 회복 캡슐을 주거나 휴식시키기 전까지
              청소와 비행을 할 수 없어요.
            </p>
          )}
        </section>

        {/* 교신 상태 */}
        <section
          className={`rounded-2xl border p-4 ${
            inContact
              ? "border-teal-300/40 bg-teal-300/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold">
                {booster
                  ? "🌐 전지구 교신 모드"
                  : inContact
                    ? `📡 ${save.owner.city} 상공 — 교신 중`
                    : "🛰️ 교신 범위 밖"}
              </h3>
              <p className="mt-1 text-[11px] text-white/60">
                {booster ? (
                  <>부스터 종료까지 {fmtCountdown(save.boosterUntil - now)}</>
                ) : inContact && win ? (
                  <>교신 종료까지 {fmtCountdown(win.end - now)} · 지금 돌봐주세요!</>
                ) : win ? (
                  <>
                    다음 교신까지 {fmtCountdown(win.start - now)} · 반경{" "}
                    {Math.round(contactInfo!.coverage).toLocaleString()}km
                  </>
                ) : (
                  <>다음 교신 계산 중…</>
                )}
              </p>
            </div>
            {!inContact && save.items.booster > 0 && (
              <button
                onClick={() => mutate(useBooster)}
                className="min-h-11 shrink-0 rounded-full border border-amber-300/50 bg-amber-300/15 px-4 text-xs font-semibold text-amber-200 active:scale-95"
              >
                🌐 부스터 ×{save.items.booster}
              </button>
            )}
          </div>

          {/* 돌봄 액션 — 교신 중에만 명령 전송 가능(요구 10) */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className={careBtn}
              disabled={!inContact}
              onClick={() => mutate(careFeed)}
            >
              🍬 간식 주기
            </button>
            <button
              className={careBtn}
              disabled={!inContact}
              onClick={() => mutate(carePet)}
            >
              💗 쓰다듬기
            </button>
            <button
              className={careBtn}
              disabled={!inContact || save.items.medkit <= 0}
              onClick={() => mutate(careHeal)}
            >
              💊 회복 캡슐 ×{save.items.medkit}
            </button>
            <button
              className={careBtn}
              disabled={!inContact}
              onClick={() => mutate(toggleRest)}
            >
              {j.resting ? "🔔 깨우기" : "😴 휴식시키기"}
            </button>
          </div>
          {!inContact && (
            <p className="mt-2 text-[11px] text-white/45">
              줍스가 내 상공을 지날 때만 명령을 보낼 수 있어요. 진화하면 교신 반경이
              넓어지고, 부스터를 쓰면 전 지구에서 교신할 수 있어요.
            </p>
          )}
        </section>

        {/* 메뉴 */}
        <section className="grid grid-cols-2 gap-3">
          {exhausted ? (
            <div className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 opacity-50">
              <span className="text-2xl">🎮</span>
              <span className="mt-1 text-sm font-bold">궤도 비행</span>
              <span className="text-[10px] text-red-300">지쳐서 비행 불가</span>
            </div>
          ) : (
            <Link
              href="/features/4/play"
              className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 active:scale-95"
            >
              <span className="text-2xl">🎮</span>
              <span className="mt-1 text-sm font-bold">궤도 비행</span>
              <span className="text-[10px] text-white/50">
                {inContact ? "📡 교신 중 — 보상 2배!" : "직접 조종해 청소하기"}
              </span>
            </Link>
          )}
          <Link
            href="/features/4/tracking"
            className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 active:scale-95"
          >
            <span className="text-2xl">🗺️</span>
            <span className="mt-1 text-sm font-bold">관제 센터</span>
            <span className="text-[10px] text-white/50">지금 어디를 날고 있을까?</span>
          </Link>
        </section>

        {/* 통계 */}
        <section className="grid grid-cols-3 gap-3 text-center">
          {[
            { v: save.stats.cleaned.toLocaleString(), l: "청소한 쓰레기" },
            { v: String(save.stats.friendsMet), l: "만난 친구" },
            {
              v: `${Math.max(1, Math.ceil((now - save.createdAt) / 86400000))}일`,
              l: "함께한 시간",
            },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-base font-bold text-teal-200">{s.v}</div>
              <div className="mt-0.5 text-[10px] text-white/50">{s.l}</div>
            </div>
          ))}
        </section>

        {/* 세계관 로드맵 + 랭킹 티저 */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-bold">🪐 청소 구역 로드맵</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {WORLDS.map((w) => (
              <div
                key={w.id}
                className={`rounded-xl border p-3 text-center ${
                  w.live
                    ? "border-teal-300/40 bg-teal-300/10"
                    : "border-white/10 bg-black/20 opacity-60"
                }`}
              >
                <div className="text-2xl">{w.icon}</div>
                <div className="mt-1 text-xs font-semibold">{w.name}</div>
                <div className="text-[10px] text-white/50">
                  {w.live ? "청소 중" : `LV.${w.unlockLevel} 예정`}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div>
              <div className="text-xs font-semibold">🏆 글로벌 청소 랭킹</div>
              <div className="text-[10px] text-white/45">
                시즌 0 준비 중 — 전 세계 줍스들과 성과를 겨루게 될 거예요
              </div>
            </div>
            <button
              onClick={share}
              className="min-h-11 shrink-0 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-semibold active:scale-95"
            >
              {copied ? "복사됨! ✓" : "자랑하기"}
            </button>
          </div>
        </section>

        {/* 관제 일지 */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-bold">📋 관제 일지</h3>
          <ul className="mt-2 space-y-1.5">
            {save.log.slice(0, 8).map((e, i) => (
              <li key={`${e.t}-${i}`} className="flex gap-2 text-xs">
                <span className="shrink-0">{e.icon}</span>
                <span className="min-w-0 flex-1 text-white/70">{e.msg}</span>
                <span className="shrink-0 text-[10px] text-white/35 tabular-nums">
                  {LOG_TIME_FMT(e.t)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 설정 */}
        <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-bold text-white/70">
            ⚙️ 관제소 설정
          </summary>
          <div className="mt-3 space-y-3">
            <RenameForm
              current={j.name}
              onRename={(name) => mutate((s, t) => renameJoops(s, t, name))}
            />
            <div>
              <label className="text-[11px] text-white/50">관제소 위치</label>
              <select
                value={save.owner.city}
                onChange={(e) => {
                  const c = CITIES.find((x) => x.city === e.target.value);
                  if (c) mutate((s, t) => setOwnerCity(s, t, c));
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm outline-none"
              >
                {CITIES.map((c) => (
                  <option key={c.city} value={c.city} className="bg-[#0a0a1a]">
                    {c.city}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={resetSave}
              className="min-h-11 w-full rounded-xl border border-red-400/30 bg-red-400/10 text-xs font-semibold text-red-300 active:scale-95"
            >
              새 줍스 입양하기 (기록 초기화)
            </button>
          </div>
        </details>
      </main>
    </div>
  );
}

function RenameForm({
  current,
  onRename,
}: {
  current: string;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(current);
  return (
    <div>
      <label className="text-[11px] text-white/50">줍스 이름</label>
      <div className="mt-1 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={10}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-teal-300"
        />
        <button
          disabled={!name.trim() || name.trim() === current}
          onClick={() => onRename(name)}
          className="min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-semibold active:scale-95 disabled:opacity-40"
        >
          변경
        </button>
      </div>
    </div>
  );
}
