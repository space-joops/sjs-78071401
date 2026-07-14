// world-atlas TopoJSON(국가 경계) 디코더 + 좌표→국가/해양 판별.
// topojson-client 의존성을 추가하지 않기 위해 필요한 최소 디코더를 직접 구현.

export type Ring = [number, number][]; // [lon, lat]
export type CountryPolygon = {
  rings: Ring[]; // [0]=외곽, 이후=구멍 (even-odd 판정이라 구분 불필요)
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
};
export type Country = { name: string; polygons: CountryPolygon[] };

type TopoTransform = { scale: [number, number]; translate: [number, number] };
type TopoGeometry = {
  type: "Polygon" | "MultiPolygon";
  arcs: unknown;
  properties?: { name?: string };
};
type Topology = {
  type: "Topology";
  transform?: TopoTransform;
  arcs: number[][][];
  objects: Record<string, { type: string; geometries: TopoGeometry[] }>;
};

function decodeArcs(topo: Topology): Ring[] {
  const scale = topo.transform?.scale ?? [1, 1];
  const translate = topo.transform?.translate ?? [0, 0];
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [
        number,
        number
      ];
    });
  });
}

function stitchRing(arcIndexes: number[], arcs: Ring[]): Ring {
  const pts: Ring = [];
  for (const idx of arcIndexes) {
    let seg = idx >= 0 ? arcs[idx] : arcs[~idx].slice().reverse();
    if (pts.length > 0) seg = seg.slice(1); // 아크 경계의 중복점 제거
    pts.push(...seg);
  }
  return pts;
}

function ringsToPolygon(rings: Ring[]): CountryPolygon {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const p of rings[0]) {
    if (p[0] < minLon) minLon = p[0];
    if (p[0] > maxLon) maxLon = p[0];
    if (p[1] < minLat) minLat = p[1];
    if (p[1] > maxLat) maxLat = p[1];
  }
  return { rings, bbox: [minLon, minLat, maxLon, maxLat] };
}

export function parseCountries(json: unknown): Country[] {
  const topo = json as Topology;
  const arcs = decodeArcs(topo);
  const collection = topo.objects.countries;
  const countries: Country[] = [];
  for (const geom of collection.geometries) {
    const name = geom.properties?.name ?? "미지의 땅";
    const polygons: CountryPolygon[] = [];
    if (geom.type === "Polygon") {
      const ringArcs = geom.arcs as number[][];
      polygons.push(ringsToPolygon(ringArcs.map((r) => stitchRing(r, arcs))));
    } else {
      const polyArcs = geom.arcs as number[][][];
      for (const poly of polyArcs) {
        polygons.push(ringsToPolygon(poly.map((r) => stitchRing(r, arcs))));
      }
    }
    countries.push({ name, polygons });
  }
  return countries;
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** 좌표가 속한 국가의 영문명 (없으면 null = 바다) */
export function countryNameAt(
  lon: number,
  lat: number,
  countries: Country[]
): string | null {
  for (const c of countries) {
    for (const poly of c.polygons) {
      const [minLon, minLat, maxLon, maxLat] = poly.bbox;
      if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
      let inside = false;
      for (const ring of poly.rings) {
        if (inRing(lon, lat, ring)) inside = !inside; // even-odd (구멍 처리)
      }
      if (inside) return c.name;
    }
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
  Uruguay: "우루과이",
  Paraguay: "파라과이",
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
  Czechia: "체코",
  Ukraine: "우크라이나",
  Belarus: "벨라루스",
  Romania: "루마니아",
  Bulgaria: "불가리아",
  Greece: "그리스",
  Turkey: "튀르키예",
  Sweden: "스웨덴",
  Norway: "노르웨이",
  Finland: "핀란드",
  Denmark: "덴마크",
  Iceland: "아이슬란드",
  Ireland: "아일랜드",
  Hungary: "헝가리",
  Serbia: "세르비아",
  Croatia: "크로아티아",
  India: "인도",
  Pakistan: "파키스탄",
  Bangladesh: "방글라데시",
  Nepal: "네팔",
  "Sri Lanka": "스리랑카",
  Myanmar: "미얀마",
  Thailand: "태국",
  Vietnam: "베트남",
  Laos: "라오스",
  Cambodia: "캄보디아",
  Malaysia: "말레이시아",
  Indonesia: "인도네시아",
  Philippines: "필리핀",
  Singapore: "싱가포르",
  Australia: "호주",
  "New Zealand": "뉴질랜드",
  "Papua New Guinea": "파푸아뉴기니",
  Egypt: "이집트",
  Libya: "리비아",
  Algeria: "알제리",
  Morocco: "모로코",
  Tunisia: "튀니지",
  Sudan: "수단",
  "S. Sudan": "남수단",
  Ethiopia: "에티오피아",
  Kenya: "케냐",
  Tanzania: "탄자니아",
  Nigeria: "나이지리아",
  Ghana: "가나",
  "South Africa": "남아프리카공화국",
  Madagascar: "마다가스카르",
  "Saudi Arabia": "사우디아라비아",
  Iran: "이란",
  Iraq: "이라크",
  Israel: "이스라엘",
  Jordan: "요르단",
  Syria: "시리아",
  Afghanistan: "아프가니스탄",
  Kazakhstan: "카자흐스탄",
  Uzbekistan: "우즈베키스탄",
  Turkmenistan: "투르크메니스탄",
  Kyrgyzstan: "키르기스스탄",
  Tajikistan: "타지키스탄",
  Cuba: "쿠바",
  Greenland: "그린란드",
  Antarctica: "남극 대륙",
  "Dem. Rep. Congo": "콩고민주공화국",
  Congo: "콩고",
  "Central African Rep.": "중앙아프리카공화국",
  Somalia: "소말리아",
  Mozambique: "모잠비크",
  Angola: "앙골라",
  Namibia: "나미비아",
  Botswana: "보츠와나",
  Zimbabwe: "짐바브웨",
  Zambia: "잠비아",
  Mali: "말리",
  Niger: "니제르",
  Chad: "차드",
  Mauritania: "모리타니",
  Senegal: "세네갈",
  Guinea: "기니",
  "Côte d'Ivoire": "코트디부아르",
  Cameroon: "카메룬",
  "Burkina Faso": "부르키나파소",
  "United Arab Emirates": "아랍에미리트",
  Oman: "오만",
  Yemen: "예멘",
  Kuwait: "쿠웨이트",
  Qatar: "카타르",
  Georgia: "조지아",
  Armenia: "아르메니아",
  Azerbaijan: "아제르바이잔",
  Moldova: "몰도바",
  Lithuania: "리투아니아",
  Latvia: "라트비아",
  Estonia: "에스토니아",
  Slovakia: "슬로바키아",
  Slovenia: "슬로베니아",
  "Bosnia and Herz.": "보스니아 헤르체고비나",
  Albania: "알바니아",
  Macedonia: "북마케도니아",
  "North Macedonia": "북마케도니아",
  Montenegro: "몬테네그로",
  Kosovo: "코소보",
  Bhutan: "부탄",
  "Timor-Leste": "동티모르",
  Brunei: "브루나이",
  Fiji: "피지",
  "Solomon Is.": "솔로몬제도",
  Vanuatu: "바누아투",
  Haiti: "아이티",
  "Dominican Rep.": "도미니카공화국",
  Jamaica: "자메이카",
  Panama: "파나마",
  "Costa Rica": "코스타리카",
  Nicaragua: "니카라과",
  Honduras: "온두라스",
  Guatemala: "과테말라",
  Belize: "벨리즈",
  "El Salvador": "엘살바도르",
  Guyana: "가이아나",
  Suriname: "수리남",
  Lesotho: "레소토",
  Malawi: "말라위",
  Burundi: "부룬디",
  Rwanda: "르완다",
  Uganda: "우간다",
  Eritrea: "에리트레아",
  Djibouti: "지부티",
  Benin: "베냉",
  Togo: "토고",
  Liberia: "라이베리아",
  "Sierra Leone": "시에라리온",
  "Guinea-Bissau": "기니비사우",
  Gambia: "감비아",
  Gabon: "가봉",
  "Eq. Guinea": "적도기니",
  "W. Sahara": "서사하라",
  "New Caledonia": "뉴칼레도니아",
  "Puerto Rico": "푸에르토리코",
  "Trinidad and Tobago": "트리니다드토바고",
  Bahamas: "바하마",
  Cyprus: "키프로스",
  Lebanon: "레바논",
  Luxembourg: "룩셈부르크",
};

export function koName(name: string): string {
  return KO_NAMES[name] ?? name;
}

/** 바다 위일 때의 해역 이름 (경위도 기반 근사, 국가 폴리곤이 없는 내해 포함) */
export function oceanNameAt(lon: number, lat: number): string {
  if (lat < -60) return "남극해";
  if (lat > 66) return "북극해";
  if (lon >= 46 && lon <= 56 && lat >= 36 && lat <= 48) return "카스피해";
  if (lon >= 26 && lon <= 42 && lat >= 40 && lat <= 48) return "흑해";
  if (lon >= -6 && lon <= 37 && lat >= 30 && lat <= 46) return "지중해";
  if (lon >= 32 && lon <= 44 && lat >= 12 && lat <= 30) return "홍해";
  if (lon >= 20 && lon < 147 && lat < 30) return "인도양";
  if (lon >= -70 && lon < 20) return "대서양";
  if (lon >= 147 || lon < -70) return "태평양";
  return "내륙 호수";
}

/** 현재 상공 표시용: 국가 한글명 또는 해역명 */
export function placeNameAt(
  lon: number,
  lat: number,
  countries: Country[] | null
): { name: string; isLand: boolean } {
  if (countries) {
    const c = countryNameAt(lon, lat, countries);
    if (c) return { name: koName(c), isLand: true };
  }
  return { name: oceanNameAt(lon, lat), isLand: false };
}
