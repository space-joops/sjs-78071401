// 줍스 게임 밸런스 정의: 진화 단계, 쓰레기 등급, 경험치 곡선, 교신 범위

export type EvolutionStage = {
  stage: number; // 0-based
  minLevel: number;
  name: string;
  color: string;
  glow: string;
  desc: string;
};

export const STAGES: EvolutionStage[] = [
  {
    stage: 0,
    minLevel: 1,
    name: "줍스 유생",
    color: "#7dd3fc",
    glow: "#38bdf8",
    desc: "연구소에서 갓 태어난 아기 줍스. 페인트 조각 같은 미세 쓰레기만 소화할 수 있어요.",
  },
  {
    stage: 1,
    minLevel: 3,
    name: "새싹 줍스",
    color: "#6ee7b7",
    glow: "#34d399",
    desc: "머리에 새싹 안테나가 돋았어요. 나사·볼트급 쓰레기를 씹어 먹습니다.",
  },
  {
    stage: 2,
    minLevel: 6,
    name: "오로라 줍스",
    color: "#c4b5fd",
    glow: "#a78bfa",
    desc: "몸에서 오로라 리본이 흘러나와요. 금속 파편도 거뜬히 소화합니다.",
  },
  {
    stage: 3,
    minLevel: 10,
    name: "네뷸라 줍스",
    color: "#f9a8d4",
    glow: "#f472b6",
    desc: "성운 고리를 둘렀어요. 로켓 파편급 대형 쓰레기를 처리합니다.",
  },
  {
    stage: 4,
    minLevel: 15,
    name: "코스모 줍스",
    color: "#fcd34d",
    glow: "#fbbf24",
    desc: "별의 왕관을 쓴 최종 진화체. 폐위성 모듈까지 통째로 재활용합니다.",
  },
];

export type DebrisTier = {
  tier: number; // 1..5
  name: string;
  sizeLabel: string;
  massKg: number;
  xp: number;
  radius: number; // 화면 표시 반지름(px)
  color: string;
};

export const DEBRIS_TIERS: DebrisTier[] = [
  { tier: 1, name: "페인트 조각", sizeLabel: "1cm 미만", massKg: 0.002, xp: 5, radius: 5, color: "#94a3b8" },
  { tier: 2, name: "나사·볼트", sizeLabel: "1–5cm", massKg: 0.03, xp: 12, radius: 8, color: "#cbd5e1" },
  { tier: 3, name: "금속 파편", sizeLabel: "5–30cm", massKg: 0.9, xp: 28, radius: 12, color: "#a8a29e" },
  { tier: 4, name: "로켓 파편", sizeLabel: "30cm–1m", massKg: 16, xp: 65, radius: 17, color: "#fda4af" },
  { tier: 5, name: "폐위성 모듈", sizeLabel: "1m 이상", massKg: 140, xp: 150, radius: 23, color: "#fbbf24" },
];

export function stageForLevel(level: number): EvolutionStage {
  let cur = STAGES[0];
  for (const s of STAGES) if (level >= s.minLevel) cur = s;
  return cur;
}

/** 이 레벨에서 소화 가능한 최대 쓰레기 등급 */
export function maxTierForLevel(level: number): number {
  return stageForLevel(level).stage + 1;
}

const MAX_LEVEL = 60;

/** level → 다음 레벨까지 필요한 경험치 */
export function xpToNext(level: number): number {
  return Math.round(80 * Math.pow(level, 1.5) / 10) * 10;
}

/** level 도달에 필요한 누적 경험치 (level 1 = 0) */
export function xpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  let acc = 0;
  while (level < MAX_LEVEL && acc + xpToNext(level) <= xp) {
    acc += xpToNext(level);
    level++;
  }
  return level;
}

/** 주인 상공 교신 반경(km) — 진화·레벨에 따라 확장 (요구사항 10) */
export function coverageRadiusKm(level: number): number {
  return Math.min(2600, 400 + (level - 1) * 120);
}

export const QUANTUM_LINK_MINUTES = 15; // 퀀텀 링크(전 지구 교신) 지속 시간

/** 오프라인/자동 청소용 기대값: 시간당 청소 개수, 개당 평균 경험치·질량 */
export function idleRates(level: number): {
  piecesPerHour: number;
  xpPerPiece: number;
  massPerPiece: number;
} {
  const maxTier = maxTierForLevel(level);
  const weights = [50, 30, 12, 6, 2].slice(0, maxTier);
  const total = weights.reduce((a, b) => a + b, 0);
  let xp = 0;
  let mass = 0;
  weights.forEach((w, i) => {
    xp += (w / total) * DEBRIS_TIERS[i].xp;
    mass += (w / total) * DEBRIS_TIERS[i].massKg;
  });
  return { piecesPerHour: 6 + level * 2, xpPerPiece: xp, massPerPiece: mass };
}
