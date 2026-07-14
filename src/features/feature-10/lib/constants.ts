// 점프 러너 튜닝 상수 — 논리 px, 375×667 세로 화면 기준.

/** 중력 가속도 (px/s²) */
export const GRAVITY = 2600;
/** 점프 초기 속도 (px/s) — 최대 점프고 ≈ 920²/(2·2600) ≈ 163px */
export const JUMP_FORCE = 920;
/** 착지 직전 입력을 살려주는 선입력 버퍼 (s) */
export const JUMP_BUFFER = 0.12;
/** 지면을 벗어난 직후에도 점프를 허용하는 코요테 타임 (s) */
export const COYOTE = 0.08;

/** 시작 스크롤 속도 (px/s) */
export const BASE_SPEED = 320;
/** 속도 램프 (px/s²) — speed = min(MAX_SPEED, BASE_SPEED + RAMP·t) */
export const RAMP = 8;
/** 최고 속도 (px/s) — 이 속도에서 점프 비거리 ≈ 481px > GAP_DIST_MIN */
export const MAX_SPEED = 680;

/** 지면 높이 (px) */
export const GROUND_H = 72;
/** 줍스 고정 x 좌표 */
export const PLAYER_X = 72;
/** 줍스 시각 반지름 */
export const PLAYER_R = 22;
/** 히트박스 — 시각보다 작게 잡아 억울한 죽음 방지 */
export const HIT_W = 30;
export const HIT_H = 36;

/** 장애물 간 최소/최대 간격 — 시간이 아닌 "거리(px)" 기준이라 속도가 붙어도 공정 */
export const GAP_DIST_MIN = 400;
export const GAP_DIST_MAX = 820;

/** 별 조각 스폰 주기 (s) / 개당 점수 */
export const STAR_EVERY = 3.2;
export const STAR_SCORE = 5;

/** 우주쓰레기 장애물 3종 (w×h, RGB) */
export const OBSTACLES: { w: number; h: number; color: [number, number, number] }[] = [
  { w: 26, h: 38, color: [200, 205, 216] }, // 소형 파편
  { w: 30, h: 58, color: [255, 179, 199] }, // 대형 파편
  { w: 54, h: 30, color: [160, 168, 190] }, // 낮고 긴 잔해
];

export type GameStats = {
  score: number;
  stars: number;
  time: number;
};

export type GameHooks = {
  onScore: (score: number) => void;
  onGameOver: (stats: GameStats) => void;
};
