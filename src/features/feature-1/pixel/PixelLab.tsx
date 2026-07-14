"use client";

// 픽셀 랩 — 줍스 스네이크 에셋 미리보기.
// 16x16 스프라이트 갤러리, 꿀꺽 성장 데모, 이미지 생성 AI용 프롬프트를 제공한다.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "../constants";
import { FRIEND_REMAP, STAGE_REMAPS } from "../joopsSprite";
import { AI_PROMPTS } from "./prompts";
import {
  drawSprite,
  DEBRIS_BOLT,
  FLAME_FRAMES,
  JOOPS_CHOMP,
  JOOPS_IDLE,
  JOOPS_OPEN,
  ORBIT_DASH,
  PALETTE,
  SEGMENT,
  SEGMENT_BULGE,
  SPRITES,
  STARS_FRAMES,
  type PaletteRemap,
  type PixelGrid,
} from "./sprites";

export default function PixelLab() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#060b18] font-sans text-white">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 px-1">
        <Link
          href="/features/1"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 transition-colors hover:bg-white/10"
          aria-label="줍스 오비탈로 돌아가기"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">픽셀 랩 🎨</p>
          <p className="text-[10px] leading-none text-white/45">줍스 스네이크 · 16비트 에셋</p>
        </div>
        <span className="px-3 font-mono text-[10px] text-cyan-300/70">16×16 SNES STYLE</span>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-3 sm:mx-auto sm:max-w-2xl sm:p-4">
          {/* 성장 데모 */}
          <Section
            title="꿀꺽 성장 데모"
            desc="쓰레기를 먹을 때마다 벌지가 꼬리로 내려가고 몸이 한 마디(1픽셀 단위) 자랍니다."
          >
            <GrowthDemo />
          </Section>

          {/* 스프라이트 갤러리 */}
          <Section title="스프라이트" desc="HTML5 Canvas에서 바로 렌더링되는 팔레트 인덱스 2D 배열입니다.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SPRITES.map((s) => (
                <div
                  key={s.key}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#0a1526]/80 p-3"
                >
                  <SpriteView frames={s.frames} fps={s.fps} scale={5} />
                  <p className="text-center text-[11px] font-semibold text-white/75">{s.label}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* 진화 팔레트 */}
          <Section
            title="진화 팔레트 스왑"
            desc="줍스 오비탈의 5단계 진화는 같은 도트에 팔레트만 갈아 끼워 표현합니다 (+떠돌이 줍스)."
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {STAGE_REMAPS.map((remap, i) => (
                <div
                  key={STAGES[i].name}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-[#0a1526]/80 p-2"
                >
                  <SpriteView frames={[JOOPS_IDLE]} fps={1} scale={4} remap={remap} />
                  <p className="text-center text-[10px] font-semibold text-white/70">
                    {STAGES[i].name}
                  </p>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-[#0a1526]/80 p-2">
                <SpriteView frames={[JOOPS_IDLE]} fps={1} scale={4} remap={FRIEND_REMAP} />
                <p className="text-center text-[10px] font-semibold text-white/70">떠돌이 줍스</p>
              </div>
            </div>
          </Section>

          {/* 팔레트 */}
          <Section title="팔레트" desc="고대비 16색 + 투명. 딥 네이비 외곽선이 16비트 감성의 핵심입니다.">
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((hex, i) =>
                i === 0 ? null : (
                  <div key={hex + i} className="flex flex-col items-center gap-0.5">
                    <span
                      className="h-8 w-8 rounded-md border border-white/15"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="font-mono text-[8px] text-white/40">{hex}</span>
                  </div>
                ),
              )}
            </div>
          </Section>

          {/* AI 프롬프트 */}
          <Section
            title="이미지 생성 AI 프롬프트"
            desc="고해상도 시안이 필요할 때 미드저니·DALL·E 등에 붙여 넣으세요 (영문)."
          >
            <div className="flex flex-col gap-2">
              {AI_PROMPTS.map((p) => (
                <PromptCard key={p.id} title={p.title} usage={p.usage} prompt={p.prompt} />
              ))}
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
        {title}
      </h2>
      <p className="mb-2 mt-0.5 text-xs text-white/45">{desc}</p>
      {children}
    </section>
  );
}

/** 프레임 배열을 fps로 순환 재생하는 미리보기 캔버스 */
function SpriteView({
  frames,
  fps,
  scale,
  remap,
}: {
  frames: PixelGrid[];
  fps: number;
  scale: number;
  remap?: PaletteRemap;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = 16 * scale;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;
    const paint = () => {
      ctx.fillStyle = "#0d1a2e";
      ctx.fillRect(0, 0, size, size);
      drawSprite(ctx, frames[frame % frames.length], 0, 0, scale, remap);
      frame++;
    };
    paint();
    const timer = frames.length > 1 ? setInterval(paint, 1000 / fps) : null;
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [frames, fps, scale, size, remap]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

/** 프롬프트 카드 + 클립보드 복사 */
function PromptCard({ title, usage, prompt }: { title: string; usage: string; prompt: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 클립보드 미지원 환경 — 텍스트가 그대로 보이므로 수동 복사 가능
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1526]/80 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">{title}</p>
          <p className="text-[10px] text-white/45">{usage}</p>
        </div>
        <button
          onClick={copy}
          className={`h-11 shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${
            copied
              ? "bg-emerald-300 text-emerald-950"
              : "border border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
          }`}
        >
          {copied ? "복사됨 ✓" : "복사"}
        </button>
      </div>
      <p className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-white/60">
        {prompt}
      </p>
    </div>
  );
}

// ---- 꿀꺽 성장 데모 ----

type Spark = { x: number; y: number; vx: number; vy: number; life: number };

const S = 2; // 데모 스프라이트 스케일
const SEG_GAP = 19; // 세그먼트 간격(px)

function GrowthDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [segCount, setSegCount] = useState(3);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const H = 160;
    let W = wrap.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fit = () => {
      W = wrap.clientWidth;
      canvas.width = Math.round(W * dpr);
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    // 데모 월드 상태
    let n = 3; // 몸통 세그먼트 수
    const bulges: number[] = []; // 세그먼트 단위 위치
    const bolts: number[] = []; // 쓰레기 x 좌표
    const sparks: Spark[] = [];
    let nextBoltAt = performance.now() + 700;
    let chompUntil = 0;
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const orbitY = H / 2;
      const headX = Math.min(W * 0.62, W - 60);

      // 스폰·이동
      if (now >= nextBoltAt) {
        bolts.push(W + 20);
        nextBoltAt = now + 1900 + Math.random() * 900;
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        bolts[i] -= 85 * dt;
        if (bolts[i] < headX + 10) {
          // 냠! — 벌지 삽입, 씹기 시작
          bolts.splice(i, 1);
          bulges.push(0);
          chompUntil = now + 300;
          for (let k = 0; k < 6; k++) {
            sparks.push({
              x: headX + 14,
              y: orbitY,
              vx: (Math.random() - 0.2) * 90,
              vy: (Math.random() - 0.5) * 110,
              life: 0.5,
            });
          }
        }
      }
      // 벌지가 꼬리에 닿으면 +1 마디
      for (let i = bulges.length - 1; i >= 0; i--) {
        bulges[i] += 3.2 * dt;
        if (bulges[i] >= n - 0.5) {
          bulges.splice(i, 1);
          n = n >= 9 ? 3 : n + 1; // 9마디가 되면 데모 리셋
          setSegCount(n);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) sparks.splice(i, 1);
      }

      // ---- 그리기 ----
      ctx.fillStyle = "#060b18";
      ctx.fillRect(0, 0, W, H);

      // 별무리 타일 (두 겹 패럴랙스 + 트윙클)
      const starFrame = STARS_FRAMES[Math.floor(now / 600) % 2];
      const tile = 16 * S;
      const off1 = (now * 0.012) % tile;
      const off2 = (now * 0.028) % tile;
      for (let ty = 0; ty < H; ty += tile) {
        for (let tx = -tile; tx < W + tile; tx += tile) {
          drawSprite(ctx, starFrame, tx - off1, ty, S);
        }
      }
      for (let tx = -tile; tx < W + tile; tx += tile) {
        drawSprite(ctx, STARS_FRAMES[(Math.floor(now / 600) + 1) % 2], tx - off2, H * 0.3, S);
      }

      // 궤도 점선 (스크롤)
      const dashOff = (now * 0.05) % tile;
      for (let tx = -tile; tx < W + tile; tx += tile) {
        drawSprite(ctx, ORBIT_DASH, tx - dashOff, orbitY - 8 * S, S);
      }

      // 쓰레기
      for (const bx of bolts) {
        drawSprite(ctx, DEBRIS_BOLT, bx - 8 * S, orbitY - 8 * S + Math.sin(now / 300 + bx) * 3, S);
      }

      // 꼬리 불꽃 → 몸통(꼬리부터) → 머리 순서로 겹쳐 그린다
      const flame = FLAME_FRAMES[Math.floor(now / 110) % 2];
      const tailX = headX - SEG_GAP * (n + 0.9);
      drawSprite(ctx, flame, tailX - 8 * S, orbitY - 8 * S + Math.sin(now / 250 - n * 0.8) * 3, S);

      for (let i = n - 1; i >= 0; i--) {
        const sx = headX - SEG_GAP * (i + 1);
        const sy = orbitY + Math.sin(now / 250 - i * 0.8) * 3;
        const isBulge = bulges.some((bp) => Math.abs(bp - i) < 0.5);
        drawSprite(ctx, isBulge ? SEGMENT_BULGE : SEGMENT, sx - 8 * S, sy - 8 * S, S);
      }

      const headGrid = now < chompUntil ? JOOPS_CHOMP : JOOPS_OPEN;
      drawSprite(ctx, headGrid, headX - 8 * S, orbitY - 8 * S + Math.sin(now / 250) * 3, S);

      // 스파크
      for (const p of sparks) {
        ctx.fillStyle = p.life > 0.25 ? "#ffe66e" : "#ff4a2a";
        ctx.fillRect(p.x, p.y, 3, 3);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-xl border border-white/10">
      <canvas ref={canvasRef} className="block w-full" style={{ height: 160 }} aria-label="줍스 스네이크 성장 데모" />
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[10px] text-cyan-200 backdrop-blur">
        BODY ×{segCount}
      </span>
    </div>
  );
}
