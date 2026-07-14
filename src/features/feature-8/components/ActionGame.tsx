"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACTION_DURATION_MS, ACTION_EXP_PER_TRASH } from "../lib/game";
import Starfield from "./Starfield";
import styles from "../styles.module.css";

const TRASH_EMOJI = ["🗑️", "🛰️", "🔩", "🥫", "📡", "🧃"];
const MAX_ITEMS = 12;

type Trash = {
  id: number;
  x: number; // 컨테이너 % 좌표
  y: number;
  vx: number; // %/초
  vy: number;
  rot: number;
  vr: number;
  emoji: string;
  size: number; // px (터치 타깃 44px 이상)
};

type Pop = { id: number; x: number; y: number };

export default function ActionGame({
  onFinish,
}: {
  onFinish: (exp: number) => void;
}) {
  const [items, setItems] = useState<Trash[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [score, setScore] = useState(0);
  const [msLeft, setMsLeft] = useState(ACTION_DURATION_MS);
  const [done, setDone] = useState(false);
  const idRef = useRef(0);
  const endAtRef = useRef(0);

  const exp = score * ACTION_EXP_PER_TRASH;

  // 제한 시간
  useEffect(() => {
    endAtRef.current = Date.now() + ACTION_DURATION_MS;
    const tid = window.setInterval(() => {
      const left = endAtRef.current - Date.now();
      setMsLeft(left);
      if (left <= 0) {
        setDone(true);
        window.clearInterval(tid);
      }
    }, 100);
    return () => window.clearInterval(tid);
  }, []);

  // 쓰레기 스폰: 화면 가장자리에서 안쪽을 향해 날아온다
  useEffect(() => {
    if (done) return;
    const spawn = () => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        idRef.current += 1;
        const edge = Math.floor(Math.random() * 4);
        const along = 10 + Math.random() * 80;
        let x = 0;
        let y = 0;
        if (edge === 0) {
          x = along;
          y = -8;
        } else if (edge === 1) {
          x = 108;
          y = along;
        } else if (edge === 2) {
          x = along;
          y = 108;
        } else {
          x = -8;
          y = along;
        }
        const tx = 20 + Math.random() * 60;
        const ty = 25 + Math.random() * 50;
        const dx = tx - x;
        const dy = ty - y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 10 + Math.random() * 12;
        return [
          ...prev,
          {
            id: idRef.current,
            x,
            y,
            vx: (dx / len) * speed,
            vy: (dy / len) * speed,
            rot: Math.random() * 360,
            vr: (Math.random() - 0.5) * 180,
            emoji: TRASH_EMOJI[Math.floor(Math.random() * TRASH_EMOJI.length)],
            size: 44 + Math.floor(Math.random() * 16),
          },
        ];
      });
    };
    spawn();
    const tid = window.setInterval(spawn, 650);
    return () => window.clearInterval(tid);
  }, [done]);

  // 이동 루프
  useEffect(() => {
    if (done) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      setItems((prev) =>
        prev
          .map((it) => ({
            ...it,
            x: it.x + it.vx * dt,
            y: it.y + it.vy * dt,
            rot: it.rot + it.vr * dt,
          }))
          .filter((it) => it.x > -12 && it.x < 112 && it.y > -12 && it.y < 112),
      );
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  const smash = useCallback((it: Trash) => {
    setItems((prev) => prev.filter((p) => p.id !== it.id));
    setScore((s) => s + 1);
    idRef.current += 1;
    const popId = idRef.current;
    setPops((prev) => [...prev, { id: popId, x: it.x, y: it.y }]);
    window.setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== popId));
    }, 600);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex touch-none select-none flex-col overscroll-contain bg-[#050914] text-white">
      <Starfield />

      <header className="relative z-10 flex items-center gap-3 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold">🧹 우주 쓰레기 줍기</span>
            <span className="tabular-nums text-white/70">
              {Math.ceil(Math.max(0, msLeft) / 1000)}초
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${(Math.max(0, msLeft) / ACTION_DURATION_MS) * 100}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => onFinish(exp)}
          className="min-h-11 shrink-0 rounded-full border border-white/20 px-3 text-xs text-white/70"
        >
          조기 복귀
        </button>
      </header>

      <div className="relative z-10 flex items-center justify-between px-4 text-sm">
        <span>
          처리 <b className="tabular-nums">{score}</b>개
        </span>
        <span className="font-bold tabular-nums text-emerald-300">+{exp} EXP</span>
      </div>

      <div className="relative z-10 flex-1 overflow-hidden">
        {!done &&
          items.map((it) => (
            <button
              key={it.id}
              onPointerDown={() => smash(it)}
              aria-label={`우주 쓰레기 ${it.emoji}`}
              className="absolute flex items-center justify-center"
              style={{
                left: `${it.x}%`,
                top: `${it.y}%`,
                width: it.size,
                height: it.size,
                transform: `translate(-50%, -50%) rotate(${it.rot}deg)`,
                fontSize: it.size * 0.72,
              }}
            >
              {it.emoji}
            </button>
          ))}
        {pops.map((p) => (
          <span
            key={p.id}
            className={`${styles.pop} absolute text-2xl`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            💥
          </span>
        ))}
        {!done && items.length === 0 && (
          <p className="absolute inset-x-0 top-1/3 px-4 text-center text-sm text-white/50">
            쓰레기가 날아옵니다… 탭해서 부수세요!
          </p>
        )}
      </div>

      {done && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#101726] p-6 text-center">
            <h3 className="text-xl font-bold">타임 업! 🛸</h3>
            <p className="mt-2 text-sm text-white/70">
              우주 쓰레기 <b className="tabular-nums">{score}</b>개 처리
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">+{exp} EXP</p>
            <button
              onClick={() => onFinish(exp)}
              className="mt-5 h-14 w-full rounded-2xl bg-white font-bold text-black transition-transform active:scale-[0.98]"
            >
              관제 센터로 복귀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
