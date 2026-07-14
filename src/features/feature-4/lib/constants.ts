import type { DebrisType, OwnerLoc, StageDef } from "./types";

/** 진화 단계 — 레벨이 오르면 자동 진화하고, 처리 가능 티어와 교신 반경이 커진다 */
export const STAGES: StageDef[] = [
  {
    idx: 0,
    name: "아기 줍스",
    minLevel: 1,
    maxTier: 1,
    coverageKm: 2200,
    hue: 160,
    desc: "이제 막 배양기에서 나온 아기. 페인트 조각과 작은 나사를 오물오물 먹어요.",
  },
  {
    idx: 1,
    name: "꼬마 줍스",
    minLevel: 5,
    maxTier: 2,
    coverageKm: 2900,
    hue: 195,
    desc: "지느러미가 돋아났어요! 알루미늄 파편까지 소화할 수 있어요.",
  },
  {
    idx: 2,
    name: "청소부 줍스",
    minLevel: 10,
    maxTier: 3,
    coverageKm: 3600,
    hue: 265,
    desc: "정식 청소부 자격 취득! 태양전지판 조각도 문제없어요.",
  },
  {
    idx: 3,
    name: "베테랑 줍스",
    minLevel: 20,
    maxTier: 4,
    coverageKm: 4300,
    hue: 330,
    desc: "관제소가 인정한 베테랑. 연료 탱크를 통째로 꿀꺽!",
  },
  {
    idx: 4,
    name: "코스모 줍스",
    minLevel: 35,
    maxTier: 5,
    coverageKm: 5200,
    hue: 45,
    desc: "전설의 청소 생명체. 폐위성까지 분해 흡수하는 궁극 진화형!",
  },
];

/** 우주쓰레기 도감 — tier가 줍스의 maxTier보다 크면 장애물이 된다 */
export const DEBRIS: DebrisType[] = [
  { id: "paint", name: "페인트 조각", tier: 0, xp: 1, radius: 8, weight: 30 },
  { id: "bolt", name: "볼트·너트", tier: 1, xp: 2, radius: 11, weight: 26 },
  { id: "shard", name: "알루미늄 파편", tier: 2, xp: 4, radius: 15, weight: 20 },
  { id: "panel", name: "태양전지판 조각", tier: 3, xp: 7, radius: 21, weight: 13 },
  { id: "tank", name: "연료 탱크", tier: 4, xp: 12, radius: 27, weight: 8 },
  { id: "derelict", name: "폐위성", tier: 5, xp: 20, radius: 34, weight: 3 },
];

export const stageForLevel = (level: number): StageDef => {
  let s = STAGES[0];
  for (const st of STAGES) if (level >= st.minLevel) s = st;
  return s;
};

/** 다음 레벨까지 필요한 XP */
export const xpNeeded = (level: number) => Math.round(24 * Math.pow(level, 1.3));

// 궤도 파라미터 (ISS 유사 저궤도)
export const ORBIT_ALT_KM = 420;
export const ORBIT_PERIOD_SEC = 5568; // 92분 48초
export const ORBIT_INC_DEG = 51.6;
export const ORBIT_SPEED_KMS = 7.66;
export const EARTH_R_KM = 6371;

/** 전지구 교신 부스터 지속시간 */
export const BOOSTER_DURATION_MS = 60 * 60 * 1000;

/** HP가 이 값 이하면 '지침' 상태 — 청소·비행 불가, 보살핌 필요 */
export const EXHAUSTED_HP = 20;

export const CITIES: OwnerLoc[] = [
  { city: "서울", lat: 37.57, lon: 126.98 },
  { city: "부산", lat: 35.18, lon: 129.08 },
  { city: "제주", lat: 33.5, lon: 126.53 },
  { city: "뉴욕", lat: 40.71, lon: -74.01 },
  { city: "런던", lat: 51.51, lon: -0.13 },
  { city: "시드니", lat: -33.87, lon: 151.21 },
];

/** 떠돌이 줍스(친구) 이름 풀 */
export const FRIEND_NAMES = [
  "몽글",
  "우주",
  "별사탕",
  "코스모",
  "뽀짝",
  "루나",
  "돌돌",
  "반짝",
  "네뷸라",
  "꼬물",
];

/** 차후 확장될 세계관 로드맵 (2-2) */
export const WORLDS = [
  { id: "earth", name: "지구", icon: "🌏", unlockLevel: 1, live: true },
  { id: "mars", name: "화성", icon: "🔴", unlockLevel: 50, live: false },
  { id: "jupiter", name: "목성", icon: "🟠", unlockLevel: 120, live: false },
];
