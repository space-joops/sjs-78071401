"use client";
// 몽환적 우주 배경 — 성운 그라데이션 + 시드 고정 별밭
import { useEffect, useRef } from "react";
import { mulberry32 } from "../lib/rng";

export default function SpaceBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const rnd = mulberry32(7);
      const n = Math.round((w * h) / 3800);
      for (let i = 0; i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 0.3 + rnd() * 1.1;
        const tint = rnd();
        ctx.fillStyle =
          tint > 0.93
            ? `rgba(126,242,216,${0.5 + rnd() * 0.5})`
            : tint > 0.86
              ? `rgba(255,159,178,${0.4 + rnd() * 0.5})`
              : `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#060515]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 15% 8%, rgba(88,60,160,0.30), transparent 70%)," +
            "radial-gradient(50% 40% at 85% 28%, rgba(24,110,140,0.25), transparent 70%)," +
            "radial-gradient(70% 55% at 50% 110%, rgba(30,80,150,0.28), transparent 70%)",
        }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
