"use client";

// 돌보기 화면·진화 연출에서 쓰는 애니메이션 초상화 캔버스.

import { useEffect, useRef } from "react";
import { drawJoops, type JoopsMood } from "./joopsSprite";

export default function JoopsPortrait({
  size,
  stageIndex,
  mood,
}: {
  size: number;
  stageIndex: number;
  mood: JoopsMood;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const stageRef = useRef(stageIndex);
  stageRef.current = stageIndex;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const loop = (t: number) => {
      ctx.clearRect(0, 0, size, size);
      drawJoops(ctx, size / 2, size * 0.56 + Math.sin(t / 640) * size * 0.02, size * 0.28, stageRef.current, t, {
        mood: moodRef.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
