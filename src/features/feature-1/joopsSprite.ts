// 줍스 스프라이트 — 16비트 픽셀 렌더러.
// 팩맨처럼 입을 벌리고 나는 JOOPS_OPEN/CHOMP 프레임을 기본으로,
// 기분(표정)·추진 불꽃·진화 팔레트 스왑을 조합해 그린다.
// 플레이 화면, 관제 지도 마커, 돌보기 초상화가 모두 이 함수를 공유한다.
//
// [작업 1(줍스 오비탈) 적용 규칙]
// - 진화 단계 = 팔레트 스왑(STAGE_REMAPS) + 몸집(r) 확대
// - 이동 중에는 open↔chomp를 교차해 "냠냠" 비행
// - 먹는 순간은 opts.chomp(강제 깨물기)로 꿀꺽 연출

import { STAGES } from "./constants";
import {
  drawSprite,
  FLAME_FRAMES,
  JOOPS_CHOMP,
  JOOPS_HURT,
  JOOPS_IDLE,
  JOOPS_OPEN,
  JOOPS_TIRED,
  type PaletteRemap,
  type PixelGrid,
} from "./pixel/sprites";

export type JoopsMood = "happy" | "tired" | "hurt" | "sleep";

export type JoopsDrawOpts = {
  mood?: JoopsMood;
  /** 시선·기울기 방향 (-1~1). 음수면 왼쪽을 보도록 좌우 반전 */
  dirX?: number;
  dirY?: number;
  /** 추진 중이면 꼬리 불꽃 + 냠냠 비행 */
  thrust?: boolean;
  /** 먹는 순간 강제 깨물기 프레임 */
  chomp?: boolean;
  alpha?: number;
  /** 떠돌이(친구) 줍스 배색 */
  variant?: "own" | "friend";
};

/** 진화 단계별 팔레트 스왑 — 인덱스 2(그림자)/3(기본)/4(하이라이트) 교체 */
export const STAGE_REMAPS: PaletteRemap[] = STAGES.map((s) => ({
  2: darken(s.bodyColor, 0.38),
  3: s.bodyColor,
  4: lighten(s.bodyColor, 0.5),
}));

export const FRIEND_REMAP: PaletteRemap = {
  2: darken("#ffa8cf", 0.38),
  3: "#ffa8cf",
  4: lighten("#ffa8cf", 0.5),
};

export function drawJoops(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stageIndex: number,
  tMs: number,
  opts: JoopsDrawOpts = {},
): void {
  const idx = Math.max(0, Math.min(STAGES.length - 1, stageIndex));
  const remap = opts.variant === "friend" ? FRIEND_REMAP : STAGE_REMAPS[idx];
  const mood = opts.mood ?? "happy";
  const scale = Math.max(0.5, (r * 2.3) / 16);
  const facingLeft = (opts.dirX ?? 0) < -0.05;

  let grid: PixelGrid;
  if (mood === "hurt") grid = JOOPS_HURT;
  else if (mood === "sleep" || mood === "tired") grid = JOOPS_TIRED;
  else if (opts.chomp) grid = JOOPS_CHOMP;
  else if (opts.thrust) grid = Math.floor(tMs / 170) % 2 === 0 ? JOOPS_OPEN : JOOPS_CHOMP;
  else grid = JOOPS_IDLE;

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(x, y + Math.sin(tMs / 320) * scale * 0.6);
  if (facingLeft) ctx.scale(-1, 1);

  // 꼬리 불꽃 (몸 뒤)
  if (opts.thrust && mood !== "hurt" && mood !== "sleep") {
    const flame = FLAME_FRAMES[Math.floor(tMs / 110) % 2];
    drawSprite(ctx, flame, -17 * scale, -8 * scale, scale);
  }

  drawSprite(ctx, grid, -8 * scale, -8 * scale, scale, remap);

  // 상위 단계는 반짝이 픽셀이 궤도처럼 돈다
  if (idx >= 3 && mood === "happy") {
    const px = Math.max(1.5, scale * 1.2);
    for (let k = 0; k < 2; k++) {
      const a = tMs / 480 + k * Math.PI;
      ctx.fillStyle = k === 0 ? "#ffffff" : "#9ff4ff";
      ctx.fillRect(Math.cos(a) * r * 1.35 - px / 2, Math.sin(a) * r * 0.85 - px / 2, px, px);
    }
  }

  // 잠들었을 때 zzz
  if (mood === "sleep") {
    ctx.font = `700 ${Math.max(9, r * 0.42)}px var(--font-geist-mono), monospace`;
    ctx.fillStyle = hexA("#bcd7ff", 0.5 + 0.4 * Math.sin(tMs / 600));
    ctx.fillText("z", r * 0.95, -r * 1.15);
    ctx.fillStyle = hexA("#bcd7ff", 0.5 + 0.4 * Math.sin(tMs / 600 + 1.2));
    ctx.fillText("z", r * 1.3, -r * 1.5);
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
