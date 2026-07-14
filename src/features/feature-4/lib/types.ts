export type Mood = "happy" | "neutral" | "tired" | "sleeping";

export type DebrisType = {
  id: string;
  name: string;
  /** 처리 난이도 티어. 줍스의 maxTier 이하만 먹을 수 있다 */
  tier: number;
  xp: number;
  /** 게임 내 충돌 반경(px) */
  radius: number;
  /** 스폰 가중치 */
  weight: number;
};

export type StageDef = {
  idx: number;
  name: string;
  minLevel: number;
  /** 처리 가능한 쓰레기 최대 티어 */
  maxTier: number;
  /** 주인 상공 교신 반경(km) — 진화할수록 넓어진다 */
  coverageKm: number;
  /** 줍스 몸통 색상(hue) */
  hue: number;
  desc: string;
};

export type LogEntry = { t: number; icon: string; msg: string };

export type OwnerLoc = { city: string; lat: number; lon: number };

export type OrbitParams = {
  /** 기준 시각(ms) */
  epoch: number;
  periodSec: number;
  incDeg: number;
  /** epoch 시점 궤도면 기준 경도(deg) */
  lon0: number;
  /** epoch 시점 궤도 위상(rad) */
  phase0: number;
};

export type SaveState = {
  version: 1;
  createdAt: number;
  /** 마지막으로 영속 시뮬레이션을 적용한 시각(ms) */
  lastTick: number;
  onboarded: boolean;
  joops: {
    name: string;
    level: number;
    /** 현재 레벨에서 쌓은 XP */
    xp: number;
    hp: number; // 0~100
    satiety: number; // 포만감(에너지) 0~100
    mood: number; // 기분 0~100
    resting: boolean; // 휴식 모드(청소 중단, HP 회복)
  };
  items: { medkit: number; booster: number };
  /** 전지구 교신 부스터 만료 시각(ms). 과거면 비활성 */
  boosterUntil: number;
  /** 자율 청소량의 소수점 잔량(틱 간 이월) */
  cleanCarry: number;
  owner: OwnerLoc;
  orbit: OrbitParams;
  stats: {
    cleaned: number;
    byTier: number[];
    friendsMet: number;
    bestCombo: number;
    playSessions: number;
    xpTotal: number;
  };
  log: LogEntry[];
};

export type OfflineReport = {
  elapsedMs: number;
  cleaned: number;
  xpGained: number;
  friendsMet: number;
  collisions: number;
  /** 부재중에 레벨업했다면 도달 레벨 */
  leveledTo: number | null;
};

export type GameResult = {
  cleaned: number;
  cleanedByTier: number[];
  xp: number;
  friendsMet: number;
  bestCombo: number;
  /** 플레이 중 HP 변화(피격은 음수) */
  hpDelta: number;
  satietyGain: number;
  boostersFound: number;
};
