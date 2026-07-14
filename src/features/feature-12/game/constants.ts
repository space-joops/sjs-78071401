export const SCENE = {
  title: "f12-title",
  game: "f12-game",
  over: "f12-over",
} as const;

export const TEX_DOT = "f12-dot";
export const STORAGE_KEY = "sjs-f12-best";

export const FONT = "'Pretendard', 'Segoe UI', system-ui, -apple-system, sans-serif";

export const DEPTH = {
  stars: 0,
  junk: 2,
  powerup: 3,
  hazard: 4,
  ship: 5,
  fx: 6,
  hud: 10,
} as const;

// 조작감 튜닝 값
export const THRUST = 700;
export const MAX_SPEED = 380;
export const SHIP_DRAG = 0.55;

// 진행 규칙
export const COMBO_WINDOW_MS = 2500;
export const MAX_COMBO = 5;
export const LEVEL_EVERY = 12;
export const MAX_LEVEL = 9;
export const START_LIVES = 3;
export const INVULN_MS = 2000;

export const MAGNET_MS = 6000;
export const MAGNET_RANGE = 260;
export const POWERUP_EVERY_MS = 11000;
export const POWERUP_TTL_MS = 9000;

export const JUNK_EMOJI = ["🥫", "🔩", "📡", "🧃", "🧊", "📦", "🪫", "🗑️"];

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // 사파리 프라이빗 모드 등 저장 불가 환경은 조용히 무시
  }
}
