// 스프라이트 오프스크린 캐시.
//
// drawSprite()는 픽셀마다 fillStyle 대입 + fillRect라 16×16 스프라이트 하나에
// 최대 256회 호출이 든다. 화면에 쓰레기·위성·줍스·타일이 깔리면 프레임당
// 수천 번이 되어 중저가 모바일에서 프레임을 잡아먹는다.
//
// 스프라이트는 한 번만 구워서(bakeSprite) 캔버스로 만들고 이후 drawImage 한 번으로 그린다.
// 프레임당 drawImage 수십 회 수준으로 떨어진다.

import { bakeSprite, type PaletteRemap, type PixelGrid } from "../pixel/sprites";

const cache = new Map<string, HTMLCanvasElement>();

/**
 * 구운 스프라이트를 얻는다. scale은 0.5 단위로 버킷팅해 캐시 폭발을 막는다.
 * key는 그리드+리맵 조합을 구분하는 고유 문자열이어야 한다.
 */
export function baked(
  key: string,
  grid: PixelGrid,
  scale: number,
  remap?: PaletteRemap,
): HTMLCanvasElement {
  const s = Math.max(0.5, Math.round(scale * 2) / 2);
  const k = `${key}@${s}`;
  let c = cache.get(k);
  if (!c) {
    c = bakeSprite(grid, s, remap);
    cache.set(k, c);
  }
  return c;
}

/** 구운 스프라이트를 중심 좌표에 그린다 (16×16 기준) */
export function drawBaked(
  ctx: CanvasRenderingContext2D,
  key: string,
  grid: PixelGrid,
  cx: number,
  cy: number,
  scale: number,
  remap?: PaletteRemap,
): void {
  const c = baked(key, grid, scale, remap);
  ctx.drawImage(c, Math.round(cx - c.width / 2), Math.round(cy - c.height / 2));
}

export function clearSpriteCache(): void {
  cache.clear();
}
