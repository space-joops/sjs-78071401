import type { DebrisKind, EvolutionStage } from "./types";

export const SAVE_KEY = "sjs-feature-6-save-v1";

export const MAX_LEVEL = 50;

/** 내 상공(홈 스카이) 부스트 배수 */
export const HOME_BOOST_MULTIPLIER = 5;

/** 전 지구적 상공 효과 지속 시간 (ms) */
export const GLOBAL_BOOST_DURATION_MS = 10 * 60 * 1000;

/** 내 상공 기본 반경(km) — 레벨이 오를수록 확장 */
export const BASE_HOME_RADIUS_KM = 500;
export const HOME_RADIUS_PER_LEVEL_KM = 80;

/** 오프라인(방치) 진행: 분당 청소량 = BASE + 레벨 × PER_LEVEL, 최대 24시간 적립 */
export const OFFLINE_BASE_PER_MIN = 0.4;
export const OFFLINE_PER_LEVEL_PER_MIN = 0.12;
export const OFFLINE_EXP_PER_DEBRIS = 2;
export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_REPORT_MIN_MS = 5 * 60 * 1000;

/** 궤도 파라미터 — 게임 템포를 위해 실제보다 빠른 주기를 사용 */
export const ORBIT_PERIOD_MS = 8 * 60 * 1000; // 한 바퀴 8분
export const ORBIT_INCLINATION_DEG = 52;
/** 한 바퀴마다 지면 궤적이 서쪽으로 밀리는 양(도) — 지구 자전 효과 */
export const ORBIT_WESTWARD_DRIFT_DEG = 47;
/** 궤도 위상 기준 시각 (2026-01-01T00:00:00Z) */
export const ORBIT_EPOCH_MS = 1767225600000;

export const EVOLUTION_STAGES: EvolutionStage[] = [
  {
    minLevel: 1,
    name: "알줍스",
    emoji: "🫧",
    maxDebrisSize: 1,
    bodyColor: "#7dd3fc",
    glowColor: "rgba(125, 211, 252, 0.5)",
    radius: 20,
  },
  {
    minLevel: 4,
    name: "꼬마줍스",
    emoji: "🐣",
    maxDebrisSize: 2,
    bodyColor: "#6ee7b7",
    glowColor: "rgba(110, 231, 183, 0.5)",
    radius: 24,
  },
  {
    minLevel: 8,
    name: "청소부 줍스",
    emoji: "🛸",
    maxDebrisSize: 3,
    bodyColor: "#c4b5fd",
    glowColor: "rgba(196, 181, 253, 0.55)",
    radius: 28,
  },
  {
    minLevel: 14,
    name: "수호자 줍스",
    emoji: "🌟",
    maxDebrisSize: 3,
    bodyColor: "#fcd34d",
    glowColor: "rgba(252, 211, 77, 0.55)",
    radius: 32,
  },
  {
    minLevel: 20,
    name: "오디세이 줍스",
    emoji: "🌌",
    maxDebrisSize: 3,
    bodyColor: "#f9a8d4",
    glowColor: "rgba(249, 168, 212, 0.6)",
    radius: 36,
  },
];

export const DEBRIS_KINDS: DebrisKind[] = [
  {
    id: "small",
    label: "미세 파편",
    size: 1,
    exp: 5,
    damage: 4,
    color: "#94a3b8",
    r: 9,
  },
  {
    id: "medium",
    label: "태양광 패널 조각",
    size: 2,
    exp: 12,
    damage: 12,
    color: "#60a5fa",
    r: 15,
  },
  {
    id: "large",
    label: "로켓 부스터 잔해",
    size: 3,
    exp: 30,
    damage: 24,
    color: "#f97316",
    r: 24,
  },
  {
    id: "satellite",
    label: "폐기 인공위성",
    size: 4,
    exp: 0,
    damage: 40,
    color: "#e2e8f0",
    r: 30,
  },
];

export const GREET_EXP = 25;

export const NPC_NAMES = [
  "별줍이",
  "우주먼지",
  "샛별호",
  "클리너",
  "반짝이",
  "궤도토끼",
  "코스모",
  "은하수",
];

export const NPC_GREETINGS = [
  "안녕! 오늘도 청소 중이야~ ✨",
  "이 근처 파편 조심해!",
  "우주에서 만나다니 반가워!",
  "같이 지구를 지키자! 💪",
  "방금 위성 잔해 하나 먹었어, 맛있더라 😋",
  "네 궤도 진짜 멋지다!",
  "다음에 내 상공에도 놀러 와~",
];

/** 쓰레기 처리 시 아이템 드랍 확률 */
export const DROP_CHANCE = 0.05;
export const DROP_GLOBAL_BOOST_RATIO = 0.3;

/** 보살핌 관련 */
export const CARE_DEBRIS_COUNT = 6;
export const CARE_ENERGY_HOLD_MS = 2500;
export const CARE_CORE_TAPS = 15;
export const CARE_RUB_DISTANCE_PX = 1600;
export const CARE_RECOVER_HP_RATIO = 0.6;
