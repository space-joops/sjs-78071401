// 세계지도 데이터 로딩 + "지금 어느 나라/바다 상공인가" 판정

export type CountryShape = {
  name: string;
  rings: { bbox: [number, number, number, number]; flat: number[] }[];
};
export type WorldData = { countries: CountryShape[] };

type RawWorld = { countries: { n: string; p: number[][] }[] };

let worldPromise: Promise<WorldData | null> | null = null;

/** public/feature-4/world-50m.json 을 로드해 파싱(1회 캐시) */
export function loadWorld(): Promise<WorldData | null> {
  if (!worldPromise) {
    worldPromise = fetch("/feature-4/world-50m.json")
      .then((r) => (r.ok ? (r.json() as Promise<RawWorld>) : null))
      .then((raw) => {
        if (!raw) return null;
        return {
          countries: raw.countries.map((c) => ({
            name: c.n,
            rings: c.p.map((flat) => {
              let minLon = 180,
                minLat = 90,
                maxLon = -180,
                maxLat = -90;
              for (let i = 0; i < flat.length; i += 2) {
                if (flat[i] < minLon) minLon = flat[i];
                if (flat[i] > maxLon) maxLon = flat[i];
                if (flat[i + 1] < minLat) minLat = flat[i + 1];
                if (flat[i + 1] > maxLat) maxLat = flat[i + 1];
              }
              return {
                bbox: [minLon, minLat, maxLon, maxLat] as [number, number, number, number],
                flat,
              };
            }),
          })),
        };
      })
      .catch(() => null);
  }
  return worldPromise;
}

function pointInFlatRing(flat: number[], lon: number, lat: number) {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2],
      yi = flat[i * 2 + 1];
    const xj = flat[j * 2],
      yj = flat[j * 2 + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** 좌표가 속한 나라 이름(영문). 없으면 null */
export function countryAt(world: WorldData, lon: number, lat: number): string | null {
  for (const c of world.countries) {
    let inside = false;
    for (const r of c.rings) {
      const [a, b, x, y] = r.bbox;
      if (lon < a || lon > x || lat < b || lat > y) continue;
      if (pointInFlatRing(r.flat, lon, lat)) inside = !inside;
    }
    if (inside) return c.name;
  }
  return null;
}

const KO_NAMES: Record<string, string> = {
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
  Ecuador: "에콰도르",
  Paraguay: "파라과이",
  Uruguay: "우루과이",
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
  Belarus: "벨라루스",
  Sweden: "스웨덴",
  Norway: "노르웨이",
  Finland: "핀란드",
  Denmark: "덴마크",
  Iceland: "아이슬란드",
  Ireland: "아일랜드",
  Greece: "그리스",
  Turkey: "튀르키예",
  Romania: "루마니아",
  Bulgaria: "불가리아",
  Hungary: "헝가리",
  Czechia: "체코",
  Slovakia: "슬로바키아",
  Serbia: "세르비아",
  Croatia: "크로아티아",
  Kazakhstan: "카자흐스탄",
  Uzbekistan: "우즈베키스탄",
  India: "인도",
  Pakistan: "파키스탄",
  Bangladesh: "방글라데시",
  "Sri Lanka": "스리랑카",
  Nepal: "네팔",
  Myanmar: "미얀마",
  Thailand: "태국",
  Vietnam: "베트남",
  Laos: "라오스",
  Cambodia: "캄보디아",
  Malaysia: "말레이시아",
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
  "Dem. Rep. Congo": "콩고민주공화국",
  "South Africa": "남아프리카공화국",
  Madagascar: "마다가스카르",
  "Saudi Arabia": "사우디아라비아",
  Iran: "이란",
  Iraq: "이라크",
  Israel: "이스라엘",
  Jordan: "요르단",
  Syria: "시리아",
  Afghanistan: "아프가니스탄",
  Yemen: "예멘",
  Oman: "오만",
  "United Arab Emirates": "아랍에미리트",
  Cuba: "쿠바",
  Greenland: "그린란드",
  Antarctica: "남극 대륙",
};

export const koCountry = (name: string) => KO_NAMES[name] ?? name;

/** 바다 이름(대략적 구획) */
export function oceanAt(lon: number, lat: number): string {
  if (lat < -60) return "남극해";
  if (lat > 66) return "북극해";
  if (lon >= 20 && lon < 147 && lat < 30) return "인도양";
  if (lon >= 147 || lon < -70) return "태평양";
  if (lon >= -70 && lon < 20) return "대서양";
  return "태평양";
}

/** "🇰🇷 대한민국 상공" / "🌊 태평양 상공" 형태의 라벨 */
export function placeLabel(world: WorldData | null, lon: number, lat: number): string {
  if (world) {
    const c = countryAt(world, lon, lat);
    if (c) return `${koCountry(c)} 상공`;
  }
  return `${oceanAt(lon, lat)} 상공`;
}
