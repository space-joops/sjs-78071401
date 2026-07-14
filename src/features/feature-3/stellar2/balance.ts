// 스텔라펫2 밸런스 상수 단일 파일 — 모든 수치 조정은 여기서 한다.
// (배고픔 감소·성장 필요치·이벤트 확률 등, 개선 지시서 요구)

export const ORBIT = {
  periodSec: 5580, // 93분 (LEO)
  inclinationDeg: 51.6,
  altitudeKm: 420,
  groundSpeedKms: 7.2,
} as const;

export type StageDef = {
  minLevel: number;
  name: string;
  /** 흡수 가능한 쓰레기 최대 등급 (1~5) */
  maxTier: number;
  /** 주인 상공 교신 반경 (km) */
  rangeKm: number;
  /** 아케이드에서의 몸통 반지름 (px) */
  size: number;
  bodyColor: string;
  glowColor: string;
};

export const STAGES: StageDef[] = [
  {
    minLevel: 1,
    name: "유생 줍스",
    maxTier: 2,
    rangeKm: 3000,
    size: 24,
    bodyColor: "#7de8d8",
    glowColor: "#4dd0c0",
  },
  {
    minLevel: 5,
    name: "새싹 줍스",
    maxTier: 3,
    rangeKm: 4500,
    size: 28,
    bodyColor: "#7ee87f",
    glowColor: "#4ed06a",
  },
  {
    minLevel: 10,
    name: "청소부 줍스",
    maxTier: 4,
    rangeKm: 6000,
    size: 33,
    bodyColor: "#7fb7ff",
    glowColor: "#4d8fe8",
  },
  {
    minLevel: 15,
    name: "수호자 줍스",
    maxTier: 5,
    rangeKm: 8500,
    size: 38,
    bodyColor: "#c39bff",
    glowColor: "#9b6cf0",
  },
  {
    minLevel: 20,
    name: "별빛 줍스",
    maxTier: 5,
    rangeKm: 12000,
    size: 43,
    bodyColor: "#ffd97a",
    glowColor: "#ffb54d",
  },
];

export type DebrisDef = {
  tier: number;
  name: string;
  radius: number;
  xp: number;
  energy: number;
  /** 스폰 가중치 */
  weight: number;
};

export const DEBRIS_TIERS: DebrisDef[] = [
  { tier: 1, name: "페인트 조각", radius: 5, xp: 4, energy: 2, weight: 38 },
  { tier: 2, name: "볼트·너트", radius: 9, xp: 8, energy: 4, weight: 28 },
  { tier: 3, name: "패널 파편", radius: 15, xp: 16, energy: 7, weight: 19 },
  { tier: 4, name: "로켓 잔해", radius: 23, xp: 30, energy: 11, weight: 10 },
  { tier: 5, name: "폐위성", radius: 32, xp: 60, energy: 16, weight: 5 },
];

/** 누적 XP → 레벨 */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 35)) + 1;
}

/** 해당 레벨 도달에 필요한 누적 XP */
export function xpForLevel(level: number): number {
  return 35 * (level - 1) * (level - 1);
}

export function stageForLevel(level: number): StageDef {
  let stage = STAGES[0];
  for (const s of STAGES) if (level >= s.minLevel) stage = s;
  return stage;
}

export function stageIndexForLevel(level: number): number {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (level >= STAGES[i].minLevel) idx = i;
  return idx;
}

/** 글로벌 링크 아이템 지속 시간 (ms) */
export const GLOBAL_LINK_MS = 10 * 60 * 1000;

export const CARE = {
  feed: { energy: 30, xp: 6, cooldownMs: 60_000, label: "먹이 주기" },
  repair: { health: 25, xp: 6, cooldownMs: 120_000, label: "수리하기" },
  pet: { mood: 22, xp: 4, cooldownMs: 30_000, label: "쓰다듬기" },
} as const;

export const HOME_PRESETS: { label: string; lat: number; lon: number }[] = [
  { label: "서울", lat: 37.57, lon: 126.98 },
  { label: "부산", lat: 35.18, lon: 129.08 },
  { label: "제주", lat: 33.5, lon: 126.53 },
  { label: "도쿄", lat: 35.68, lon: 139.69 },
  { label: "싱가포르", lat: 1.35, lon: 103.82 },
  { label: "파리", lat: 48.86, lon: 2.35 },
  { label: "런던", lat: 51.51, lon: -0.13 },
  { label: "뉴욕", lat: 40.71, lon: -74.01 },
  { label: "시드니", lat: -33.87, lon: 151.21 },
];

export const STORAGE_KEY = "sjs:feature-3:stellar2:v1";
