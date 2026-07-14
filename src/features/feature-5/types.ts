export type DebrisTypeId =
  | "paint"
  | "bolt"
  | "shard"
  | "fairing"
  | "antenna"
  | "satcore";

export type DebrisType = {
  id: DebrisTypeId;
  label: string;
  massKg: number;
  /** 스폰 가중치 — 클수록 흔함 */
  weight: number;
  /** 캔버스 기준 반지름(px) */
  radius: number;
};

export type EvolutionStage = {
  name: string;
  emoji: string;
  /** 이 단계에 도달하는 누적 수거량 */
  threshold: number;
  /** 방치 중 분당 수거량 */
  ratePerMin: number;
  desc: string;
};

export type PetState = {
  name: string;
  /** 펫 고유 색상(hue, 0~359) */
  hue: number;
  bornAt: number;
  lastSeenAt: number;
  totalEaten: number;
  totalKg: number;
  todayEaten: number;
  /** 오늘 카운트 리셋용 로컬 날짜 키(YYYY-MM-DD) */
  todayKey: string;
};

export type Pilot = {
  id: string;
  petName: string;
  /** "이름 · 도시" */
  owner: string;
  countryFlag: string;
  countryName: string;
  launchSite: string;
  /** YYYY-MM-DD */
  launchDate: string;
  totalEaten: number;
  totalKg: number;
  altitudeKm: number;
  hue: number;
  /** 전일 대비 순위 변동 (+는 상승) */
  delta: number;
  bio: string;
};

export type PilotLogEntry = {
  agoLabel: string;
  text: string;
  detail?: string;
};

export type PilotEvolutionEntry = {
  stageIndex: number;
  dateLabel: string;
};
