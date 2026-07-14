// 줍스 스프라이트 — Canvas 2D로 그리는 귀여운 우주 생명체.
// 진화 단계(stageIndex)에 따라 크기·색·더듬이 수·오라가 달라진다.
// 플레이 화면, 관제 지도 마커, 돌보기 초상화가 모두 이 함수를 공유한다.

import { STAGES } from "./constants";

export type JoopsMood = "happy" | "tired" | "hurt" | "sleep";

export type JoopsDrawOpts = {
  mood?: JoopsMood;
  /** 시선·기울기 방향 (-1~1) */
  dirX?: number;
  dirY?: number;
  /** 추진 중이면 꼬리 불꽃 */
  thrust?: boolean;
  alpha?: number;
  /** 떠돌이(친구) 줍스 배색 */
  variant?: "own" | "friend";
};

const FRIEND_BODY = "#ffa8cf";
const FRIEND_GLOW = "#ff6fae";

export function drawJoops(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stageIndex: number,
  tMs: number,
  opts: JoopsDrawOpts = {},
): void {
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, stageIndex))];
  const body = opts.variant === "friend" ? FRIEND_BODY : stage.bodyColor;
  const glow = opts.variant === "friend" ? FRIEND_GLOW : stage.glowColor;
  const mood = opts.mood ?? "happy";
  const dirX = Math.max(-1, Math.min(1, opts.dirX ?? 0));
  const dirY = Math.max(-1, Math.min(1, opts.dirY ?? 0));

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(dirX * 0.14);

  // 말랑말랑 스쿼시
  const squash = 1 + 0.055 * Math.sin(tMs / 300 + x * 0.013);
  const rx = r * 1.05 * squash;
  const ry = r / squash;

  // 추진 불꽃 (몸 뒤쪽)
  if (opts.thrust && mood !== "sleep" && mood !== "hurt") {
    const fx = -dirX || -0.6;
    const fy = -dirY * 0.4 + 0.25;
    const flick = 0.75 + 0.25 * Math.sin(tMs / 42);
    const fl = r * (1.15 + 0.35 * flick);
    const grad = ctx.createRadialGradient(fx * rx, fy * ry, 1, fx * rx * 1.7, fy * ry * 1.7, fl);
    grad.addColorStop(0, "rgba(180,240,255,0.85)");
    grad.addColorStop(0.45, "rgba(90,190,255,0.45)");
    grad.addColorStop(1, "rgba(90,190,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(fx * rx * 1.35, fy * ry * 1.35, fl * 0.75, fl * 0.5, Math.atan2(fy, fx), 0, Math.PI * 2);
    ctx.fill();
  }

  // 오라 (상위 단계)
  if (stageIndex >= 2 && mood !== "sleep") {
    ctx.save();
    ctx.rotate(tMs / 1400);
    ctx.strokeStyle = glow;
    ctx.globalAlpha *= stageIndex >= 4 ? 0.5 : 0.3;
    ctx.setLineDash([r * 0.5, r * 0.55]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 은은한 발광
  const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2);
  halo.addColorStop(0, hexA(glow, 0.34));
  halo.addColorStop(1, hexA(glow, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
  ctx.fill();

  // 더듬이 (단계마다 +1, 최대 3)
  const antennae = Math.min(3, stageIndex + 1);
  for (let k = 0; k < antennae; k++) {
    const spread = antennae === 1 ? 0 : (k / (antennae - 1) - 0.5) * 1.1;
    const sway = Math.sin(tMs / 420 + k * 1.9) * 0.12;
    const ax = Math.sin(spread + sway) * rx * 0.55;
    const tipX = Math.sin(spread + sway * 2) * rx * 0.95;
    const tipY = -ry * (1.55 + 0.12 * Math.sin(tMs / 500 + k));
    ctx.strokeStyle = hexA(body, 0.9);
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax * 0.6, -ry * 0.85);
    ctx.quadraticCurveTo(ax, -ry * 1.3, tipX, tipY);
    ctx.stroke();
    const bulbR = Math.max(2, r * 0.14);
    const bg = ctx.createRadialGradient(tipX, tipY, 0.5, tipX, tipY, bulbR * 2.4);
    bg.addColorStop(0, "rgba(255,255,255,0.95)");
    bg.addColorStop(0.35, hexA(glow, 0.9));
    bg.addColorStop(1, hexA(glow, 0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(tipX, tipY, bulbR * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 몸통
  const bodyGrad = ctx.createRadialGradient(-rx * 0.35, -ry * 0.45, r * 0.2, 0, 0, rx * 1.15);
  bodyGrad.addColorStop(0, lighten(body, 0.45));
  bodyGrad.addColorStop(0.55, body);
  bodyGrad.addColorStop(1, darken(body, 0.3));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // 배 (밝은 부분)
  ctx.fillStyle = hexA("#ffffff", 0.28);
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.42, rx * 0.62, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  const eyeY = -ry * 0.12 + dirY * r * 0.06;
  const eyeDX = rx * 0.36;
  const eyeW = r * 0.3;
  const eyeH = r * 0.4;
  const blink = mood === "sleep" ? 0 : tMs % 3600 < 130 ? 0.12 : 1;

  for (const side of [-1, 1]) {
    const ex = side * eyeDX + dirX * r * 0.08;
    if (mood === "hurt") {
      // X자 눈
      ctx.strokeStyle = "#243044";
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.lineCap = "round";
      const s = eyeW * 0.55;
      ctx.beginPath();
      ctx.moveTo(ex - s, eyeY - s);
      ctx.lineTo(ex + s, eyeY + s);
      ctx.moveTo(ex + s, eyeY - s);
      ctx.lineTo(ex - s, eyeY + s);
      ctx.stroke();
      continue;
    }
    if (mood === "sleep" || blink < 0.5) {
      // 감은 눈 (호선)
      ctx.strokeStyle = "#243044";
      ctx.lineWidth = Math.max(2, r * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(ex, eyeY + eyeH * 0.1, eyeW * 0.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW, eyeH * (mood === "tired" ? 0.62 : 1), 0, 0, Math.PI * 2);
    ctx.fill();
    // 눈동자
    ctx.fillStyle = "#1c2740";
    ctx.beginPath();
    ctx.ellipse(
      ex + dirX * eyeW * 0.3,
      eyeY + dirY * eyeH * 0.22 + (mood === "tired" ? eyeH * 0.12 : 0),
      eyeW * 0.52,
      eyeH * 0.55 * (mood === "tired" ? 0.62 : 1),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // 하이라이트
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(ex + dirX * eyeW * 0.3 - eyeW * 0.16, eyeY - eyeH * 0.18, eyeW * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // 볼터치
  if (mood !== "hurt") {
    ctx.fillStyle = "rgba(255,140,170,0.4)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * rx * 0.58, ry * 0.18, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 입
  ctx.strokeStyle = "#243044";
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  const my = ry * 0.34;
  if (mood === "happy") {
    ctx.arc(0, my - r * 0.06, r * 0.2, Math.PI * 0.2, Math.PI * 0.8);
  } else if (mood === "tired" || mood === "sleep") {
    ctx.moveTo(-r * 0.13, my);
    ctx.lineTo(r * 0.13, my);
  } else {
    ctx.arc(0, my + r * 0.1, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
  }
  ctx.stroke();

  // 잠들었을 때 zzz
  if (mood === "sleep") {
    ctx.font = `${Math.max(9, r * 0.42)}px var(--font-geist-mono), monospace`;
    ctx.fillStyle = hexA("#bcd7ff", 0.5 + 0.4 * Math.sin(tMs / 600));
    ctx.fillText("z", rx * 0.95, -ry * 1.15);
    ctx.fillStyle = hexA("#bcd7ff", 0.5 + 0.4 * Math.sin(tMs / 600 + 1.2));
    ctx.fillText("z", rx * 1.3, -ry * 1.5);
  }

  ctx.restore();
}

// ---- 색 유틸 ----

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function hexA(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
}

function darken(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}
