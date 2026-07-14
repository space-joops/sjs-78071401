// 줍스 스웜 튜닝 상수 — 게임 밸런스는 전부 이 파일에서 조정한다.

/** 한 판 길이(초). 피격 페널티로 줄어들 수 있다. */
export const RUSH_SECONDS = 75;
/** 위험 파편 피격 시 잃는 시간(초) */
export const HIT_TIME_PENALTY = 6;
/** 피격 후 무적 시간(초) */
export const HIT_INVULN_SECONDS = 1.2;

/** 콤보 유지창(초) — 이 안에 다음 수거가 없으면 콤보가 끊긴다 */
export const COMBO_WINDOW = 1.2;
/** 점수 배율에 반영되는 콤보 상한 */
export const COMBO_SCORE_CAP = 20;
/** 콤보 1당 점수 배율 증가량 */
export const COMBO_SCORE_STEP = 0.05;
/** 콤보 마일스톤(사운드/연출) 간격 */
export const COMBO_MILESTONE = 8;

export const GAUGE_MAX = 100;
/** 수거 1회당 기본 게이지 */
export const GAUGE_PER_COLLECT = 4;
/** 콤보 1당 추가 게이지 */
export const GAUGE_COMBO_BONUS = 0.2;
/** 피격 시 게이지 보존 비율 */
export const GAUGE_HIT_KEEP = 0.5;

export const FEVER_SECONDS = 6;
export const FEVER_RADIUS_MULT = 1.8;
export const FEVER_FORCE_MULT = 1.6;
export const FEVER_SCORE_MULT = 2;
/** 피버 중 위험 파편 수거 보너스 점수 */
export const FEVER_HAZARD_BONUS = 5;

/** 펫 몸통 충돌 반경(px, 논리 좌표) */
export const PET_BODY_RADIUS = 24;
/** 기본 자석 흡입 반경(px) */
export const BASE_MAGNET_RADIUS = 90;
/** 진화 단계당 흡입 반경 보너스(px) */
export const STAGE_MAGNET_BONUS = 5;
/** 흡입 가속 크기(px/s²) — 반경 중심으로 갈수록 선형 증가 */
export const MAGNET_FORCE = 900;
/** 파편 속도 상한(px/s) — 슬링샷 폭주 방지 */
export const DEBRIS_MAX_SPEED = 420;

/** 파편 풀 크기(일반+위험 합산). ParticleContainer 슬롯 수와 같다 */
export const MAX_DEBRIS = 720;
export const MAX_SPARKS = 360;
export const MAX_RINGS = 8;
export const TRAIL_LENGTH = 14;
export const STAR_COUNT = 130;
/** 프레임당 최대 스폰 수 — 웨이브 전환 시 스폰 부하 분산 */
export const SPAWNS_PER_FRAME = 6;

/** 누적 수거량 기준 진화 임계값 (단계 0~3) */
export const EVOLUTION_THRESHOLDS = [0, 400, 1500, 4000] as const;
export const EVOLUTION_NAMES = [
  "아기 줍스",
  "청년 줍스",
  "베테랑 줍스",
  "전설의 줍스",
] as const;
export const EVOLUTION_ICONS = ["🫧", "🌱", "⚡", "👑"] as const;

export type WaveDef = {
  /** 시작 시각(경과 초) */
  at: number;
  /** 목표 파편 밀도(개) */
  target: number;
  /** 드리프트 속도 배율 */
  speed: number;
  /** 위험 파편 스폰 비율 */
  hazardRatio: number;
};

export const WAVES: WaveDef[] = [
  { at: 0, target: 120, speed: 1.0, hazardRatio: 0.05 },
  { at: 15, target: 220, speed: 1.12, hazardRatio: 0.08 },
  { at: 30, target: 320, speed: 1.25, hazardRatio: 0.11 },
  { at: 45, target: 420, speed: 1.4, hazardRatio: 0.14 },
  { at: 60, target: 520, speed: 1.55, hazardRatio: 0.17 },
];

export type DebrisDef = {
  /** 기본 점수 */
  score: number;
  /** 충돌 반경(px) */
  radius: number;
  /** 스폰 가중치 */
  weight: number;
};

/** typeId 0~4 = 일반 파편(볼트/패널/태양전지/페어링/위성 코어) */
export const DEBRIS_TYPES: DebrisDef[] = [
  { score: 1, radius: 7, weight: 34 },
  { score: 1, radius: 8, weight: 26 },
  { score: 2, radius: 10, weight: 20 },
  { score: 2, radius: 11, weight: 12 },
  { score: 3, radius: 13, weight: 8 },
];
export const HAZARD_TYPE_ID = 5;
export const HAZARD_RADIUS = 14;

/** 대기(시작 전/게임오버 후) 화면의 유영 파편 수 */
export const IDLE_DEBRIS_TARGET = 90;

export type HudSnapshot = {
  score: number;
  timeLeft: number;
  combo: number;
  /** 0~100 */
  gauge: number;
  fever: boolean;
  /** 1부터 시작하는 웨이브 번호 */
  wave: number;
  collected: number;
};

export type RunStats = {
  score: number;
  collected: number;
  bestCombo: number;
  feverCount: number;
};

/** 게임 → React 콜백. onHud만 스로틀(약 8Hz), 나머지는 즉시 호출된다 */
export type GameHooks = {
  onHud: (s: HudSnapshot) => void;
  onWave: (wave: number) => void;
  onFever: (on: boolean) => void;
  onHit: () => void;
  onGameOver: (stats: RunStats) => void;
};
