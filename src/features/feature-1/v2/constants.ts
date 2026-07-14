// 줍줍스2 상수 — v1에서 갈라진 밸런스·연출 튜닝값.
//
// 물리 상수(ORBIT)와 진화 단계(STAGES)·쓰레기 등급(DEBRIS_TIERS)은 v1에서 그대로 재-export 한다.
// STAGES를 공유해야 joopsSprite의 STAGE_REMAPS(단계별 팔레트) 인덱스가 그대로 유효하다.

export {
  ORBIT,
  STAGES,
  DEBRIS_TIERS,
  CARE,
  HOME_PRESETS,
  levelForXp,
  xpForLevel,
  stageForLevel,
  stageIndexForLevel,
  GLOBAL_LINK_MS,
  type StageDef,
  type DebrisDef,
} from "../constants";

/** v1(sjs:feature-1:joops:v1)과 완전히 분리된 저장소 */
export const STORAGE_KEY_V2 = "sjs:feature-1:joops:v2";

/**
 * 히트스톱 — 충격 순간 시뮬레이션을 멈춰 타격감을 만든다 (렌더는 계속).
 * 게임 클록(gt)을 쓰기 때문에 정지 중 스폰 타이머도 함께 멈춘다.
 */
export const HITSTOP_MS = {
  eatSmall: 25, // 1~2등급
  eatMid: 55, // 3~4등급
  eatBig: 90, // 5등급 폐위성
  collide: 110, // 못 먹는 쓰레기와 충돌
  satellite: 140, // 운용 위성 충돌 (가장 강한 임팩트)
} as const;

/** 콤보 체인 — 연속 흡수 시 배수. 콤보가 오를수록 유지 창이 좁아져 긴장감이 생긴다. */
export const COMBO = {
  baseWindowMs: 1900,
  minWindowMs: 850,
  windowDecayPerHit: 70,
  /** 누적 흡수 n회 도달 시 배수와 라벨 */
  steps: [
    { n: 3, mult: 1.25, label: "GOOD" },
    { n: 6, mult: 1.5, label: "NICE" },
    { n: 10, mult: 2, label: "GREAT" },
    { n: 16, mult: 3, label: "KESSLER!" },
  ],
} as const;

export function comboWindowMs(combo: number): number {
  return Math.max(COMBO.minWindowMs, COMBO.baseWindowMs - combo * COMBO.windowDecayPerHit);
}

export function comboMultFor(combo: number): number {
  let mult = 1;
  for (const s of COMBO.steps) if (combo >= s.n) mult = s.mult;
  return mult;
}

export function comboLabelAt(combo: number): string | null {
  for (const s of COMBO.steps) if (combo === s.n) return s.label;
  return null;
}

/**
 * 니어미스 — 위성을 충돌 없이 아슬아슬하게 스치면 보상.
 * "피하기"가 능동적 플레이가 되어 코어 루프가 강화된다.
 */
export const NEAR_MISS = {
  /** 충돌 반경 + 이 값 안으로 스치면 니어미스 */
  marginPx: 26,
  xp: 12,
  slowMoScale: 0.5,
  slowMoMs: 140,
} as const;

/** 진화 시 짧은 슬로모 */
export const EVOLVE_SLOWMO = { scale: 0.25, ms: 700 } as const;

/** 접속 스트릭 보너스 (연속 접속일 → XP 배수) */
export const STREAK = {
  maxMult: 1.5,
  multPerDay: 0.07,
  /** 이 일수마다 글로벌 링크 코어를 즉시 지급 */
  giftEveryDays: 3,
} as const;

export const V2_SETTINGS_DEFAULT = {
  sound: true,
  haptics: true,
  /** "auto"면 기기 성능에 맞춰 자동 결정 */
  quality: "auto" as "auto" | "low" | "med" | "high",
  /** 조작 방식 — coarse(터치)는 상대 드래그가 기본 */
  relativeDrag: true,
};
