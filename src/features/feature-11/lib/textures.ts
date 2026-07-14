// 런타임 캔버스 아틀라스 — 외부 이미지 에셋 0바이트 관례.
// 모든 파편/이펙트 프레임을 캔버스 1장에 구워 텍스처 소스를 하나로 유지한다
// (단일 소스 = ParticleContainer 배칭이 draw call 1회로 완결되는 성능 핵심).
import type { Texture } from "pixi.js";

type Pixi = typeof import("pixi.js");

const CELL = 64;
const COLS = 8;

/** 파편 도형의 기준 반경(px) — 스프라이트 scale = 목표반경 / DEBRIS_DRAWN_RADIUS */
export const DEBRIS_DRAWN_RADIUS = 22;
export const RING_DRAWN_RADIUS = 26;
export const GLOW_DRAWN_RADIUS = 30;
export const PET_DRAWN_RADIUS = 56;

export type Atlas = {
  /** typeId 0~4 일반 파편 */
  debris: Texture[];
  hazard: Texture;
  spark: Texture;
  glow: Texture;
  ring: Texture;
  star: Texture;
};

export function buildAtlas(PIXI: Pixi): Atlas {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * COLS;
  canvas.height = CELL * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  drawInCell(ctx, 0, drawBolt);
  drawInCell(ctx, 1, drawPanelShard);
  drawInCell(ctx, 2, drawSolarFleck);
  drawInCell(ctx, 3, drawFairing);
  drawInCell(ctx, 4, drawSatCore);
  drawInCell(ctx, 5, drawHazard);
  drawInCell(ctx, 6, drawSpark);
  drawInCell(ctx, 7, drawGlow);
  drawInCell(ctx, 8, drawRing);
  drawInCell(ctx, 9, drawStar);

  const source = PIXI.Texture.from(canvas).source;
  const frame = (i: number) =>
    new PIXI.Texture({
      source,
      frame: new PIXI.Rectangle((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL),
    });

  return {
    debris: [frame(0), frame(1), frame(2), frame(3), frame(4)],
    hazard: frame(5),
    spark: frame(6),
    glow: frame(7),
    ring: frame(8),
    star: frame(9),
  };
}

function drawInCell(
  ctx: CanvasRenderingContext2D,
  index: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  ctx.save();
  ctx.translate((index % COLS) * CELL + CELL / 2, Math.floor(index / COLS) * CELL + CELL / 2);
  draw(ctx);
  ctx.restore();
}

/** 육각 볼트 */
function drawBolt(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * 18;
    const y = Math.sin(a) * 18;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#9aa4b8";
  ctx.fill();
  ctx.strokeStyle = "#5c6474";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#6b7488";
  ctx.fill();
}

/** 패널 파편 — 불규칙 사각 */
function drawPanelShard(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.lineTo(14, -20);
  ctx.lineTo(20, 8);
  ctx.lineTo(-8, 20);
  ctx.closePath();
  ctx.fillStyle = "#8fb7d8";
  ctx.fill();
  ctx.strokeStyle = "#4f6d8a";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.lineTo(12, -14);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** 태양전지 조각 — 셀 격자 */
function drawSolarFleck(ctx: CanvasRenderingContext2D): void {
  ctx.rotate(-0.3);
  ctx.fillStyle = "#123156";
  ctx.fillRect(-20, -14, 40, 28);
  ctx.strokeStyle = "#3fd2c7";
  ctx.lineWidth = 2;
  ctx.strokeRect(-20, -14, 40, 28);
  ctx.beginPath();
  for (let x = -10; x <= 10; x += 10) {
    ctx.moveTo(x, -14);
    ctx.lineTo(x, 14);
  }
  ctx.moveTo(-20, 0);
  ctx.lineTo(20, 0);
  ctx.strokeStyle = "rgba(63,210,199,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** 페어링 조각 — 초승달 곡면 */
function drawFairing(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.arc(0, 0, 20, -0.4, Math.PI + 0.4);
  ctx.arc(0, -7, 15, Math.PI + 0.25, -0.25, true);
  ctx.closePath();
  ctx.fillStyle = "#d7dde8";
  ctx.fill();
  ctx.strokeStyle = "#8a93a6";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/** 위성 코어 — 몸통 + 접시 안테나 */
function drawSatCore(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#c8cfdd";
  ctx.beginPath();
  ctx.roundRect(-14, -12, 28, 24, 6);
  ctx.fill();
  ctx.strokeStyle = "#79839a";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "#ffd27f";
  ctx.fillRect(-9, -6, 18, 5);
  ctx.beginPath();
  ctx.arc(0, -18, 7, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.strokeStyle = "#ffd27f";
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** 위험 파편 — 붉은 가시 성게 */
function drawHazard(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  grad.addColorStop(0, "rgba(255,93,108,0.5)");
  grad.addColorStop(1, "rgba(255,93,108,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 22 : 10;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#ff5d6c";
  ctx.fill();
  ctx.strokeStyle = "#a3122a";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#5f0716";
  ctx.fill();
}

/** 스파크 — 코어가 밝고 감쇠가 가파른 점광 */
function drawSpark(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
}

/** 소프트 글로우 — 트레일/후광용 */
function drawGlow(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, GLOW_DRAWN_RADIUS);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, GLOW_DRAWN_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

/** 링 — 자석 반경 표시/수거 버스트 */
function drawRing(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.arc(0, 0, RING_DRAWN_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** 배경 별 — 점광 + 십자 플레어 */
function drawStar(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 16);
  ctx.stroke();
}

// ── 줍스 펫 ──────────────────────────────────────────────────────

export type PetLook = {
  body: Texture;
  /** 트레일/후광 틴트 */
  trailTint: number;
  glowTint: number;
};

const STAGE_BODY = ["#38e0c8", "#7ef29b", "#57b6ff", "#ffd76a"] as const;
const STAGE_DARK = ["#0f8f7d", "#2c9d55", "#1f6dc0", "#c99417"] as const;
const STAGE_TINT = [0x38e0c8, 0x7ef29b, 0x57b6ff, 0xffd76a] as const;

/** 진화 단계(0~3)별 줍스 몸통 텍스처를 캔버스로 굽는다 */
export function buildPetLook(PIXI: Pixi, stage: number): PetLook {
  const s = Math.max(0, Math.min(STAGE_BODY.length - 1, stage));
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.translate(size / 2, size / 2);

  const body = STAGE_BODY[s];
  const dark = STAGE_DARK[s];

  // 3단계: 황금 아우라를 몸통 뒤에 굽는다
  if (s === 3) {
    const aura = ctx.createRadialGradient(0, 0, 30, 0, 0, 78);
    aura.addColorStop(0, "rgba(255,215,106,0.5)");
    aura.addColorStop(1, "rgba(255,215,106,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.fill();
  }

  // 1단계+: 더듬이
  if (s >= 1) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, -46);
    ctx.quadraticCurveTo(-22, -66, -30, -70);
    ctx.moveTo(14, -46);
    ctx.quadraticCurveTo(22, -66, 30, -70);
    ctx.stroke();
    ctx.fillStyle = body;
    for (const dx of [-30, 30]) {
      ctx.beginPath();
      ctx.arc(dx, -70, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2단계+: 옆 지느러미
  if (s >= 2) {
    ctx.fillStyle = dark;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 48, -6);
      ctx.quadraticCurveTo(dir * 78, 0, dir * 52, 22);
      ctx.quadraticCurveTo(dir * 46, 10, dir * 44, 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 몸통 — 살짝 눌린 원형 블롭
  const grad = ctx.createRadialGradient(-14, -18, 8, 0, 0, PET_DRAWN_RADIUS);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.25, body);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 50, 46, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3단계: 왕관 돌기
  if (s === 3) {
    ctx.fillStyle = "#fff2c4";
    ctx.beginPath();
    ctx.moveTo(-20, -40);
    ctx.lineTo(-12, -58);
    ctx.lineTo(-4, -42);
    ctx.lineTo(4, -60);
    ctx.lineTo(12, -42);
    ctx.lineTo(20, -40);
    ctx.closePath();
    ctx.fill();
  }

  // 얼굴
  ctx.fillStyle = "#101728";
  for (const dx of [-18, 18]) {
    ctx.beginPath();
    ctx.ellipse(dx, -4, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  for (const dx of [-15, 21]) {
    ctx.beginPath();
    ctx.arc(dx, -8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#101728";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 12, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,120,140,0.45)";
  for (const dx of [-30, 30]) {
    ctx.beginPath();
    ctx.ellipse(dx, 10, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    body: PIXI.Texture.from(canvas),
    trailTint: STAGE_TINT[s],
    glowTint: STAGE_TINT[s],
  };
}
