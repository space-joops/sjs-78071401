export type GeoPoint = {
  lat: number;
  lng: number;
};

export type CarePhase = "debris" | "energy" | "soothe";

export type JoopsState = {
  name: string;
  exp: number;
  hp: number;
  stress: number; // 0~100
  debrisCleaned: number;
  greetCount: number;
};

export type SaveData = {
  version: 1;
  createdAt: number;
  lastSeenAt: number;
  joops: JoopsState;
  /** null이면 정상. 값이 있으면 기능 정지 상태로, 해당 보살핌 단계부터 진행해야 함 */
  care: CarePhase | null;
  home: GeoPoint | null;
  items: {
    capsules: number; // 응급 에너지 캡슐
    globalBoost: number; // 전 지구적 상공 효과 아이템
  };
  /** 전 지구적 상공 효과 만료 시각 (timestamp, ms) */
  boostUntil: number;
};

export type OfflineReport = {
  elapsedMs: number;
  debrisCleaned: number;
  expGained: number;
};

export type EvolutionStage = {
  minLevel: number;
  name: string;
  emoji: string;
  /** 처리 가능한 쓰레기 최대 크기 (1: 소형, 2: 중형, 3: 대형) */
  maxDebrisSize: number;
  /** 캔버스 렌더링용 몸통 색 */
  bodyColor: string;
  glowColor: string;
  /** 비행 모드에서의 몸통 반지름(px) */
  radius: number;
};

export type DebrisKind = {
  id: "small" | "medium" | "large" | "satellite";
  label: string;
  size: number; // 1~4, 4(인공위성)는 파괴 불가
  exp: number;
  damage: number; // 처리 불가 상태로 충돌 시 피해
  color: string;
  r: number; // 렌더 반지름(px)
};

export type WorldCountry = {
  n: string; // 영문 국가명
  b: [number, number, number, number]; // bbox [minLng, minLat, maxLng, maxLat]
  r: [number, number][][]; // rings: [lng, lat][]
};

export type WorldData = {
  countries: WorldCountry[];
};
