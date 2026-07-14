// SVG 아트(public/feature-3/art)를 캔버스 스프라이트로 로드한다.
// - 쓰레기 5종: 그대로 이미지 로드
// - 줍스: SVG 텍스트의 몸통 색을 치환해 진화 단계별/이웃 줍스용 변형 생성
// 로드 전이거나 실패하면 null → 엔진이 기존 벡터 드로잉으로 폴백한다.

import { STAGES } from "./constants";

const ART = "/feature-3/art";

const BODY_COLOR = "#3DF5C9"; // joops.svg 원본 몸통색
const HILITE_COLOR = "#8CFFE3"; // joops.svg 원본 하이라이트색

export type Sprites = {
  /** 진화 단계별 줍스 (색 변형) */
  joopsByStage: (HTMLImageElement | null)[];
  /** 이웃 줍스: [핑크, 퍼플] */
  friends: (HTMLImageElement | null)[];
  /** 쓰레기 등급 1~5 (index = tier-1) */
  debris: (HTMLImageElement | null)[];
};

const FRIEND_COLORS: { body: string; hilite: string }[] = [
  { body: "#FF9FB8", hilite: "#FFD1DC" },
  { body: "#C9A6FF", hilite: "#E6D9FF" },
];

const DEBRIS_FILES = [
  "debris-fleck.svg",
  "debris-screw.svg",
  "debris-panel.svg",
  "debris-rocket.svg",
  "debris-satellite.svg",
];

function mixWithWhite(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v * (1 - t) + 255 * t);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function makeVariant(
  svgText: string,
  body: string,
  hilite: string,
  cb: (img: HTMLImageElement) => void,
): void {
  const variant = svgText
    .replaceAll(BODY_COLOR, body)
    .replaceAll(HILITE_COLOR, hilite);
  const url = URL.createObjectURL(new Blob([variant], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    cb(img);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

export function loadSprites(): Sprites {
  const sprites: Sprites = {
    joopsByStage: STAGES.map(() => null),
    friends: FRIEND_COLORS.map(() => null),
    debris: DEBRIS_FILES.map(() => null),
  };
  if (typeof window === "undefined") return sprites;

  DEBRIS_FILES.forEach((file, i) => {
    const img = new Image();
    img.onload = () => {
      sprites.debris[i] = img;
    };
    img.src = `${ART}/${file}`;
  });

  fetch(`${ART}/joops.svg`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((svg) => {
      STAGES.forEach((stage, i) => {
        makeVariant(svg, stage.bodyColor, mixWithWhite(stage.bodyColor, 0.55), (img) => {
          sprites.joopsByStage[i] = img;
        });
      });
      FRIEND_COLORS.forEach((c, i) => {
        makeVariant(svg, c.body, c.hilite, (img) => {
          sprites.friends[i] = img;
        });
      });
    })
    .catch(() => {
      // 폴백: 벡터 드로잉 유지
    });

  return sprites;
}
