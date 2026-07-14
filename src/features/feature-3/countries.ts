// 위경도 → "지금 어느 나라/해역 상공인가" 근사 조회.
// 게임 표시용의 대략적인 경계 상자(bounding box)로, 먼저 매칭되는 항목이 이긴다.
// 겹치는 지역은 작은 나라를 앞에 배치한다.

type Box = {
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
};

const BOXES: Box[] = [
  // 한반도 주변 (우선순위 최상)
  { name: "대한민국", latMin: 33.0, latMax: 38.8, lonMin: 125.6, lonMax: 129.9 },
  { name: "북한", latMin: 37.6, latMax: 43.1, lonMin: 124.2, lonMax: 130.7 },
  { name: "일본", latMin: 30.9, latMax: 45.6, lonMin: 129.9, lonMax: 146.0 },
  { name: "대만", latMin: 21.9, latMax: 25.3, lonMin: 120.0, lonMax: 122.0 },
  // 아시아
  { name: "몽골", latMin: 41.5, latMax: 52.2, lonMin: 87.7, lonMax: 119.9 },
  { name: "네팔", latMin: 26.3, latMax: 30.5, lonMin: 80.0, lonMax: 88.2 },
  { name: "방글라데시", latMin: 20.7, latMax: 26.6, lonMin: 88.0, lonMax: 92.7 },
  { name: "베트남", latMin: 8.6, latMax: 23.4, lonMin: 102.1, lonMax: 109.5 },
  { name: "태국", latMin: 5.6, latMax: 20.5, lonMin: 97.3, lonMax: 105.6 },
  { name: "미얀마", latMin: 9.8, latMax: 28.5, lonMin: 92.2, lonMax: 101.2 },
  { name: "말레이시아", latMin: 0.9, latMax: 7.4, lonMin: 99.6, lonMax: 119.3 },
  { name: "필리핀", latMin: 5.0, latMax: 19.6, lonMin: 117.0, lonMax: 126.6 },
  { name: "인도네시아", latMin: -10.4, latMax: 5.9, lonMin: 95.0, lonMax: 141.0 },
  { name: "인도", latMin: 6.7, latMax: 35.5, lonMin: 68.1, lonMax: 97.4 },
  { name: "파키스탄", latMin: 23.7, latMax: 37.1, lonMin: 60.9, lonMax: 77.8 },
  { name: "아프가니스탄", latMin: 29.4, latMax: 38.5, lonMin: 60.5, lonMax: 74.9 },
  { name: "우즈베키스탄", latMin: 37.2, latMax: 45.6, lonMin: 56.0, lonMax: 73.1 },
  { name: "카자흐스탄", latMin: 40.5, latMax: 55.5, lonMin: 46.5, lonMax: 87.3 },
  { name: "중국", latMin: 18.0, latMax: 53.6, lonMin: 73.5, lonMax: 134.8 },
  // 중동
  { name: "이란", latMin: 25.0, latMax: 39.8, lonMin: 44.0, lonMax: 63.3 },
  { name: "이라크", latMin: 29.0, latMax: 37.4, lonMin: 38.8, lonMax: 48.6 },
  { name: "튀르키예", latMin: 35.8, latMax: 42.1, lonMin: 26.0, lonMax: 44.8 },
  { name: "사우디아라비아", latMin: 16.3, latMax: 32.2, lonMin: 34.5, lonMax: 55.7 },
  { name: "캅카스 지역", latMin: 38.4, latMax: 43.6, lonMin: 40.0, lonMax: 50.4 },
  // 아프리카
  { name: "이집트", latMin: 22.0, latMax: 31.7, lonMin: 24.7, lonMax: 36.9 },
  { name: "리비아", latMin: 19.5, latMax: 33.2, lonMin: 9.3, lonMax: 25.2 },
  { name: "알제리", latMin: 19.0, latMax: 37.1, lonMin: -8.7, lonMax: 12.0 },
  { name: "모로코", latMin: 27.7, latMax: 35.9, lonMin: -13.2, lonMax: -1.0 },
  { name: "말리", latMin: 10.1, latMax: 25.0, lonMin: -12.2, lonMax: 4.3 },
  { name: "니제르", latMin: 11.7, latMax: 23.5, lonMin: 0.2, lonMax: 16.0 },
  { name: "차드", latMin: 7.4, latMax: 23.4, lonMin: 13.5, lonMax: 24.0 },
  { name: "수단", latMin: 8.7, latMax: 22.0, lonMin: 21.8, lonMax: 38.6 },
  { name: "에티오피아", latMin: 3.4, latMax: 14.9, lonMin: 33.0, lonMax: 48.0 },
  { name: "케냐", latMin: -4.7, latMax: 5.5, lonMin: 33.9, lonMax: 41.9 },
  { name: "탄자니아", latMin: -11.7, latMax: -1.0, lonMin: 29.3, lonMax: 40.4 },
  { name: "나이지리아", latMin: 4.3, latMax: 13.9, lonMin: 2.7, lonMax: 14.7 },
  { name: "콩고민주공화국", latMin: -13.5, latMax: 5.4, lonMin: 12.2, lonMax: 31.3 },
  { name: "앙골라", latMin: -18.0, latMax: -4.4, lonMin: 11.7, lonMax: 24.1 },
  { name: "나미비아", latMin: -28.9, latMax: -16.9, lonMin: 11.7, lonMax: 25.3 },
  { name: "남아프리카공화국", latMin: -34.8, latMax: -22.1, lonMin: 16.5, lonMax: 32.9 },
  { name: "마다가스카르", latMin: -25.6, latMax: -12.0, lonMin: 43.2, lonMax: 50.5 },
  // 유럽
  { name: "포르투갈", latMin: 36.9, latMax: 42.2, lonMin: -9.5, lonMax: -6.2 },
  { name: "스페인", latMin: 36.0, latMax: 43.8, lonMin: -9.4, lonMax: 3.3 },
  { name: "아일랜드", latMin: 51.4, latMax: 55.4, lonMin: -10.5, lonMax: -5.9 },
  { name: "영국", latMin: 49.9, latMax: 58.7, lonMin: -8.2, lonMax: 1.8 },
  { name: "프랑스", latMin: 42.3, latMax: 51.1, lonMin: -4.8, lonMax: 8.2 },
  { name: "독일", latMin: 47.3, latMax: 55.1, lonMin: 5.9, lonMax: 15.0 },
  { name: "이탈리아", latMin: 36.6, latMax: 47.1, lonMin: 6.6, lonMax: 18.5 },
  { name: "그리스", latMin: 34.8, latMax: 41.8, lonMin: 19.4, lonMax: 28.2 },
  { name: "폴란드", latMin: 49.0, latMax: 54.8, lonMin: 14.1, lonMax: 24.2 },
  { name: "루마니아", latMin: 43.6, latMax: 48.3, lonMin: 20.3, lonMax: 29.7 },
  { name: "우크라이나", latMin: 44.4, latMax: 52.4, lonMin: 22.1, lonMax: 40.2 },
  { name: "벨라루스", latMin: 51.3, latMax: 56.2, lonMin: 23.2, lonMax: 32.8 },
  { name: "발트 3국", latMin: 53.9, latMax: 59.7, lonMin: 21.0, lonMax: 28.2 },
  { name: "스웨덴", latMin: 55.3, latMax: 69.1, lonMin: 11.0, lonMax: 24.2 },
  { name: "노르웨이", latMin: 58.0, latMax: 71.2, lonMin: 4.6, lonMax: 31.1 },
  { name: "핀란드", latMin: 59.8, latMax: 70.1, lonMin: 20.5, lonMax: 31.6 },
  { name: "러시아", latMin: 41.2, latMax: 77.5, lonMin: 27.0, lonMax: 180.0 },
  { name: "러시아", latMin: 62.0, latMax: 71.5, lonMin: -180.0, lonMax: -169.0 },
  // 아메리카
  { name: "쿠바", latMin: 19.8, latMax: 23.3, lonMin: -85.0, lonMax: -74.1 },
  { name: "멕시코", latMin: 14.5, latMax: 32.7, lonMin: -117.1, lonMax: -86.7 },
  { name: "미국", latMin: 24.5, latMax: 49.4, lonMin: -124.8, lonMax: -66.9 },
  { name: "미국 (알래스카)", latMin: 51.2, latMax: 71.4, lonMin: -179.1, lonMax: -129.9 },
  { name: "캐나다", latMin: 41.7, latMax: 83.1, lonMin: -141.0, lonMax: -52.6 },
  { name: "콜롬비아", latMin: -4.2, latMax: 12.5, lonMin: -79.0, lonMax: -66.9 },
  { name: "베네수엘라", latMin: 0.6, latMax: 12.2, lonMin: -73.4, lonMax: -59.8 },
  { name: "페루", latMin: -18.3, latMax: 0.0, lonMin: -81.3, lonMax: -68.7 },
  { name: "볼리비아", latMin: -22.9, latMax: -9.7, lonMin: -69.6, lonMax: -57.5 },
  { name: "칠레", latMin: -55.9, latMax: -17.5, lonMin: -75.6, lonMax: -66.4 },
  { name: "아르헨티나", latMin: -55.0, latMax: -21.8, lonMin: -73.6, lonMax: -53.6 },
  { name: "브라질", latMin: -33.7, latMax: 5.3, lonMin: -73.9, lonMax: -34.8 },
  // 오세아니아
  { name: "호주", latMin: -43.6, latMax: -10.7, lonMin: 113.3, lonMax: 153.6 },
  { name: "뉴질랜드", latMin: -47.3, latMax: -34.4, lonMin: 166.5, lonMax: 178.6 },
  { name: "파푸아뉴기니", latMin: -10.7, latMax: -1.3, lonMin: 141.0, lonMax: 155.0 },
];

export type Region = { name: string; isLand: boolean };

export function regionAt(lat: number, lon: number): Region {
  for (const b of BOXES) {
    if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
      return { name: b.name, isLand: true };
    }
  }
  if (lat > 66) return { name: "북극해", isLand: false };
  if (lat < -60) return { name: "남극해", isLand: false };
  if (lon >= -70 && lon < 20) return { name: "대서양", isLand: false };
  if (lon >= 20 && lon < 120 && lat < 30) return { name: "인도양", isLand: false };
  if (lon >= 20 && lon < 60 && lat >= 30) return { name: "유라시아 내륙", isLand: false };
  return { name: "태평양", isLand: false };
}
