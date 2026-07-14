// 줍스 스네이크 — 16비트(슈퍼패미컴) 스타일 픽셀 에셋.
//
// 모든 스프라이트는 16x16 문자 그리드로 "그려져" 있고, 모듈 로드 시
// 팔레트 인덱스 2D 배열(number[][])로 디코드된다. 행 길이·미정의 문자는
// 즉시 throw 하므로 `npm run build`(정적 프리렌더)가 곧 데이터 검증이다.
//
// [애니메이션 구조 — "꿀꺽" 성장]
// 몸은 SEGMENT 스프라이트의 연쇄로 그린다. 쓰레기를 먹으면:
//   1) 머리는 JOOPS_FRAMES[open → chomp → open] 순서로 씹고,
//   2) 목 위치에 SEGMENT_BULGE(한 치수 큰 덩어리)를 삽입해
//      한 틱마다 꼬리 쪽으로 한 칸씩 밀어 보낸다 (먹이가 내려가는 연출),
//   3) 벌지가 꼬리에 닿으면 SEGMENT를 하나 덧붙여 몸길이 +1.
// 렌더 스케일 1px 기준으로 세그먼트 하나가 곧 "1픽셀 성장"이 된다.

export type PixelGrid = number[][];

/** 슈퍼패미컴풍 고대비 16색 팔레트 (0 = 투명) */
export const PALETTE: readonly string[] = [
  "transparent", // 0 .
  "#0b2430", //     1 O  외곽선 (딥 네이비)
  "#1a8f80", //     2 d  몸통 어두운 청록 (그림자)
  "#3ddbc4", //     3 b  몸통 기본 청록
  "#8ffce8", //     4 h  몸통 하이라이트 민트
  "#ffffff", //     5 W  흰색 (눈·송곳니·불꽃 심)
  "#5c1436", //     6 m  입 속 (딥 마젠타)
  "#ff4a2a", //     7 F  불꽃 바깥 (레드)
  "#ffa63a", //     8 o  불꽃 중간 (오렌지)
  "#ffe66e", //     9 y  불꽃 안쪽·안테나 전구 (옐로)
  "#9ff4ff", //    10 c  별 밝은 시안
  "#4a6a9a", //    11 s  별 어두운 블루
  "#46d8ff", //    12 L  궤도선 밝은 시안
  "#1f6a8a", //    13 l  궤도선 어두운 시안
  "#c8d4e0", //    14 g  쓰레기 밝은 강철
  "#8a98ac", //    15 e  쓰레기 중간 강철
  "#4a5668", //    16 k  쓰레기 어두운 강철
  "#cfc0a2", //    17 n  로켓 베이지
  "#8d8065", //    18 N  로켓 어두운 베이지
];

const CHAR_MAP: Record<string, number> = {
  ".": 0,
  O: 1,
  d: 2,
  b: 3,
  h: 4,
  W: 5,
  m: 6,
  F: 7,
  o: 8,
  y: 9,
  c: 10,
  s: 11,
  L: 12,
  l: 13,
  g: 14,
  e: 15,
  k: 16,
  n: 17,
  N: 18,
};

function decode(name: string, art: string[]): PixelGrid {
  if (art.length !== 16) {
    throw new Error(`[pixel] ${name}: 16행이어야 합니다 (현재 ${art.length}행)`);
  }
  return art.map((row, y) => {
    if (row.length !== 16) {
      throw new Error(`[pixel] ${name} ${y}행: 16자여야 합니다 (현재 ${row.length}자) "${row}"`);
    }
    return [...row].map((ch, x) => {
      const v = CHAR_MAP[ch];
      if (v === undefined) {
        throw new Error(`[pixel] ${name} (${x},${y}): 알 수 없는 문자 "${ch}"`);
      }
      return v;
    });
  });
}

// ---- 캐릭터: 줍스 (팩맨처럼 입을 쩍 벌리고 오른쪽으로 비행) ----

/** 프레임 1 — 입을 쩍 벌린 상태. 위턱 밑에 흰 송곳니, 쐐기 안쪽은 입 속(m). */
export const JOOPS_OPEN: PixelGrid = decode("JOOPS_OPEN", [
  "....yy..........",
  "....yy..........",
  ".....O..........",
  "...OOhhhhOO.....",
  "..OhhhhWWbbO....",
  ".OhhbbbWObbO....",
  ".ObbbbbbbmOW....",
  ".ObbbbbbmO......",
  ".ObbbbbmO.......",
  ".OdbbbbbmO......",
  ".OdbbbbbbmO.....",
  ".OddbbbbbbbO....",
  "..OdddbbbbbO....",
  "...OOddddOO.....",
  ".....OOOO.......",
  "................",
]);

/** 프레임 2 — 꽉 깨무는 중(입이 거의 닫힘). 먹을 때 open↔chomp를 교차한다. */
export const JOOPS_CHOMP: PixelGrid = decode("JOOPS_CHOMP", [
  "....yy..........",
  "....yy..........",
  ".....O..........",
  "...OOhhhhOO.....",
  "..OhhhhWWbbO....",
  ".OhhbbbWObbbO...",
  ".ObbbbbbbbbbO...",
  ".ObbbbbbbbmOO...",
  ".ObbbbbbbmmO....",
  ".OdbbbbbbbmOO...",
  ".OdbbbbbbbbbO...",
  ".OddbbbbbbbO....",
  "..OdddbbbbbO....",
  "...OOddddOO.....",
  ".....OOOO.......",
  "................",
]);

/** 머리 애니메이션 순서 */
export const JOOPS_FRAMES: PixelGrid[] = [JOOPS_OPEN, JOOPS_CHOMP];

/** 입 다문 평상시 — 다마고치 초상화·정지 상태용 (배시시 웃는 입) */
export const JOOPS_IDLE: PixelGrid = decode("JOOPS_IDLE", [
  "....yy..........",
  "....yy..........",
  ".....O..........",
  "...OOhhhhOO.....",
  "..OhhhhWWbbO....",
  ".OhhbbbWObbbO...",
  ".ObbbbbbbbbbO...",
  ".ObbbbbbbbbbO...",
  ".ObbbbbObbObO...",
  ".OdbbbbbOObbO...",
  ".OdbbbbbbbbbO...",
  ".OddbbbbbbbO....",
  "..OdddbbbbbO....",
  "...OOddddOO.....",
  ".....OOOO.......",
  "................",
]);

/** 지친 상태 — 반쯤 감긴 눈, 일자 입 */
export const JOOPS_TIRED: PixelGrid = decode("JOOPS_TIRED", [
  "....yy..........",
  "....yy..........",
  ".....O..........",
  "...OOhhhhOO.....",
  "..OhhhhOObbO....",
  ".OhhbbbWObbbO...",
  ".ObbbbbbbbbbO...",
  ".ObbbbbbbbbbO...",
  ".ObbbbbbbbbbO...",
  ".OdbbbbOOObbO...",
  ".OdbbbbbbbbbO...",
  ".OddbbbbbbbO....",
  "..OdddbbbbbO....",
  "...OOddddOO.....",
  ".....OOOO.......",
  "................",
]);

/** 다친 상태 — X자 눈, 꺼진 안테나 전구 */
export const JOOPS_HURT: PixelGrid = decode("JOOPS_HURT", [
  "....ss..........",
  "....ss..........",
  ".....O..........",
  "...OOhhhhOO.....",
  "..OhhhhObObO....",
  ".OhhbbbbObbbO...",
  ".ObbbbbObObbO...",
  ".ObbbbbbbbbbO...",
  ".ObbbbbbbbbbO...",
  ".OdbbbbbOObbO...",
  ".OdbbbbbbbbbO...",
  ".OddbbbbbbbO....",
  "..OdddbbbbbO....",
  "...OOddddOO.....",
  ".....OOOO.......",
  "................",
]);

// ---- 꼬리 불꽃 (머리/꼬리 왼쪽에 겹쳐 그린다. 심은 흰색, 끝은 레드) ----

export const FLAME_A: PixelGrid = decode("FLAME_A", [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......oyyWW.....",
  "..F.ooyyWWWy....",
  ".FooyyyWWWWyy...",
  "..F.ooyyWWWy....",
  "......oyyWW.....",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

export const FLAME_B: PixelGrid = decode("FLAME_B", [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".....F.oyWW.....",
  "...FooyyWWWy....",
  "..FF.oyyWWWWy...",
  "...FooyyWWWy....",
  ".....F.oyWW.....",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

export const FLAME_FRAMES: PixelGrid[] = [FLAME_A, FLAME_B];

// ---- 몸통 세그먼트 (스네이크 성장의 기본 단위) ----

/** 기본 세그먼트 — 8px 공. 좌상단 하이라이트, 우하단 그림자. */
export const SEGMENT: PixelGrid = decode("SEGMENT", [
  "................",
  "................",
  "................",
  "................",
  "......OOOO......",
  ".....OhhbbO.....",
  "....OhhbbbbO....",
  "....OhbbbbdO....",
  "....ObbbbddO....",
  "....ObbddddO....",
  ".....OddddO.....",
  "......OOOO......",
  "................",
  "................",
  "................",
  "................",
]);

/** 꿀꺽 벌지 — 삼킨 쓰레기가 지나가는 한 치수 큰 세그먼트. */
export const SEGMENT_BULGE: PixelGrid = decode("SEGMENT_BULGE", [
  "................",
  "................",
  "................",
  ".....OOOOOO.....",
  "....OhhhbbbO....",
  "...OhhhbbbbbO...",
  "...OhhbbbbbbO...",
  "...OhbbbbbbdO...",
  "...ObbbbbbddO...",
  "...OdbbbddddO...",
  "....OddddddO....",
  ".....OOOOOO.....",
  "................",
  "................",
  "................",
  "................",
]);

// ---- 배경: 별무리 타일 (2프레임 트윙클) + 궤도 점선 타일 ----

export const STARS_A: PixelGrid = decode("STARS_A", [
  "................",
  "....c...........",
  "................",
  "...cWc.......s..",
  "....c...........",
  "................",
  ".........s......",
  "................",
  "..s.........c...",
  "................",
  "......c.........",
  "................",
  ".............s..",
  "...s............",
  "................",
  "........c.......",
]);

export const STARS_B: PixelGrid = decode("STARS_B", [
  "................",
  "................",
  "................",
  "....W........c..",
  "................",
  "................",
  ".........c......",
  "................",
  "..c..........s..",
  "................",
  "......s.........",
  "................",
  ".............c..",
  "...c............",
  "................",
  "........s.......",
]);

export const STARS_FRAMES: PixelGrid[] = [STARS_A, STARS_B];

/** 가로로 이어 붙이면 점선 궤도가 되는 타일 (8px 주기, 끝은 어두운 시안). */
export const ORBIT_DASH: PixelGrid = decode("ORBIT_DASH", [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "lLLl....lLLl....",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

// ---- 쓰레기 예시: 강철 볼트 ----

export const DEBRIS_BOLT: PixelGrid = decode("DEBRIS_BOLT", [
  "................",
  "................",
  "................",
  "................",
  "................",
  ".....OOOO.......",
  "....OggggO......",
  "...OggeeggO.....",
  "...OgeekegO.....",
  "....OekkeO......",
  ".....OOOO.......",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

/** 페인트 조각 (1등급) — 흩어진 작은 파편 */
export const DEBRIS_PAINT: PixelGrid = decode("DEBRIS_PAINT", [
  "................",
  "................",
  "................",
  "................",
  "................",
  "..........e.....",
  ".......g........",
  "......geg.......",
  ".......ee.......",
  "......k.........",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

/** 태양전지판 파편 (3등급) — 찢어진 셀 그리드 */
export const DEBRIS_PANEL: PixelGrid = decode("DEBRIS_PANEL", [
  "................",
  "................",
  "................",
  "................",
  "....OOOOOOOO....",
  "...OlLlLlLlO....",
  "...OLlLlLlLO....",
  "....OlLlLlO.....",
  "....OLlLlO......",
  ".....OOO........",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

/** 로켓 잔해 (4등급) — 찌그러진 노즐 */
export const DEBRIS_ROCKET: PixelGrid = decode("DEBRIS_ROCKET", [
  "................",
  "................",
  "................",
  "........OOO.....",
  "......OOnnNO....",
  "....OOnnnnNO....",
  "...OnnnnnnNNO...",
  "...OnnnnnNNNO...",
  "...OnNNNNNNNO...",
  "....OONNNNO.....",
  "......OONO......",
  "........OOO.....",
  "................",
  "................",
  "................",
  "................",
]);

/** 폐위성 (5등급) — 부러진 안테나와 꺾인 패널 */
export const DEBRIS_DEADSAT: PixelGrid = decode("DEBRIS_DEADSAT", [
  "................",
  "................",
  "................",
  ".......O........",
  ".......O........",
  "....OOOOOOO.....",
  "...OggggggeO....",
  "LlLOggeeggOLlL..",
  "LlLOgeekkegOLlL.",
  "...OggeeggeO....",
  "....OOOOOOO.....",
  "......OeO.......",
  ".....O..........",
  "................",
  "................",
  "................",
]);

/** 등급(tier) 1~5 순서의 쓰레기 그리드 */
export const DEBRIS_GRIDS: PixelGrid[] = [
  DEBRIS_PAINT,
  DEBRIS_BOLT,
  DEBRIS_PANEL,
  DEBRIS_ROCKET,
  DEBRIS_DEADSAT,
];

/** 운용 위성 (충돌 위험) — 경고등 점멸 2프레임 */
export const SAT_ON: PixelGrid = decode("SAT_ON", [
  "................",
  "................",
  "................",
  "......WWW.......",
  ".......O........",
  "...OOOOOOO......",
  "LlLOoooooOLlL...",
  "LlLONNNNNOLlL...",
  "...OOOOOOO......",
  "......F.........",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

export const SAT_OFF: PixelGrid = decode("SAT_OFF", [
  "................",
  "................",
  "................",
  "......WWW.......",
  ".......O........",
  "...OOOOOOO......",
  "LlLOoooooOLlL...",
  "LlLONNNNNOLlL...",
  "...OOOOOOO......",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

export const SAT_FRAMES: PixelGrid[] = [SAT_ON, SAT_OFF];

/** 글로벌 링크 코어 — 미니 지구 + 회전 링 2프레임 */
export const CAPSULE_A: PixelGrid = decode("CAPSULE_A", [
  "................",
  "................",
  "................",
  "................",
  "......OOOO......",
  ".....OcLLlO.....",
  "....OcLLLllO....",
  ".c..OLLcLllO..c.",
  "....OLlLLllO....",
  "....OlLLlllO....",
  ".....OllllO.....",
  "......OOOO......",
  "................",
  "................",
  "................",
  "................",
]);

export const CAPSULE_B: PixelGrid = decode("CAPSULE_B", [
  "................",
  "................",
  "................",
  "................",
  "......OOOO......",
  "..c..OcLLlO.....",
  "....OcLLLllO....",
  "....OLLcLllO....",
  "....OLlLLllO....",
  "....OlLLlllO..c.",
  ".....OllllO.....",
  "......OOOO......",
  "................",
  "................",
  "................",
  "................",
]);

export const CAPSULE_FRAMES: PixelGrid[] = [CAPSULE_A, CAPSULE_B];

/** 하트 이펙트 — 인덱스 7(F)을 remap 하면 원하는 색으로 그려진다 */
export const HEART: PixelGrid = decode("HEART", [
  "................",
  "................",
  "................",
  "................",
  "................",
  "....FF.FF.......",
  "...FFFFFFF......",
  "...FFFFFFF......",
  "....FFFFF.......",
  ".....FFF........",
  "......F.........",
  "................",
  "................",
  "................",
  "................",
  "................",
]);

/** 갤러리·외부 소비용 목록 */
export const SPRITES: { key: string; label: string; frames: PixelGrid[]; fps: number }[] = [
  { key: "joops", label: "줍스 (냠냠 2프레임)", frames: JOOPS_FRAMES, fps: 5 },
  { key: "moods", label: "표정 (평상·지침·부상)", frames: [JOOPS_IDLE, JOOPS_TIRED, JOOPS_HURT], fps: 2 },
  { key: "flame", label: "꼬리 불꽃 (플리커)", frames: FLAME_FRAMES, fps: 8 },
  { key: "segment", label: "몸통 세그먼트", frames: [SEGMENT], fps: 1 },
  { key: "bulge", label: "꿀꺽 벌지 (+1픽셀)", frames: [SEGMENT_BULGE], fps: 1 },
  { key: "stars", label: "별무리 타일 (트윙클)", frames: STARS_FRAMES, fps: 2 },
  { key: "orbit", label: "궤도 점선 타일", frames: [ORBIT_DASH], fps: 1 },
  { key: "debris", label: "쓰레기 1~5등급", frames: DEBRIS_GRIDS, fps: 1.5 },
  { key: "sat", label: "운용 위성 (경고등)", frames: SAT_FRAMES, fps: 3 },
  { key: "capsule", label: "글로벌 링크 코어", frames: CAPSULE_FRAMES, fps: 3 },
];

// ---- Canvas 렌더러 ----

/** 팔레트 인덱스 → 대체 색. 진화 단계·친구 배색 등 팔레트 스왑에 쓴다. */
export type PaletteRemap = Partial<Record<number, string>>;

/** 그리드를 (x, y)에 scale 배로 그린다. 픽셀 하나 = scale×scale 사각형. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  grid: PixelGrid,
  x: number,
  y: number,
  scale: number,
  remap?: PaletteRemap,
): void {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const v = line[col];
      if (v === 0) continue;
      ctx.fillStyle = remap?.[v] ?? PALETTE[v];
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

/** 자주 쓰는 스프라이트는 오프스크린 캔버스로 구워서 drawImage 한다. */
export function bakeSprite(grid: PixelGrid, scale: number, remap?: PaletteRemap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 16 * scale;
  canvas.height = 16 * scale;
  const ctx = canvas.getContext("2d");
  if (ctx) drawSprite(ctx, grid, 0, 0, scale, remap);
  return canvas;
}
