// 시네마틱 그래비티 렌더 유틸 — 궤도 비행 화면의 몽환 레이어.
// build* 함수는 시작/리사이즈 시 1회 프리렌더하고, draw* 함수만 매 프레임 호출한다.
import { mulberry32 } from "./rng";

// ---------- 태양 ----------

/** 백열 코어 + 3겹 글로우 + 신 레이(부드러운 광선) 스프라이트 */
export function buildSunSprite(size = 440): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const r = size / 2;

  // 신 레이 — 은은한 방사 광선 6개
  ctx.save();
  ctx.translate(cx, cx);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3 + 0.35);
    const g = ctx.createLinearGradient(0, 0, r * 0.96, 0);
    g.addColorStop(0, "rgba(255,224,176,0.16)");
    g.addColorStop(1, "rgba(255,224,176,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.96, -r * 0.055);
    ctx.lineTo(r * 0.96, r * 0.055);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 글로우
  const glow = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
  glow.addColorStop(0, "rgba(255,248,232,0.95)");
  glow.addColorStop(0.1, "rgba(255,226,170,0.55)");
  glow.addColorStop(0.32, "rgba(255,196,128,0.18)");
  glow.addColorStop(0.7, "rgba(255,180,110,0.05)");
  glow.addColorStop(1, "rgba(255,180,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 코어
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, size * 0.075);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.6, "#fff4dd");
  core.addColorStop(1, "rgba(255,240,214,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cx, size * 0.075, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** 렌즈 플레어 — 태양→화면 중심 축의 고스트 + 아나모픽 스트릭 */
export function drawLensFlare(
  ctx: CanvasRenderingContext2D,
  sunX: number,
  sunY: number,
  w: number,
  h: number,
  t: number,
) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = cx - sunX;
  const dy = cy - sunY;
  const breathe = 0.85 + Math.sin(t * 0.4) * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // 아나모픽 가로 스트릭
  const streak = ctx.createLinearGradient(sunX - w * 0.45, 0, sunX + w * 0.45, 0);
  streak.addColorStop(0, "rgba(150,220,255,0)");
  streak.addColorStop(0.5, `rgba(190,235,255,${0.10 * breathe})`);
  streak.addColorStop(1, "rgba(150,220,255,0)");
  ctx.fillStyle = streak;
  ctx.fillRect(sunX - w * 0.45, sunY - 1.5, w * 0.9, 3);

  // 고스트 원
  const ghosts: [number, number, string][] = [
    [0.55, 0.045 * w, `rgba(126,242,216,${0.07 * breathe})`],
    [0.95, 0.022 * w, `rgba(255,214,160,${0.08 * breathe})`],
    [1.35, 0.06 * w, `rgba(150,190,255,${0.05 * breathe})`],
    [1.7, 0.03 * w, `rgba(255,236,200,${0.06 * breathe})`],
  ];
  for (const [f, r, color] of ghosts) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sunX + dx * f, sunY + dy * f, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- 달 ----------

export function buildMoonSprite(size = 76): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const r = size * 0.3;
  const halo = ctx.createRadialGradient(cx, cx, r * 0.6, cx, cx, size / 2);
  halo.addColorStop(0, "rgba(220,230,250,0.32)");
  halo.addColorStop(1, "rgba(220,230,250,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  const body = ctx.createRadialGradient(cx - r * 0.35, cx - r * 0.35, r * 0.2, cx, cx, r);
  body.addColorStop(0, "#f5f7fb");
  body.addColorStop(1, "#b9c4d8");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(140,152,176,0.5)";
  for (const [ox, oy, cr] of [
    [-0.3, 0.1, 0.22],
    [0.25, -0.25, 0.16],
    [0.15, 0.35, 0.12],
  ]) {
    ctx.beginPath();
    ctx.arc(cx + r * ox, cx + r * oy, r * cr, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// ---------- 필름 룩 ----------

/** 가장자리를 어둡게 하는 비네트 */
export function buildVignette(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(2, w);
  c.height = Math.max(2, h);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.42,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.78,
  );
  g.addColorStop(0, "rgba(0,0,10,0)");
  g.addColorStop(1, "rgba(0,0,10,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** 필름 그레인 노이즈 타일 */
export function buildGrain(size = 224, seed = 3): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + rnd() * 130;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 그레인을 프레임마다 미세하게 지터하며 타일링 (overlay 합성) */
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  grain: HTMLCanvasElement,
  w: number,
  h: number,
  t: number,
  jitter = true,
) {
  const s = grain.width;
  const ox = jitter ? Math.floor((t * 53) % s) : 0;
  const oy = jitter ? Math.floor((t * 97) % s) : 0;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = "overlay";
  for (let x = -ox; x < w; x += s) {
    for (let y = -oy; y < h; y += s) {
      ctx.drawImage(grain, x, y);
    }
  }
  ctx.restore();
}

// ---------- 대기 ----------

/**
 * 3겹 대기 스트립 프리렌더.
 * 스트립 내 수평선은 HORIZON_RATIO 위치 — drawAtmosphere가 지구 곡률을 따라 붙인다.
 */
export const ATMO_H = 150;
export const ATMO_HORIZON_RATIO = 0.66;

export function buildAtmosphereStrip(w: number, sunX01: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(2, w);
  c.height = ATMO_H;
  const ctx = c.getContext("2d")!;
  const hy = ATMO_H * ATMO_HORIZON_RATIO;

  // 바깥 바이올렛 헤일로
  const halo = ctx.createLinearGradient(0, 0, 0, hy);
  halo.addColorStop(0, "rgba(150,130,255,0)");
  halo.addColorStop(1, "rgba(150,130,255,0.10)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, hy);

  // 중간 블루 밴드
  const mid = ctx.createLinearGradient(0, hy - 46, 0, hy);
  mid.addColorStop(0, "rgba(90,170,255,0)");
  mid.addColorStop(1, "rgba(96,178,255,0.28)");
  ctx.fillStyle = mid;
  ctx.fillRect(0, hy - 46, w, 46);

  // 안쪽 시안 밝은 림 (수평선 바로 위)
  const rim = ctx.createLinearGradient(0, hy - 12, 0, hy + 2);
  rim.addColorStop(0, "rgba(210,245,255,0)");
  rim.addColorStop(1, "rgba(215,246,255,0.85)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, hy - 12, w, 14);

  // 수평선 아래로 짧게 잦아드는 산란광
  const below = ctx.createLinearGradient(0, hy, 0, ATMO_H);
  below.addColorStop(0, "rgba(190,235,255,0.5)");
  below.addColorStop(1, "rgba(190,235,255,0)");
  ctx.fillStyle = below;
  ctx.fillRect(0, hy, w, ATMO_H - hy);

  // 태양 쪽 웜톤 산란
  const sx = sunX01 * w;
  const warm = ctx.createRadialGradient(sx, hy, 0, sx, hy, w * 0.4);
  warm.addColorStop(0, "rgba(255,196,140,0.22)");
  warm.addColorStop(1, "rgba(255,196,140,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, ATMO_H);
  return c;
}

/** 대기 스트립을 지구 곡률(yAt)을 따라 세로 슬라이스로 그린다 */
export function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  strip: HTMLCanvasElement,
  w: number,
  yAt: (x: number) => number,
) {
  const slices = 12;
  const sw = w / slices;
  for (let i = 0; i < slices; i++) {
    const x = i * sw;
    const y = yAt(x + sw / 2);
    ctx.drawImage(
      strip,
      x,
      0,
      sw,
      ATMO_H,
      x,
      y - ATMO_H * ATMO_HORIZON_RATIO,
      sw + 1,
      ATMO_H,
    );
  }
}

// ---------- 오로라 ----------

/** 수평선 위에서 명멸하는 초록 커튼 리본 2개 */
export function drawAurora(
  ctx: CanvasRenderingContext2D,
  w: number,
  yAt: (x: number) => number,
  t: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 2; k++) {
    const intensity = Math.max(0, Math.sin(t * 0.11 + k * 2.4)) * 0.13;
    if (intensity < 0.015) continue;
    const x0 = w * (0.08 + k * 0.5 + 0.06 * Math.sin(t * 0.05 + k * 3));
    const width = w * 0.36;
    const n = 22;
    let minTop = Infinity;
    const pts: { x: number; yb: number; yt: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (i / n) * width;
      const yb = yAt(x) + 4;
      const hgt = 34 + 22 * Math.sin(t * 0.8 + x * 0.018 + k * 2);
      const yt = yb - Math.max(14, hgt);
      if (yt < minTop) minTop = yt;
      pts.push({ x, yb, yt });
    }
    const g = ctx.createLinearGradient(0, pts[0].yb, 0, minTop);
    g.addColorStop(0, `rgba(110,255,180,${intensity})`);
    g.addColorStop(0.55, `rgba(110,255,190,${intensity * 0.45})`);
    g.addColorStop(1, "rgba(110,255,190,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].yb);
    for (const p of pts) ctx.lineTo(p.x, p.yb);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].yt);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- 밝은 별 ----------

export type BrightStar = {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  cool: boolean;
};

export function makeBrightStars(w: number, h: number, seed = 21): BrightStar[] {
  const rnd = mulberry32(seed);
  const stars: BrightStar[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    stars.push({
      x: rnd() * w,
      y: rnd() * h * 0.62,
      r: 1 + rnd() * 1.6,
      phase: rnd() * Math.PI * 2,
      speed: 0.5 + rnd() * 1.4,
      cool: rnd() > 0.5,
    });
  }
  return stars;
}

/** 십자 글린트 + 사인 트윙클 */
export function drawBrightStars(
  ctx: CanvasRenderingContext2D,
  stars: BrightStar[],
  t: number,
  scrollX: number,
  w: number,
) {
  for (const s of stars) {
    const a = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
    const x = (((s.x - scrollX * 0.12) % w) + w) % w;
    const color = s.cool ? `rgba(200,230,255,${a})` : `rgba(255,238,210,${a})`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const L = s.r * 4;
    ctx.beginPath();
    ctx.moveTo(x - L, s.y);
    ctx.lineTo(x + L, s.y);
    ctx.moveTo(x, s.y - L);
    ctx.lineTo(x, s.y + L);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
