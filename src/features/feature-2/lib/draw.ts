// 줍스 캐릭터 캔버스 드로잉 — 비행/돌봄 화면 공용

import { STAGES } from "./gameConfig";

export type Mood = "happy" | "eat" | "hurt" | "sleep" | "tired";

export type JoopsPose = {
  x: number;
  y: number;
  r: number;
  stage: number; // 0..4
  t: number; // 초 단위 애니메이션 시각
  mood: Mood;
  lookX?: number; // -1..1 시선 방향
  vx?: number; // 속도 기반 스쿼시
  hue?: number; // 색조 회전(친구 줍스용, deg)
};

export function drawStarShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.3, y, x - r * 0.6, y - r, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r, x + r * 1.3, y, x, y + r * 0.9);
  ctx.closePath();
}

export function drawJoops(ctx: CanvasRenderingContext2D, p: JoopsPose) {
  const stage = STAGES[Math.max(0, Math.min(4, p.stage))];
  const { x, r, t, mood } = p;
  const y = p.y + Math.sin(t * 2.1) * r * 0.07; // 무중력 부유 보브
  const squish = Math.max(0.85, Math.min(1.15, 1 + (p.vx ?? 0) * 0.0012));

  ctx.save();
  if (p.hue) ctx.filter = `hue-rotate(${p.hue}deg)`;

  // 오로라 리본 (3단계+): 몸 뒤로 흐르는 물결
  if (stage.stage >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const px = x - r * 0.6 - i * r * 0.16;
        const py =
          y + Math.sin(t * 3 + i * 0.55 + k * 1.8) * r * (0.24 + k * 0.1);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = ["#67e8f9", "#c4b5fd", "#f9a8d4"][k];
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  // 네뷸라 고리 (4단계+): 뒤쪽 절반
  const drawRing = (front: boolean) => {
    ctx.save();
    ctx.strokeStyle = front ? "rgba(249,168,212,0.85)" : "rgba(249,168,212,0.4)";
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + r * 0.12,
      r * 1.5,
      r * 0.42,
      -0.28,
      front ? 0 : Math.PI,
      front ? Math.PI : Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();
  };
  if (stage.stage >= 3) drawRing(false);

  // 몸통
  ctx.save();
  ctx.shadowColor = stage.glow;
  ctx.shadowBlur = r * 0.9;
  const body = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.4,
    r * 0.15,
    x,
    y,
    r * 1.15
  );
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.25, stage.color);
  body.addColorStop(1, shade(stage.color));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.02 * squish, r * 0.96 / squish, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 안테나 (전 단계 공통 — 지구와 교신하는 비콘)
  const ax = x + Math.sin(t * 2.6) * r * 0.08;
  const topY = y - r * 0.92;
  ctx.strokeStyle = shade(stage.color);
  ctx.lineWidth = r * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.quadraticCurveTo(ax, topY - r * 0.32, ax, topY - r * 0.5);
  ctx.stroke();
  const beacon = 0.55 + 0.45 * Math.sin(t * 5);
  ctx.save();
  ctx.globalAlpha = beacon;
  ctx.shadowColor = stage.glow;
  ctx.shadowBlur = r * 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ax, topY - r * 0.55, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 새싹 (2단계 이상): 안테나 옆 잎사귀
  if (stage.stage >= 1) {
    ctx.save();
    ctx.fillStyle = "#4ade80";
    ctx.translate(x - r * 0.3, topY - r * 0.05);
    ctx.rotate(-0.6 + Math.sin(t * 2) * 0.1);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.16, r * 0.1, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 별 왕관 (5단계)
  if (stage.stage >= 4) {
    ctx.save();
    ctx.fillStyle = "#fde047";
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = r * 0.4;
    for (let i = -1; i <= 1; i++) {
      drawStarShape(
        ctx,
        x + i * r * 0.42,
        topY - r * 0.1 - (i === 0 ? r * 0.16 : 0),
        r * (i === 0 ? 0.18 : 0.12)
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // 눈
  const look = (p.lookX ?? 0) * r * 0.1;
  const eyeY = y - r * 0.12;
  const blink = mood !== "sleep" && t % 3.9 < 0.13;
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.38;
    if (mood === "hurt") {
      // >< 눈
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = r * 0.08;
      ctx.lineCap = "round";
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.12, eyeY + d * r * 0.12);
        ctx.lineTo(ex + r * 0.12, eyeY - d * r * 0.12);
        ctx.stroke();
      }
      continue;
    }
    if (mood === "sleep" || blink) {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(ex + look, eyeY + r * 0.03, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex + look + r * 0.05, eyeY - r * 0.04, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }

  // 볼터치
  if (mood !== "hurt") {
    ctx.fillStyle = "rgba(251,113,133,0.45)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        x + side * r * 0.62,
        y + r * 0.18,
        r * 0.14,
        r * 0.09,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // 입
  ctx.strokeStyle = "#1e293b";
  ctx.fillStyle = "#334155";
  ctx.lineWidth = r * 0.06;
  ctx.lineCap = "round";
  const mouthY = y + r * 0.3;
  if (mood === "eat") {
    ctx.beginPath();
    ctx.ellipse(x, mouthY, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.ellipse(x, mouthY + r * 0.1, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === "hurt" || mood === "tired") {
    ctx.beginPath();
    ctx.arc(x, mouthY + r * 0.18, r * 0.16, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();
    if (mood === "hurt") {
      ctx.fillStyle = "rgba(125,211,252,0.9)";
      ctx.beginPath();
      ctx.ellipse(
        x + r * 0.55,
        eyeY + r * 0.3 + (t % 1) * r * 0.2,
        r * 0.07,
        r * 0.1,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (mood === "sleep") {
    ctx.beginPath();
    ctx.arc(x, mouthY, r * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `${Math.round(r * 0.4)}px sans-serif`;
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    const zt = (t * 0.6) % 1;
    ctx.globalAlpha = 1 - zt;
    ctx.fillText("z", x + r * 0.9, y - r * 0.9 - zt * r * 0.8);
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(x, mouthY, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  if (stage.stage >= 3) drawRing(true);

  // 코스모 줍스: 궤도를 도는 작은 별 2개
  if (stage.stage >= 4) {
    for (let i = 0; i < 2; i++) {
      const a = t * 1.6 + i * Math.PI;
      const sx = x + Math.cos(a) * r * 1.7;
      const sy = y + Math.sin(a) * r * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#fde047";
      drawStarShape(ctx, sx, sy, r * 0.12);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 70);
  const g = Math.max(0, ((n >> 8) & 255) - 60);
  const b = Math.max(0, (n & 255) - 30);
  return `rgb(${r},${g},${b})`;
}
