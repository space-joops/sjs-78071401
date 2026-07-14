import type { GeoPoint, WorldCountry, WorldData } from "../types";

let worldPromise: Promise<WorldData> | null = null;

/** /public/feature-6/world.json (Natural Earth 50m 단순화본) 로드 — 1회 캐시 */
export function loadWorld(): Promise<WorldData> {
  if (!worldPromise) {
    worldPromise = fetch("/feature-6/world.json").then((res) => {
      if (!res.ok) throw new Error(`world.json load failed: ${res.status}`);
      return res.json() as Promise<WorldData>;
    });
    worldPromise.catch(() => {
      worldPromise = null; // 실패 시 재시도 가능하게
    });
  }
  return worldPromise;
}

/** 등장방형(equirectangular) 투영 */
export function project(
  lng: number,
  lat: number,
  width: number,
  height: number
): [number, number] {
  return [((lng + 180) / 360) * width, ((90 - lat) / 180) * height];
}

export function unproject(
  x: number,
  y: number,
  width: number,
  height: number
): GeoPoint {
  return { lng: (x / width) * 360 - 180, lat: 90 - (y / height) * 180 };
}

function ringContains(ring: [number, number][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function countryContains(c: WorldCountry, lng: number, lat: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = c.b;
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
  // even-odd 규칙: 홀수 개의 링에 포함되면 내부(구멍 처리 포함)
  let count = 0;
  for (const ring of c.r) {
    if (ringContains(ring, lng, lat)) count++;
  }
  return count % 2 === 1;
}

/** 현재 상공 국가 조회. 바다/공해 상공이면 null */
export function countryAt(world: WorldData, p: GeoPoint): string | null {
  for (const c of world.countries) {
    if (countryContains(c, p.lng, p.lat)) return c.n;
  }
  return null;
}

const KOREAN_NAMES: Record<string, string> = {
  "South Korea": "대한민국",
  "North Korea": "북한",
  Japan: "일본",
  China: "중국",
  Taiwan: "대만",
  Mongolia: "몽골",
  Russia: "러시아",
  "United States of America": "미국",
  Canada: "캐나다",
  Mexico: "멕시코",
  Brazil: "브라질",
  Argentina: "아르헨티나",
  Chile: "칠레",
  Peru: "페루",
  Colombia: "콜롬비아",
  Venezuela: "베네수엘라",
  Bolivia: "볼리비아",
  "United Kingdom": "영국",
  France: "프랑스",
  Germany: "독일",
  Italy: "이탈리아",
  Spain: "스페인",
  Portugal: "포르투갈",
  Netherlands: "네덜란드",
  Belgium: "벨기에",
  Switzerland: "스위스",
  Austria: "오스트리아",
  Poland: "폴란드",
  Ukraine: "우크라이나",
  Sweden: "스웨덴",
  Norway: "노르웨이",
  Finland: "핀란드",
  Denmark: "덴마크",
  Greece: "그리스",
  Turkey: "튀르키예",
  Iceland: "아이슬란드",
  Ireland: "아일랜드",
  Czechia: "체코",
  Romania: "루마니아",
  Hungary: "헝가리",
  India: "인도",
  Pakistan: "파키스탄",
  Bangladesh: "방글라데시",
  Nepal: "네팔",
  Thailand: "태국",
  Vietnam: "베트남",
  Laos: "라오스",
  Cambodia: "캄보디아",
  Myanmar: "미얀마",
  Malaysia: "말레이시아",
  Singapore: "싱가포르",
  Indonesia: "인도네시아",
  Philippines: "필리핀",
  Australia: "호주",
  "New Zealand": "뉴질랜드",
  "Papua New Guinea": "파푸아뉴기니",
  Egypt: "이집트",
  Libya: "리비아",
  Algeria: "알제리",
  Morocco: "모로코",
  Tunisia: "튀니지",
  Sudan: "수단",
  Ethiopia: "에티오피아",
  Kenya: "케냐",
  Tanzania: "탄자니아",
  Nigeria: "나이지리아",
  Ghana: "가나",
  "South Africa": "남아프리카공화국",
  Madagascar: "마다가스카르",
  "Dem. Rep. Congo": "콩고민주공화국",
  "Saudi Arabia": "사우디아라비아",
  Iran: "이란",
  Iraq: "이라크",
  Israel: "이스라엘",
  Jordan: "요르단",
  Syria: "시리아",
  "United Arab Emirates": "아랍에미리트",
  Kazakhstan: "카자흐스탄",
  Uzbekistan: "우즈베키스탄",
  Afghanistan: "아프가니스탄",
  Greenland: "그린란드",
  Antarctica: "남극",
  Cuba: "쿠바",
  Guatemala: "과테말라",
  Ecuador: "에콰도르",
  Paraguay: "파라과이",
  Uruguay: "우루과이",
};

export function koreanCountryName(en: string | null): string {
  if (!en) return "공해(바다)";
  return KOREAN_NAMES[en] ?? en;
}
