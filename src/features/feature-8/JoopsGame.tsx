"use client";

import Link from "next/link";
import ActionGame from "./components/ActionGame";
import HealOverlay from "./components/HealOverlay";
import OrbitView from "./components/OrbitView";
import { useJoopsGame } from "./hooks/useJoopsGame";
import {
  MAX_HP,
  expForLevel,
  formatAway,
  formatDuration,
  type OfflineReport,
} from "./lib/game";
import styles from "./styles.module.css";

function Bar({
  label,
  value,
  max,
  barClass,
}: {
  label: string;
  value: number;
  max: number;
  barClass: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-[11px] text-black/50 dark:text-white/50">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.floor(value)}/{max}
        </span>
      </div>
      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReportModal({
  report,
  onClose,
}: {
  report: OfflineReport;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-black dark:bg-[#111] dark:text-white">
        <h2 className="text-lg font-bold">📡 부재중 관제 보고</h2>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          {formatAway(report.awayMs)} 동안 줍스는…
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          <li>🛰️ 궤도 {report.orbitsCompleted}바퀴 비행</li>
          <li>
            ✨ EXP +{report.expGained}
            {report.levelUps > 0 ? ` (레벨 ${report.levelUps} 상승!)` : ""}
          </li>
          {report.collided ? (
            <li className="font-semibold text-red-500">
              💥 인공위성 잔해와 충돌해 멈춰 있어요! 치료가 필요해요.
            </li>
          ) : (
            <li>💚 무사히 비행 중이에요.</li>
          )}
        </ul>
        <button
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-full bg-black text-sm font-bold text-white dark:bg-white dark:text-black"
        >
          확인
        </button>
      </div>
    </div>
  );
}

export default function JoopsGame() {
  const g = useJoopsGame();
  const { save, phase } = g;

  return (
    <div className="flex min-h-dvh flex-col bg-white font-sans text-black dark:bg-black dark:text-white">
      <header className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pb-2 pt-4">
        <Link
          href="/"
          aria-label="메인으로 돌아가기"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-black/[.08] text-lg transition-colors hover:bg-[#f2f2f2] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          ←
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">줍스 관제 센터</h1>
          <p className="text-[11px] uppercase tracking-wider text-black/50 dark:text-white/50">
            Joops Orbital Control
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-black/[.08] px-3 py-1 text-sm font-bold tabular-nums dark:border-white/[.145]">
          Lv.{save.level}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        {phase === "loading" ? (
          <div className="flex flex-1 items-center justify-center text-sm text-black/50 dark:text-white/50">
            궤도 데이터 불러오는 중…
          </div>
        ) : (
          <>
            {/* 상태 카드 */}
            <section className="rounded-2xl border border-black/[.08] p-3 dark:border-white/[.145]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {phase === "setup"
                    ? "🛠️ 내 상공 지정 대기"
                    : save.stopped
                      ? "🚨 잔해 충돌 — 신호 두절"
                      : g.inWindow
                        ? "🟢 내 상공 통과 중"
                        : "🛰️ 궤도 비행 중"}
                </span>
                <span className="tabular-nums text-black/50 dark:text-white/50">
                  누적 {save.orbits}바퀴
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <Bar
                  label={`EXP (Lv.${save.level})`}
                  value={save.exp}
                  max={expForLevel(save.level)}
                  barClass="bg-emerald-400"
                />
                <Bar label="HP" value={save.hp} max={MAX_HP} barClass="bg-red-400" />
              </div>
            </section>

            {/* 관제 화면 (NASA 모드) — 충돌 순간 흔들림 연출 */}
            <div
              key={g.collideFlash}
              className={g.collideFlash > 0 ? styles.shake : undefined}
            >
              <OrbitView
                angle={save.angle}
                homeAngle={save.homeAngle}
                level={save.level}
                stopped={save.stopped}
                setupMode={phase === "setup"}
                inWindow={g.inWindow}
                levelFlash={g.levelFlash}
                gains={g.gains}
                onPickHome={g.pickHome}
                onJoopsClick={g.openHeal}
              />
            </div>

            {/* 하단 조작부 */}
            {phase === "setup" ? (
              <p className="rounded-2xl border border-dashed border-black/[.15] p-3 text-center text-sm text-black/60 dark:border-white/[.25] dark:text-white/60">
                위 궤도에서 원하는 지점을 탭해 <b>내 상공</b>을 지정하세요.
                <br />
                줍스가 그 상공을 지날 때 쓰레기 줍기 액션을 할 수 있어요.
              </p>
            ) : save.stopped ? (
              <button
                onClick={g.openHeal}
                className="h-14 w-full rounded-2xl bg-red-500 text-base font-bold text-white transition-transform active:scale-[0.98]"
              >
                🚨 줍스 응급 치료하기
              </button>
            ) : g.canStartAction ? (
              <button
                onClick={g.startAction}
                className="h-14 w-full animate-pulse rounded-2xl bg-emerald-400 text-base font-bold text-black transition-transform active:scale-[0.98]"
              >
                🛰️ 내 상공 통과 중! 쓰레기 줍기 시작
              </button>
            ) : (
              <div className="flex h-14 w-full items-center justify-between rounded-2xl border border-black/[.08] px-4 dark:border-white/[.145]">
                <span className="text-sm text-black/60 dark:text-white/60">
                  내 상공 도착까지
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {g.etaMs === null ? "—" : formatDuration(g.etaMs)}
                </span>
              </div>
            )}

            {phase !== "setup" && (
              <div className="flex justify-center gap-4 text-xs text-black/45 dark:text-white/45">
                <button
                  onClick={g.startRelocate}
                  className="min-h-11 px-2 underline underline-offset-4"
                >
                  상공 재지정
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("저장 데이터를 초기화하고 처음부터 시작할까요?")) {
                      g.resetAll();
                    }
                  }}
                  className="min-h-11 px-2 underline underline-offset-4"
                >
                  처음부터
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 오버레이 */}
      {phase === "action" && <ActionGame onFinish={g.finishAction} />}
      {phase === "heal" && (
        <HealOverlay
          hp={save.hp}
          stopped={save.stopped}
          onTap={g.healTap}
          onClose={g.closeHeal}
        />
      )}
      {g.report && phase === "orbit" && (
        <ReportModal report={g.report} onClose={g.dismissReport} />
      )}
    </div>
  );
}
