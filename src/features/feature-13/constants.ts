// 줍스 딥오비트 — 게임 밸런스와 씬 튜닝값.

export const STORAGE_KEY = "sjs:feature-13:deeporbit:v1";

/** 씬 좌표계 — 카메라는 -Z를 바라보고, 쓰레기는 -Z에서 +Z(카메라 쪽)로 다가온다. */
export const SCENE = {
  fov: 62,
  near: 0.1,
  far: 3000,
  /** 카메라 위치 (줍스를 살짝 내려다보는 추격 시점) */
  camPos: [0, 2.2, 9.5] as const,
  camLookAt: [0, 0, -25] as const,
  /** 줍스가 놓이는 평면 */
  playZ: 0,
  /** 쓰레기 스폰 깊이 */
  spawnZ: -300,
  /** 카메라를 지나쳐 이 z를 넘으면 회수 */
  despawnZ: 16,
  /** 원근 안개 — 쓰레기가 어둠에서 서서히 나타난다 (지구·별은 fog:false로 제외) */
  fogColor: 0x050a16,
  fogNear: 90,
  fogFar: 300,
} as const;

export const EARTH = {
  radius: 600,
  /** 중심 y — 지구가 아래에 깔리고 수평선이 화면 하단에 걸린다 */
  centerY: -638,
  centerZ: -120,
  /**
   * 궤도 각속도 (rad/s, 월드 X축 기준 +방향).
   * v = ω × r 에서 표면 속도가 +Z(카메라 쪽)가 되어 쓰레기와 같은 방향으로 흐른다.
   */
  orbitRate: 0.016,
  /** 축 기울기 — 극 위를 지나지 않는 궤도 + 보기 좋은 각도 */
  tiltZ: -0.42,
  /** 지구 자체 자전 (동서 방향) */
  spinRate: 0.006,
  cloudSpinRate: 0.0075,
} as const;

export type DebrisDef = {
  tier: number;
  name: string;
  /** 3D 반지름 (충돌·스케일 기준) */
  radius: number;
  xp: number;
  weight: number;
  color: number;
};

export const DEBRIS_TIERS: DebrisDef[] = [
  { tier: 1, name: "페인트 조각", radius: 0.45, xp: 4, weight: 34, color: 0xc8d4e0 },
  { tier: 2, name: "볼트·너트", radius: 0.7, xp: 8, weight: 27, color: 0xaab8ca },
  { tier: 3, name: "패널 파편", radius: 1.05, xp: 16, weight: 20, color: 0x4a7fc0 },
  { tier: 4, name: "로켓 잔해", radius: 1.5, xp: 30, weight: 12, color: 0xcfc0a2 },
  { tier: 5, name: "폐위성", radius: 2.1, xp: 60, weight: 7, color: 0x9aa8bc },
];

export type StageDef = {
  minLevel: number;
  name: string;
  /** 흡수 가능한 최대 등급 */
  maxTier: number;
  /** 줍스 몸통 반지름 */
  size: number;
  color: number;
};

export const STAGES: StageDef[] = [
  { minLevel: 1, name: "유생 줍스", maxTier: 1, size: 0.62, color: 0x7de8d8 },
  { minLevel: 3, name: "새싹 줍스", maxTier: 2, size: 0.72, color: 0x7ee87f },
  { minLevel: 6, name: "청소부 줍스", maxTier: 3, size: 0.84, color: 0x7fb7ff },
  { minLevel: 10, name: "수호자 줍스", maxTier: 4, size: 0.96, color: 0xc39bff },
  { minLevel: 15, name: "별빛 줍스", maxTier: 5, size: 1.1, color: 0xffd97a },
];

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 24)) + 1;
}

export function xpForLevel(level: number): number {
  return 24 * (level - 1) * (level - 1);
}

export function stageForLevel(level: number): StageDef {
  let stage = STAGES[0];
  for (const s of STAGES) if (level >= s.minLevel) stage = s;
  return stage;
}

export const RUN = {
  /** 시작 접근 속도 (u/s) — spawnZ에서 약 4.3초 */
  baseSpeed: 70,
  speedPerLevel: 6,
  maxSpeed: 150,
  /** 스폰 간격 (ms) */
  spawnMinMs: 260,
  spawnMaxMs: 620,
  lives: 3,
  invulnMs: 1400,
  /** 콤보 유지 시간 */
  comboWindowMs: 2600,
  maxCombo: 5,
} as const;

export function comboMultFor(combo: number): number {
  return Math.min(RUN.maxCombo, 1 + Math.floor(combo / 4));
}
