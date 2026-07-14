"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CARE_CORE_TAPS,
  CARE_DEBRIS_COUNT,
  CARE_ENERGY_HOLD_MS,
  CARE_RECOVER_HP_RATIO,
  CARE_RUB_DISTANCE_PX,
} from "../constants";
import { expProgress, maxHpForLevel, stageForLevel } from "../lib/level";
import type { SaveData } from "../types";
import styles from "./care.module.css";

type Props = {
  save: SaveData;
  updateSave: (fn: (s: SaveData) => SaveData) => void;
};

type Expression = "happy" | "sad" | "dizzy";

function JoopsFace({
  color,
  expression,
  size = 160,
}: {
  color: string;
  expression: Expression;
  size?: number;
}) {
  return (
    <div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${color} 65%)`,
        boxShadow: `0 0 60px 8px ${color}55`,
      }}
    >
      {/* 안테나 */}
      <div
        className="absolute left-1/2 top-0 h-6 w-1 -translate-x-1/2 -translate-y-full rounded-full"
        style={{ background: color }}
      />
      <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-[34px] rounded-full bg-yellow-200" />
      {/* 눈 */}
      {expression === "dizzy" ? (
        <>
          <span className="absolute left-[26%] top-[36%] text-lg font-bold text-slate-900">
            ✕
          </span>
          <span className="absolute right-[26%] top-[36%] text-lg font-bold text-slate-900">
            ✕
          </span>
        </>
      ) : expression === "happy" ? (
        <>
          <span className="absolute left-[24%] top-[34%] text-lg font-bold text-slate-900">
            ˆ
          </span>
          <span className="absolute right-[24%] top-[34%] text-lg font-bold text-slate-900">
            ˆ
          </span>
        </>
      ) : (
        <>
          <div className="absolute left-[28%] top-[38%] h-3.5 w-3.5 rounded-full bg-slate-900" />
          <div className="absolute right-[28%] top-[38%] h-3.5 w-3.5 rounded-full bg-slate-900" />
        </>
      )}
      {/* 입 */}
      <div
        className={`absolute left-1/2 top-[58%] h-3 w-6 -translate-x-1/2 border-2 border-slate-900 ${
          expression === "sad" || expression === "dizzy"
            ? "rounded-t-full border-b-0"
            : "rounded-b-full border-t-0"
        }`}
      />
      {/* 볼터치 */}
      <div className="absolute left-[12%] top-[52%] h-3 w-4 rounded-full bg-rose-300/60" />
      <div className="absolute right-[12%] top-[52%] h-3 w-4 rounded-full bg-rose-300/60" />
    </div>
  );
}

const DEBRIS_EMOJIS = ["🔩", "🪛", "🧷", "📎", "🪫", "🧲"];

type Piece = { id: number; emoji: string; xPct: number; yPct: number };

function makePieces(): Piece[] {
  return Array.from({ length: CARE_DEBRIS_COUNT }, (_, i) => {
    const angle = (i / CARE_DEBRIS_COUNT) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 30 + Math.random() * 14;
    return {
      id: i,
      emoji: DEBRIS_EMOJIS[i % DEBRIS_EMOJIS.length],
      xPct: 50 + Math.cos(angle) * dist,
      yPct: 50 + Math.sin(angle) * dist,
    };
  });
}

/** 1단계: 잔해 제거 — 파편을 드래그해서 털어내기 */
function DebrisPhase({ color, onDone }: { color: string; onDone: () => void }) {
  const [pieces, setPieces] = useState<Piece[]>(makePieces);
  const [popping, setPopping] = useState<Piece[]>([]);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{
    id: number;
    dx: number;
    dy: number;
  } | null>(null);

  const handleDown = (e: React.PointerEvent, id: number) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY };
    setDragOffset({ id, dx: 0, dy: 0 });
  };
  const handleMove = (e: React.PointerEvent, id: number) => {
    const d = dragRef.current;
    if (!d || d.id !== id) return;
    setDragOffset({ id, dx: e.clientX - d.startX, dy: e.clientY - d.startY });
  };
  const handleUp = (e: React.PointerEvent, id: number) => {
    const d = dragRef.current;
    if (!d || d.id !== id) return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    dragRef.current = null;
    setDragOffset(null);
    if (dist > 70) {
      setPieces((ps) => {
        const removed = ps.find((p) => p.id === id);
        if (removed) setPopping((pp) => [...pp, removed]);
        const next = ps.filter((p) => p.id !== id);
        if (next.length === 0) setTimeout(onDone, 350);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-white/70">
        몸에 붙은 잔해를 <b className="text-white">드래그해서 털어내</b> 주세요 (
        {pieces.length}개 남음)
      </p>
      <div className="relative h-64 w-64">
        <div className="absolute inset-0 flex items-center justify-center">
          <JoopsFace color={color} expression="dizzy" />
        </div>
        {pieces.map((p) => {
          const off = dragOffset?.id === p.id ? dragOffset : null;
          return (
            <button
              key={p.id}
              onPointerDown={(e) => handleDown(e, p.id)}
              onPointerMove={(e) => handleMove(e, p.id)}
              onPointerUp={(e) => handleUp(e, p.id)}
              className="absolute flex h-11 w-11 touch-none items-center justify-center text-2xl drop-shadow-lg"
              style={{
                left: `${p.xPct}%`,
                top: `${p.yPct}%`,
                transform: `translate(-50%, -50%) translate(${off?.dx ?? 0}px, ${
                  off?.dy ?? 0
                }px) ${off ? "scale(1.25)" : ""}`,
                transition: off ? "none" : "transform 0.2s",
              }}
              aria-label="잔해 제거"
            >
              {p.emoji}
            </button>
          );
        })}
        {popping.map((p) => (
          <span
            key={`pop-${p.id}`}
            className={`absolute text-2xl ${styles.popOut}`}
            style={{
              left: `${p.xPct}%`,
              top: `${p.yPct}%`,
              translate: "-50% -50%",
            }}
            onAnimationEnd={() =>
              setPopping((pp) => pp.filter((x) => x.id !== p.id))
            }
          >
            💨
          </span>
        ))}
      </div>
    </div>
  );
}

/** 2단계: 에너지 주입 — 길게 눌러 캡슐 주입 (캡슐이 없으면 코어 재부팅 미니게임) */
function EnergyPhase({
  color,
  capsules,
  onDone,
}: {
  color: string;
  capsules: number;
  onDone: (usedCapsule: boolean) => void;
}) {
  const [holdMs, setHoldMs] = useState(0);
  const [taps, setTaps] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const useCapsule = capsules > 0;

  const stopHold = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!doneRef.current) setHoldMs(0);
  }, []);

  const startHold = useCallback(() => {
    if (timerRef.current || doneRef.current) return;
    timerRef.current = setInterval(() => {
      setHoldMs((m) => m + 40);
    }, 40);
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  useEffect(() => {
    if (doneRef.current) return;
    if (useCapsule && holdMs >= CARE_ENERGY_HOLD_MS) {
      doneRef.current = true;
      stopHold();
      onDone(true);
    } else if (!useCapsule && taps >= CARE_CORE_TAPS) {
      doneRef.current = true;
      onDone(false);
    }
  }, [holdMs, taps, useCapsule, onDone, stopHold]);

  const progress = useCapsule
    ? Math.min(1, holdMs / CARE_ENERGY_HOLD_MS)
    : Math.min(1, taps / CARE_CORE_TAPS);
  const ringC = 2 * Math.PI * 54;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-white/70">
        {useCapsule ? (
          <>
            버튼을 <b className="text-white">길게 눌러</b> 응급 에너지 캡슐을
            주입하세요 (보유 {capsules}개)
          </>
        ) : (
          <>
            캡슐이 없어요! 코어를 <b className="text-white">연타해서 재부팅</b>
            하세요 ({taps}/{CARE_CORE_TAPS})
          </>
        )}
      </p>
      <JoopsFace color={color} expression="sad" size={120} />
      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={ringC}
            strokeDashoffset={ringC * (1 - progress)}
          />
        </svg>
        {useCapsule ? (
          <button
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            className={`h-24 w-24 touch-none select-none rounded-full bg-sky-500 text-3xl transition-transform active:scale-95 ${styles.corePulse}`}
            aria-label="에너지 주입 (길게 누르기)"
          >
            💊
          </button>
        ) : (
          <button
            onClick={() => setTaps((n) => n + 1)}
            className={`h-24 w-24 select-none rounded-full bg-sky-500 text-3xl transition-transform active:scale-90 ${styles.corePulse}`}
            aria-label="코어 재부팅 (연타)"
          >
            ⚡
          </button>
        )}
      </div>
    </div>
  );
}

/** 3단계(및 평상시 교감): 쓰다듬어 스트레스 낮추기 */
function RubArea({
  color,
  expression,
  targetPx,
  onProgress,
  onDone,
  label,
}: {
  color: string;
  expression: Expression;
  targetPx: number;
  onProgress?: (deltaPx: number) => void;
  onDone?: () => void;
  label: string;
}) {
  const [rubbed, setRubbed] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const heartAccRef = useRef(0);
  const heartIdRef = useRef(0);
  const doneRef = useRef(false);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const handleMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) {
      lastRef.current = null;
      return;
    }
    const last = lastRef.current;
    lastRef.current = { x: e.clientX, y: e.clientY };
    if (!last) return;
    const d = Math.min(40, Math.hypot(e.clientX - last.x, e.clientY - last.y));
    if (d < 1) return;
    onProgress?.(d);
    heartAccRef.current += d;
    if (heartAccRef.current > 110) {
      heartAccRef.current = 0;
      const rect = areaRef.current?.getBoundingClientRect();
      if (rect) {
        const id = heartIdRef.current++;
        setHearts((hs) => [
          ...hs.slice(-8),
          { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
        ]);
      }
    }
    setRubbed((r) => {
      const next = r + d;
      if (targetPx > 0 && next >= targetPx && !doneRef.current) {
        doneRef.current = true;
        setTimeout(() => onDone?.(), 250);
      }
      return next;
    });
  };

  const progress = targetPx > 0 ? Math.min(1, rubbed / targetPx) : 0;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-sm text-white/70">{label}</p>
      <div
        ref={areaRef}
        onPointerMove={handleMove}
        onPointerDown={(e) => {
          lastRef.current = { x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerUp={() => (lastRef.current = null)}
        className={`relative flex h-56 w-56 touch-none items-center justify-center rounded-full ${styles.wobble}`}
      >
        <JoopsFace color={color} expression={expression} />
        {hearts.map((h) => (
          <span
            key={h.id}
            className={`pointer-events-none absolute text-xl ${styles.floatUp}`}
            style={{ left: h.x, top: h.y }}
            onAnimationEnd={() =>
              setHearts((hs) => hs.filter((x) => x.id !== h.id))
            }
          >
            💖
          </span>
        ))}
      </div>
      {targetPx > 0 && (
        <div className="h-2 w-48 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-rose-400 transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function CareMode({ save, updateSave }: Props) {
  const [recovered, setRecovered] = useState(false);
  const { level } = expProgress(save.joops.exp);
  const stage = stageForLevel(level);
  const maxHp = maxHpForLevel(level);
  const phase = save.care;

  const finishDebris = useCallback(
    () => updateSave((s) => ({ ...s, care: "energy" })),
    [updateSave]
  );

  const finishEnergy = useCallback(
    (usedCapsule: boolean) =>
      updateSave((s) => {
        const lv = expProgress(s.joops.exp).level;
        return {
          ...s,
          care: "soothe",
          joops: {
            ...s.joops,
            hp: Math.round(maxHpForLevel(lv) * CARE_RECOVER_HP_RATIO),
          },
          items: usedCapsule
            ? { ...s.items, capsules: Math.max(0, s.items.capsules - 1) }
            : s.items,
        };
      }),
    [updateSave]
  );

  const finishSoothe = useCallback(() => {
    setRecovered(true);
    updateSave((s) => ({
      ...s,
      care: null,
      joops: { ...s.joops, stress: 5 },
    }));
  }, [updateSave]);

  const rubHealthy = useCallback(
    (d: number) => {
      updateSave((s) =>
        s.joops.stress > 0
          ? {
              ...s,
              joops: {
                ...s.joops,
                stress: Math.max(0, s.joops.stress - d / 60),
              },
            }
          : s
      );
    },
    [updateSave]
  );

  const stepLabel =
    phase === "debris" ? "1 / 3 · 잔해 제거" : phase === "energy" ? "2 / 3 · 에너지 주입" : phase === "soothe" ? "3 / 3 · 교감" : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-4 sm:p-6">
        {phase !== null ? (
          <>
            <div className="w-full rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-center">
              <p className="text-sm font-bold text-rose-300">
                🆘 줍스 기능 정지 — 보살핌이 필요해요
              </p>
              <p className="mt-1 text-xs text-white/60">{stepLabel}</p>
            </div>
            {phase === "debris" && (
              <DebrisPhase color={stage.bodyColor} onDone={finishDebris} />
            )}
            {phase === "energy" && (
              <EnergyPhase
                color={stage.bodyColor}
                capsules={save.items.capsules}
                onDone={finishEnergy}
              />
            )}
            {phase === "soothe" && (
              <RubArea
                color={stage.bodyColor}
                expression="sad"
                targetPx={CARE_RUB_DISTANCE_PX}
                onDone={finishSoothe}
                label="줍스를 문질러 쓰다듬어 주세요 — 스트레스를 낮춰야 비행할 수 있어요"
              />
            )}
          </>
        ) : (
          <>
            {recovered && (
              <div className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
                <p className="text-sm font-bold text-emerald-300">
                  🚀 정상 궤도 복귀! 줍스가 다시 비행할 수 있어요
                </p>
              </div>
            )}
            <RubArea
              color={stage.bodyColor}
              expression="happy"
              targetPx={0}
              onProgress={rubHealthy}
              label={`${save.joops.name}를 쓰다듬어 주세요 — 스트레스가 낮아져요`}
            />
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-white/50">스트레스</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      save.joops.stress >= 70 ? "bg-red-400" : "bg-violet-400"
                    }`}
                    style={{ width: `${save.joops.stress}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-white/50">
                  {Math.round(save.joops.stress)}/100
                  {save.joops.stress >= 70 && " · EXP 획득 절반!"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-white/50">체력</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${(save.joops.hp / maxHp) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-white/50">
                  {save.joops.hp}/{maxHp}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-white/50">보유 아이템</p>
                <p className="mt-1 text-sm font-bold">
                  💊 캡슐 {save.items.capsules} · 🌐 부스트{" "}
                  {save.items.globalBoost}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-white/50">진화 단계</p>
                <p className="mt-1 text-sm font-bold">
                  {stage.emoji} {stage.name}
                </p>
                <p className="mt-1 text-[10px] text-white/50">
                  누적 청소 {save.joops.debrisCleaned.toLocaleString()}개
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
