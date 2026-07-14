import type { DebrisType, EvolutionStage } from "./types";

/** 케슬러 캐스케이드 발생일 — 세계관의 기준점 */
export const KESSLER_DATE = "2025-11-07";

/** 데모 랭킹 데이터 기준 시각 (하이드레이션 안전을 위해 고정) */
export const DATA_AS_OF = "2026-07-14";

/** 방치 수거 인정 상한 — 7일 */
export const OFFLINE_CAP_MS = 7 * 24 * 60 * 60 * 1000;

/** 이 시간 이상 자리를 비우면 복귀 리포트를 보여줌 */
export const OFFLINE_MIN_MS = 90 * 1000;

/** 방치 수거 파편의 평균 질량(kg) — 대부분 소형 파편 */
export const OFFLINE_AVG_KG = 0.35;

export const EVOLUTION_STAGES: EvolutionStage[] = [
  {
    name: "스타더스트 알",
    emoji: "🥚",
    threshold: 0,
    ratePerMin: 0.25,
    desc: "별먼지가 뭉쳐 깨어나길 기다리는 알. 굴러다니며 작은 파편을 흡수한다.",
  },
  {
    name: "코스모 해츨링",
    emoji: "🐣",
    threshold: 20,
    ratePerMin: 0.6,
    desc: "막 껍질을 깬 아기 펫. 페인트 조각이 주식이다.",
  },
  {
    name: "오비탈 퍼피",
    emoji: "✨",
    threshold: 80,
    ratePerMin: 1.1,
    desc: "궤도를 강아지처럼 뛰노는 시기. 볼트를 간식처럼 오독오독.",
  },
  {
    name: "데브리 헌터",
    emoji: "🛰️",
    threshold: 250,
    ratePerMin: 1.8,
    desc: "파편 궤적을 읽기 시작한 어엿한 청소부.",
  },
  {
    name: "네뷸라 가디언",
    emoji: "🌌",
    threshold: 700,
    ratePerMin: 2.8,
    desc: "몸에서 옅은 성운빛이 흐른다. 태양전지판 파편도 거뜬.",
  },
  {
    name: "오로라 세이렌",
    emoji: "🎐",
    threshold: 2000,
    ratePerMin: 4,
    desc: "유영할 때마다 오로라 같은 잔광을 남긴다.",
  },
  {
    name: "코스믹 웨일",
    emoji: "🐋",
    threshold: 20000,
    ratePerMin: 6,
    desc: "궤도의 고래. 폐위성 코어를 통째로 삼킨다.",
  },
  {
    name: "보이드 리바이어던",
    emoji: "🌠",
    threshold: 130000,
    ratePerMin: 9,
    desc: "전설의 최종 진화. 지나간 궤도는 거울처럼 깨끗해진다.",
  },
];

export function stageIndexForTotal(totalEaten: number): number {
  let idx = 0;
  for (let i = 0; i < EVOLUTION_STAGES.length; i++) {
    if (totalEaten >= EVOLUTION_STAGES[i].threshold) idx = i;
  }
  return idx;
}

export const DEBRIS_TYPES: DebrisType[] = [
  { id: "paint", label: "페인트 조각", massKg: 0.002, weight: 38, radius: 5 },
  { id: "bolt", label: "티타늄 볼트", massKg: 0.08, weight: 26, radius: 7 },
  { id: "shard", label: "태양전지판 파편", massKg: 0.6, weight: 16, radius: 11 },
  { id: "fairing", label: "페어링 조각", massKg: 4.2, weight: 11, radius: 14 },
  { id: "antenna", label: "폐안테나", massKg: 12, weight: 6, radius: 16 },
  { id: "satcore", label: "폐위성 코어", massKg: 140, weight: 3, radius: 20 },
];

/** 세계관 통계 (데모 고정값) */
export const WORLD_STATS = {
  participants: 234_000_000,
  activePets: 198_000_000,
  clearedTons: 38_142,
  remainingDebris: 310_000_000,
};

export const LORE_TIMELINE = [
  {
    date: "2025.11.07",
    title: "케슬러 캐스케이드",
    body: "폐기 위성 카스카디아-9과 로켓 상단이 고도 780km에서 충돌. 파편이 파편을 부르는 연쇄가 시작되어 단 3주 만에 추적 가능한 파편이 4억 개를 넘었다. 그날 밤, 유성우처럼 쏟아지는 불빛을 전 세계가 함께 올려다봤다.",
  },
  {
    date: "2025.12.02",
    title: "정거장의 마지막 불빛",
    body: "국제우주정거장 승무원 전원이 무사히 지구로 귀환했다. 착륙 캡슐에서 나온 선장의 첫마디는 이랬다. \"하늘은 잠시 맡겨두고 왔습니다. 되찾으러 갑시다.\"",
  },
  {
    date: "2026.01.20",
    title: "오르비타 협약",
    body: "194개국이 서명한 사상 최대의 우주 조약. 궤도 청소를 특정 국가가 아닌 전 인류의 일상으로 만들자는 약속. 협약 1조 1항 — \"하늘은 모두의 것이다.\"",
  },
  {
    date: "2026.02.14",
    title: "스텔라펫 프로젝트",
    body: "궤도 파편을 영양분 삼도록 설계된 인공 공생 생명체 스텔라펫이 공개됐다. 첫 알 배치 '제네시스 클러치' 100만 개가 각 가정에 분양되었고, 2주 뒤 1세대가 일제히 하늘로 떠났다.",
  },
];
