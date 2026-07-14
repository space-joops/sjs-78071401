import { DATA_AS_OF, DEBRIS_TYPES, EVOLUTION_STAGES, stageIndexForTotal } from "./constants";
import { fmtDateMs, mulberry32 } from "./format";
import type { Pilot, PilotEvolutionEntry, PilotLogEntry } from "./types";

/**
 * 데모 리더보드 — 오르비타 협약 공식 랭킹 상위 20.
 * 수치는 DATA_AS_OF 기준의 고정 스냅샷이다.
 */
export const PILOTS: Pilot[] = [
  { id: "p01", petName: "별사탕", owner: "하윤 · 서울", countryFlag: "🇰🇷", countryName: "대한민국", launchSite: "나로우주센터", launchDate: "2026-03-01", totalEaten: 152340, totalKg: 61203, altitudeKm: 562, hue: 210, delta: 0, bio: "페어링 조각을 사탕처럼 아껴 먹는 미식가." },
  { id: "p02", petName: "Mriya", owner: "올레나 · 오데사", countryFlag: "🇺🇦", countryName: "우크라이나", launchSite: "쿠루 우주센터 (협약 공동)", launchDate: "2026-03-01", totalEaten: 148902, totalKg: 55882, altitudeKm: 611, hue: 45, delta: 1, bio: "태양 폭풍이 와도 유영을 멈추지 않는 꿋꿋한 펫." },
  { id: "p03", petName: "Chomper", owner: "라일리 · 오스틴", countryFlag: "🇺🇸", countryName: "미국", launchSite: "케이프커내버럴", launchDate: "2026-03-04", totalEaten: 141277, totalKg: 63940, altitudeKm: 548, hue: 15, delta: -1, bio: "폐위성 코어를 통째로 삼킨 최초의 스텔라펫." },
  { id: "p04", petName: "모찌마루", owner: "하나 · 오사카", countryFlag: "🇯🇵", countryName: "일본", launchSite: "다네가시마 우주센터", launchDate: "2026-03-06", totalEaten: 129873, totalKg: 48110, altitudeKm: 588, hue: 330, delta: 2, bio: "파편을 먹은 뒤 꼭 세 바퀴 도는 버릇이 있다." },
  { id: "p05", petName: "Tara", owner: "프리야 · 벵갈루루", countryFlag: "🇮🇳", countryName: "인도", launchSite: "사티시 다완 우주센터", launchDate: "2026-03-09", totalEaten: 118455, totalKg: 44905, altitudeKm: 623, hue: 275, delta: 0, bio: "하루 16번 찾아오는 궤도의 일출을 전부 챙겨 본다." },
  { id: "p06", petName: "Estrela", owner: "마테우스 · 상파울루", countryFlag: "🇧🇷", countryName: "브라질", launchSite: "알칸타라 발사센터", launchDate: "2026-03-15", totalEaten: 104212, totalKg: 39551, altitudeKm: 577, hue: 120, delta: -2, bio: "삼바 스텝처럼 리드미컬하게 파편 사이를 누빈다." },
  { id: "p07", petName: "Céleste", owner: "루이 · 리옹", countryFlag: "🇫🇷", countryName: "프랑스", launchSite: "쿠루 우주센터", launchDate: "2026-03-18", totalEaten: 96730, totalKg: 35208, altitudeKm: 641, hue: 260, delta: 1, bio: "먹기 전에 파편을 한참 감상하는 낭만파." },
  { id: "p08", petName: "Zuri", owner: "아미나 · 몸바사", countryFlag: "🇰🇪", countryName: "케냐", launchSite: "말린디 해상 플랫폼", launchDate: "2026-03-22", totalEaten: 88164, totalKg: 33470, altitudeKm: 559, hue: 90, delta: 3, bio: "적도 상공을 도맡은 궤도의 수호자." },
  { id: "p09", petName: "Sternchen", owner: "레나 · 베를린", countryFlag: "🇩🇪", countryName: "독일", launchSite: "안도야 스페이스포트 (협약 공동)", launchDate: "2026-03-25", totalEaten: 79988, totalKg: 30101, altitudeKm: 597, hue: 195, delta: -1, bio: "수거한 파편 목록을 크기순으로 정리한다는 소문." },
  { id: "p10", petName: "Yıldız", owner: "에미르 · 이즈미르", countryFlag: "🇹🇷", countryName: "튀르키예", launchSite: "에스레인지 (협약 공동)", launchDate: "2026-03-30", totalEaten: 71402, totalKg: 26882, altitudeKm: 585, hue: 350, delta: 0, bio: "혜성 꼬리를 쫓다가 반나절 길을 잃은 적이 있다." },
  { id: "p11", petName: "Kirra", owner: "잭 · 애들레이드", countryFlag: "🇦🇺", countryName: "호주", launchSite: "웨일러스 웨이 발사장", launchDate: "2026-04-03", totalEaten: 63219, totalKg: 23904, altitudeKm: 543, hue: 165, delta: 2, bio: "남반구 오로라 아래에서 부화했다." },
  { id: "p12", petName: "Aurora", owner: "엘사 · 키루나", countryFlag: "🇸🇪", countryName: "스웨덴", launchSite: "에스레인지 우주센터", launchDate: "2026-04-08", totalEaten: 55873, totalKg: 20466, altitudeKm: 618, hue: 185, delta: -1, bio: "극궤도의 밤을 지키는 조용한 순찰자." },
  { id: "p13", petName: "싱싱(星星)", owner: "리웨이 · 청두", countryFlag: "🇨🇳", countryName: "중국", launchSite: "원창 우주발사장", launchDate: "2026-04-12", totalEaten: 48340, totalKg: 18320, altitudeKm: 573, hue: 0, delta: 1, bio: "판다처럼 먹고, 판다처럼 잔다." },
  { id: "p14", petName: "Kea", owner: "마이아 · 웰링턴", countryFlag: "🇳🇿", countryName: "뉴질랜드", launchSite: "마히아 반도 발사장", launchDate: "2026-04-18", totalEaten: 41092, totalKg: 15671, altitudeKm: 531, hue: 140, delta: 0, bio: "고산 앵무새를 닮아 호기심이 멈추지 않는다." },
  { id: "p15", petName: "Nour", owner: "리나 · 카이로", countryFlag: "🇪🇬", countryName: "이집트", launchSite: "협약 지중해 해상 플랫폼", launchDate: "2026-04-24", totalEaten: 34517, totalKg: 12905, altitudeKm: 602, hue: 55, delta: 4, bio: "나일강에 비친 별빛을 기억하는 펫." },
  { id: "p16", petName: "Luna", owner: "소피아 · 멕시코시티", countryFlag: "🇲🇽", countryName: "멕시코", launchSite: "협약 태평양 해상 플랫폼", launchDate: "2026-04-29", totalEaten: 27846, totalKg: 10220, altitudeKm: 566, hue: 300, delta: -2, bio: "보름달이 뜨면 평소보다 두 배로 먹는다." },
  { id: "p17", petName: "Bảo", owner: "민 · 하노이", countryFlag: "🇻🇳", countryName: "베트남", launchSite: "협약 해상 플랫폼 7호", launchDate: "2026-05-05", totalEaten: 21530, totalKg: 7844, altitudeKm: 554, hue: 105, delta: 1, bio: "쌀알만 한 페인트 조각만 골라 먹는 소식가." },
  { id: "p18", petName: "Maple", owner: "노아 · 토론토", countryFlag: "🇨🇦", countryName: "캐나다", launchSite: "처칠 로켓연구소", launchDate: "2026-05-11", totalEaten: 15908, totalKg: 5730, altitudeKm: 609, hue: 25, delta: 0, bio: "단풍 시럽 색 파편만 보면 달려간다." },
  { id: "p19", petName: "Estrellita", owner: "카밀라 · 산티아고", countryFlag: "🇨🇱", countryName: "칠레", launchSite: "아타카마 고원 발사장", launchDate: "2026-05-16", totalEaten: 9764, totalKg: 3517, altitudeKm: 538, hue: 315, delta: 2, bio: "세상에서 가장 맑은 하늘에서 날아올랐다." },
  { id: "p20", petName: "다라", owner: "니란 · 치앙마이", countryFlag: "🇹🇭", countryName: "태국", launchSite: "협약 인도양 해상 플랫폼", launchDate: "2026-05-22", totalEaten: 5213, totalKg: 1842, altitudeKm: 571, hue: 75, delta: -1, bio: "매일 밤 주인에게 지구 사진을 보낸다." },
];

const ZONES = [
  "태평양 상공",
  "인도양 상공",
  "남대서양 상공",
  "북극권 상공",
  "아마존 상공",
  "사하라 상공",
  "동아시아 상공",
  "안데스 상공",
];

function agoLabel(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}분 전`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}시간 전`;
  return `${Math.round(minutes / 1440)}일 전`;
}

function seedFromId(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0;
  return s;
}

/** 파일럿별 최근 활동 로그 — 시드 기반이라 항상 같은 결과가 나온다. */
export function pilotActivityLog(pilot: Pilot): PilotLogEntry[] {
  const rand = mulberry32(seedFromId(pilot.id));
  const entries: PilotLogEntry[] = [];
  let minutes = 8 + rand() * 40;

  const others = PILOTS.filter((p) => p.id !== pilot.id);

  for (let i = 0; i < 6; i++) {
    const roll = rand();
    if (roll < 0.6) {
      const type = DEBRIS_TYPES[Math.floor(rand() * DEBRIS_TYPES.length)];
      const qty = 1 + Math.floor(rand() * 8);
      const alt = pilot.altitudeKm + Math.floor((rand() - 0.5) * 60);
      entries.push({
        agoLabel: agoLabel(minutes),
        text: `${type.label} ${qty}점 수거`,
        detail: `고도 ${alt} km · ${ZONES[Math.floor(rand() * ZONES.length)]}`,
      });
    } else if (roll < 0.72) {
      const n = 1 + Math.floor(rand() * 40);
      entries.push({
        agoLabel: agoLabel(minutes),
        text: `스타코어 ${n}호 사출`,
        detail: "재결정화된 자원이 회수 캡슐에 실려 지구로 향하는 중",
      });
    } else if (roll < 0.84) {
      const other = others[Math.floor(rand() * others.length)];
      entries.push({
        agoLabel: agoLabel(minutes),
        text: `스텔라펫 '${other.petName}'와 조우`,
        detail: "나란히 지구 반 바퀴를 함께 유영했다",
      });
    } else if (roll < 0.93) {
      entries.push({
        agoLabel: agoLabel(minutes),
        text: `지구 그림자에서 ${10 + Math.floor(rand() * 30)}분 낮잠`,
        detail: "일어나자마자 기지개 대신 한 바퀴 회전",
      });
    } else {
      entries.push({
        agoLabel: agoLabel(minutes),
        text: "오로라 커튼 통과",
        detail: `${pilot.owner.split(" · ")[0]}에게 지구 사진을 전송했다`,
      });
    }
    minutes += 30 + rand() * 60 * 14;
  }
  return entries;
}

/** 발사부터 현재 단계까지의 진화 연대기 (선형 성장 가정으로 날짜 추정) */
export function pilotEvolution(pilot: Pilot): PilotEvolutionEntry[] {
  const launchMs = new Date(`${pilot.launchDate}T00:00:00`).getTime();
  const asOfMs = new Date(`${DATA_AS_OF}T00:00:00`).getTime();
  const span = asOfMs - launchMs;
  const maxStage = stageIndexForTotal(pilot.totalEaten);

  const entries: PilotEvolutionEntry[] = [];
  for (let i = 0; i <= maxStage; i++) {
    const threshold = EVOLUTION_STAGES[i].threshold;
    const frac = threshold <= 0 ? 0 : Math.pow(threshold / pilot.totalEaten, 0.85);
    entries.push({ stageIndex: i, dateLabel: fmtDateMs(launchMs + span * frac) });
  }
  return entries;
}

/** 발사 후 경과일 (DATA_AS_OF 기준) */
export function pilotMissionDays(pilot: Pilot): number {
  const launchMs = new Date(`${pilot.launchDate}T00:00:00`).getTime();
  const asOfMs = new Date(`${DATA_AS_OF}T00:00:00`).getTime();
  return Math.max(1, Math.round((asOfMs - launchMs) / 86400000));
}
