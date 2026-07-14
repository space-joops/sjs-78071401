"use client";

// 돌봄 모드 — 다마고치처럼 줍스를 보살핀다.
// 주인 상공 교신 중이거나 퀀텀 링크가 켜져 있을 때만 가능 (요구사항 5, 10).

import { useEffect, useRef, useState } from "react";
import {
  coverageRadiusKm,
  levelFromXp,
  QUANTUM_LINK_MINUTES,
  stageForLevel,
  xpForLevel,
  xpToNext,
} from "../lib/gameConfig";
import { formatCountdown, isInRange, nextPassMs } from "../lib/orbit";
import { drawHeart, drawJoops, type Mood } from "../lib/draw";
import { sfx } from "../lib/sound";
import { isQuantumActive, mutate, persist, useSave } from "../lib/store";

type Heart = { x: number; y: number; vy: number; life: number; size: number };

export default function CareView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heartsRef = useRef<Heart[]>([]);
  const eatUntilRef = useRef(0);
  const save = useSave();
  const [now, setNow] = useState(() => Date.now());
  const [healTaps, setHealTaps] = useState(0);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 큰 줍스 캔버스
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      ph: Math.random() * Math.PI * 2,
    }));
    let last = performance.now();

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = ts / 1000;

      // 진한 보라 → 분홍 오로라 무대 조명
      const bg = ctx.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, "#1c0f38");
      bg.addColorStop(0.6, "#33195c");
      bg.addColorStop(1, "#5d2c72");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);
      const halo = ctx.createRadialGradient(
        cssW / 2,
        cssH * 0.55,
        10,
        cssW / 2,
        cssH * 0.55,
        cssW * 0.55
      );
      halo.addColorStop(0, "rgba(249,168,212,0.22)");
      halo.addColorStop(0.6, "rgba(196,181,253,0.1)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, cssW, cssH);
      for (const st of stars) {
        ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t + st.ph));
        ctx.fillStyle = "#fdf2f8";
        ctx.beginPath();
        ctx.arc(st.x * cssW, st.y * cssH, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const s = save;
      if (s) {
        let mood: Mood = "happy";
        if (s.careNeeded) mood = "hurt";
        else if (Date.now() < eatUntilRef.current) mood = "eat";
        else if (s.energy <= 20) mood = "tired";
        drawJoops(ctx, {
          x: cssW / 2,
          y: cssH * 0.52,
          r: Math.min(60, cssW * 0.16),
          stage: stageForLevel(levelFromXp(s.xp)).stage,
          t,
          mood,
        });
      }

      const hearts = heartsRef.current;
      for (let i = hearts.length - 1; i >= 0; i--) {
        const hp = hearts[i];
        hp.y += hp.vy * dt;
        hp.life -= dt;
        if (hp.life <= 0) {
          hearts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, hp.life));
        ctx.fillStyle = "#fb7185";
        drawHeart(ctx, hp.x * cssW, hp.y * cssH, hp.size);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [save]);

  if (!save) return null;

  const level = levelFromXp(save.xp);
  const stage = stageForLevel(level);
  const quantum = isQuantumActive(save, now);
  const radius = coverageRadiusKm(level);
  const inRange = isInRange(now, save.epochMs, save.owner, radius);
  const canCare = quantum || inRange;
  const eta = canCare ? null : nextPassMs(now, save.epochMs, save.owner, radius);
  const petReady = now >= save.petCooldownUntil;
  const xpCur = save.xp - xpForLevel(level);
  const xpNeed = xpToNext(level);

  const spawnHearts = (count: number) => {
    for (let i = 0; i < count; i++) {
      heartsRef.current.push({
        x: 0.5 + (Math.random() - 0.5) * 0.4,
        y: 0.45 + (Math.random() - 0.5) * 0.25,
        vy: -0.12 - Math.random() * 0.1,
        life: 1 + Math.random() * 0.6,
        size: 6 + Math.random() * 7,
      });
    }
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };

  const feed = () => {
    if (!canCare || save.snacks <= 0 || save.energy >= 100) return;
    eatUntilRef.current = Date.now() + 900;
    sfx.eat(2);
    spawnHearts(5);
    mutate((s) => {
      s.snacks -= 1;
      s.energy = Math.min(100, s.energy + 25);
    });
    flash("냠냠! 에너지가 차올라요 ⚡");
  };

  const pet = () => {
    if (!canCare || !petReady) return;
    sfx.pet();
    spawnHearts(7);
    mutate((s) => {
      s.hp = Math.min(100, s.hp + 6);
      s.petCooldownUntil = Date.now() + 45_000;
    });
    flash(`${save.name}가 기분 좋아해요 💕`);
  };

  const HEAL_TAPS = 5;
  const heal = () => {
    if (!canCare || !save.careNeeded) return;
    sfx.pet();
    spawnHearts(3);
    const next = healTaps + 1;
    if (next >= HEAL_TAPS) {
      setHealTaps(0);
      sfx.heal();
      spawnHearts(14);
      mutate((s) => {
        s.hp = Math.max(s.hp, 65);
        s.careNeeded = false;
      });
      persist();
      flash(`치료 완료! ${save.name}가 다시 날 수 있어요 🚀`);
    } else {
      setHealTaps(next);
    }
  };

  const useQuantum = () => {
    if (save.quantumCapsules <= 0 || quantum) return;
    sfx.item();
    mutate((s) => {
      s.quantumCapsules -= 1;
      s.quantumUntil = Date.now() + QUANTUM_LINK_MINUTES * 60_000;
    });
    flash(`퀀텀 링크 개통! ${QUANTUM_LINK_MINUTES}분간 전 지구 교신 🌐`);
  };

  const saveName = () => {
    const trimmed = (nameDraft ?? "").trim();
    if (trimmed) {
      mutate((s) => {
        s.name = trimmed.slice(0, 10);
      });
    }
    setNameDraft(null);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-3 sm:p-4">
        {/* 줍스 무대 */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 shadow-[0_6px_40px_rgba(90,40,130,0.4)]">
          <canvas ref={canvasRef} className="block h-52 w-full sm:h-64" />
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            <span className="w-fit rounded-full border border-white/15 bg-white/[.12] px-2.5 py-1 text-[11px] font-semibold text-pink-50 backdrop-blur-md">
              {stage.name} · Lv.{level}
            </span>
            <span
              className={`w-fit rounded-full border px-2.5 py-1 text-[11px] backdrop-blur-md ${
                canCare
                  ? "border-emerald-200/40 bg-emerald-300/30 text-emerald-50"
                  : "border-white/15 bg-white/[.12] text-pink-100/70"
              }`}
            >
              {quantum ? "🌐 퀀텀 링크" : inRange ? "📡 교신 양호" : "🛰️ 교신 범위 밖"}
            </span>
          </div>
          {notice && (
            <p className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/[.14] px-3 py-2 text-center text-xs text-pink-50 backdrop-blur-md">
              {notice}
            </p>
          )}
        </div>

        {/* 이름 */}
        <div className="flex items-center justify-between rounded-3xl border border-white/15 bg-white/[.08] px-4 py-3 backdrop-blur-xl">
          {nameDraft === null ? (
            <>
              <p className="text-sm font-bold text-pink-50">
                👾 {save.name}
                <span className="ml-2 text-[11px] font-normal text-purple-200/60">
                  함께한 지 {Math.max(1, Math.ceil((now - save.createdAt) / 86400_000))}일째
                </span>
              </p>
              <button
                onClick={() => setNameDraft(save.name)}
                className="flex h-9 items-center rounded-xl px-3 text-xs text-pink-100/70 transition-all duration-300 hover:bg-white/10"
              >
                ✏️ 이름 바꾸기
              </button>
            </>
          ) : (
            <div className="flex w-full items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={10}
                autoFocus
                className="h-10 min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/[.07] px-3 text-sm text-pink-50 outline-none backdrop-blur-sm transition-all duration-300 focus:border-pink-300/60"
              />
              <button
                onClick={saveName}
                className="h-10 shrink-0 rounded-2xl bg-gradient-to-r from-violet-400 to-pink-400 px-4 text-xs font-semibold text-white shadow-[0_2px_14px_rgba(244,114,182,0.4)]"
              >
                저장
              </button>
            </div>
          )}
        </div>

        {/* 상태 바 */}
        <div className="flex flex-col gap-2.5 rounded-3xl border border-white/15 bg-white/[.08] p-4 backdrop-blur-xl">
          <StatBar label="체력" emoji="💗" value={save.hp} max={100} color="bg-pink-300" />
          <StatBar label="에너지" emoji="⚡" value={save.energy} max={100} color="bg-amber-200" />
          <StatBar
            label={`경험치 (Lv.${level})`}
            emoji="✨"
            value={xpCur}
            max={xpNeed}
            color="bg-violet-300"
          />
          {save.careNeeded && (
            <p className="rounded-2xl border border-rose-300/20 bg-rose-400/15 px-3 py-2 text-xs leading-relaxed text-rose-200">
              🚑 {save.name}가 다쳐서 치료가 필요해요. 치료 전까지 비행과 자동 청소가
              멈춰 있어요.
            </p>
          )}
        </div>

        {/* 교신 범위 밖 안내 */}
        {!canCare && (
          <div className="rounded-3xl border border-white/15 bg-white/[.08] p-4 text-center backdrop-blur-xl">
            <p className="text-sm font-semibold text-pink-50">
              🛰️ {save.name}가 아직 머리 위에 없어요
            </p>
            <p className="mt-1 text-xs text-pink-100/70">
              {save.owner.label} 상공 도달까지{" "}
              <span className="font-bold tabular-nums text-pink-50">
                {eta === null ? "48시간 내 없음" : formatCountdown(eta - now)}
              </span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-purple-200/55">
              돌봄은 줍스가 교신 반경({radius.toLocaleString()}km) 안에 있을 때만
              가능해요. 비행 중 🔮 캡슐을 주우면 어디서든 돌볼 수 있어요.
            </p>
            {save.quantumCapsules > 0 && (
              <button
                onClick={useQuantum}
                className="mt-3 h-11 w-full rounded-2xl bg-gradient-to-r from-violet-400 to-fuchsia-400 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(167,139,250,0.45)] transition-all duration-300 hover:shadow-[0_4px_28px_rgba(167,139,250,0.7)]"
              >
                🔮 퀀텀 링크 사용 (보유 {save.quantumCapsules}개)
              </button>
            )}
          </div>
        )}

        {/* 돌봄 액션 */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            onClick={feed}
            disabled={!canCare || save.snacks <= 0 || save.energy >= 100}
            emoji="🍬"
            label={`간식 주기 (${save.snacks})`}
            sub={
              save.snacks <= 0
                ? "쓰레기 15개당 1개 획득"
                : save.energy >= 100
                  ? "에너지가 가득해요"
                  : "에너지 +25"
            }
          />
          <ActionButton
            onClick={pet}
            disabled={!canCare || !petReady}
            emoji="🤍"
            label="쓰다듬기"
            sub={
              petReady
                ? "체력 +6"
                : `${Math.ceil((save.petCooldownUntil - now) / 1000)}초 후 가능`
            }
          />
        </div>
        {save.careNeeded && (
          <button
            onClick={heal}
            disabled={!canCare}
            className="relative h-14 overflow-hidden rounded-3xl bg-gradient-to-r from-rose-400 to-pink-400 text-sm font-bold text-white shadow-[0_4px_22px_rgba(251,113,133,0.45)] transition-all duration-300 enabled:hover:shadow-[0_4px_30px_rgba(251,113,133,0.7)] disabled:opacity-40"
          >
            <span
              className="absolute inset-y-0 left-0 bg-white/25 transition-[width]"
              style={{ width: `${(healTaps / HEAL_TAPS) * 100}%` }}
            />
            <span className="relative">
              🩹 응급 처치하기 ({healTaps}/{HEAL_TAPS} — 연타!)
            </span>
          </button>
        )}
        {canCare && !quantum && save.quantumCapsules > 0 && (
          <button
            onClick={useQuantum}
            className="h-11 rounded-2xl border border-violet-300/30 bg-violet-400/15 text-xs font-semibold text-violet-200 backdrop-blur-xl transition-all duration-300 hover:bg-violet-400/25"
          >
            🔮 퀀텀 링크 사용 — {QUANTUM_LINK_MINUTES}분간 전 지구 교신 (보유{" "}
            {save.quantumCapsules}개)
          </button>
        )}

        <p className="pb-2 text-center text-[11px] leading-relaxed text-purple-200/45">
          지구 시민 모두가 한 마리 이상의 줍스를 보살피면
          케슬러 신드롬을 이겨낼 수 있어요 🌏
        </p>
      </div>
    </div>
  );
}

function StatBar({
  label,
  emoji,
  value,
  max,
  color,
}: {
  label: string;
  emoji: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-pink-100/70">
        <span>
          {emoji} {label}
        </span>
        <span className="tabular-nums">
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${color} shadow-[0_0_10px_rgba(255,200,240,0.35)] transition-[width] duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  emoji,
  label,
  sub,
}: {
  onClick: () => void;
  disabled: boolean;
  emoji: string;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-3xl border border-white/15 bg-white/[.08] px-2 py-3 backdrop-blur-xl transition-all duration-300 enabled:hover:border-pink-200/30 enabled:hover:bg-white/[.14] disabled:opacity-40"
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-semibold text-pink-50">{label}</span>
      <span className="text-[10px] text-purple-200/55">{sub}</span>
    </button>
  );
}
