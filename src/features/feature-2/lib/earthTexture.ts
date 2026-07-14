// 등장방형(equirectangular) 지구 텍스처를 한 번만 오프스크린에 렌더링.
// 비행 화면(궤도 스크롤)과 관제 화면(전도)이 같은 텍스처를 공유한다.
// 경도 랩어라운드를 위해 지도 오른쪽에 앞부분 복사본을 덧붙인 패딩 캔버스를 만든다.

import type { Country } from "./geo";
import { mulberry32 } from "./rng";

export const TEX_W = 3000; // 논리 지도 폭 (360°)
export const TEX_H = 1500; // 논리 지도 높이 (180°)
export const TEX_PAD = Math.round(TEX_W * 0.35); // 랩어라운드 패딩

export type EarthTextures = {
  map: HTMLCanvasElement; // (TEX_W + TEX_PAD) × TEX_H
  clouds: HTMLCanvasElement; // 같은 패딩 구조, 투명 배경
};

export function lonToX(lon: number): number {
  return ((lon + 180) / 360) * TEX_W;
}
export function latToY(lat: number): number {
  return ((90 - lat) / 180) * TEX_H;
}

const ICE_NAMES = new Set(["Antarctica", "Greenland"]);

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function drawOcean(ctx: CanvasRenderingContext2D) {
  // 극→적도 색을 사인 이징으로 보간 (스톱이 성기면 확대 시 마하 밴드가 보인다)
  const g = ctx.createLinearGradient(0, 0, 0, TEX_H);
  const pole = [10, 42, 68]; // #0a2a44
  const equator = [15, 85, 131]; // #0f5583
  for (let i = 0; i <= 24; i++) {
    const p = i / 24;
    const k = Math.sin(Math.PI * p);
    const c = pole.map((pv, j) => Math.round(pv + (equator[j] - pv) * k));
    g.addColorStop(p, `rgb(${c[0]},${c[1]},${c[2]})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // 몽환적인 해류 하이라이트
  const rng = mulberry32(7);
  for (let i = 0; i < 40; i++) {
    const x = rng() * TEX_W;
    const y = TEX_H * (0.2 + rng() * 0.6);
    const r = 80 + rng() * 260;
    const rad = ctx.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, "rgba(80,180,230,0.10)");
    rad.addColorStop(1, "rgba(80,180,230,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function countryPath(country: Country): Path2D {
  const path = new Path2D();
  for (const poly of country.polygons) {
    for (const ring of poly.rings) {
      ring.forEach(([lon, lat], i) => {
        const x = lonToX(lon);
        const y = latToY(lat);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
    }
  }
  return path;
}

function drawLand(ctx: CanvasRenderingContext2D, countries: Country[]) {
  for (const country of countries) {
    const path = countryPath(country);
    const ice = ICE_NAMES.has(country.name);
    ctx.save();
    // 해안선이 은은히 빛나는 몽환적 코스트라인
    ctx.shadowColor = ice ? "rgba(200,235,255,0.8)" : "rgba(120,220,200,0.55)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = ice ? "#c7dbe6" : "#33502f";
    ctx.fill(path, "evenodd");
    ctx.restore();
    ctx.strokeStyle = ice
      ? "rgba(235,250,255,0.5)"
      : "rgba(190,240,220,0.35)";
    ctx.lineWidth = 1.1;
    ctx.stroke(path);
    if (!ice) {
      // 내륙에 옅은 명암
      ctx.save();
      ctx.clip(path, "evenodd");
      const g = ctx.createLinearGradient(0, 0, 0, TEX_H);
      g.addColorStop(0, "rgba(180,200,150,0.12)");
      g.addColorStop(0.5, "rgba(90,130,70,0.10)");
      g.addColorStop(1, "rgba(180,200,150,0.12)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TEX_W, TEX_H);
      ctx.restore();
    }
  }
}

function drawFallbackLand(ctx: CanvasRenderingContext2D) {
  // 지도 데이터를 못 불러온 경우: 추상적인 대륙 실루엣
  const rng = mulberry32(21);
  ctx.fillStyle = "#33502f";
  for (let i = 0; i < 26; i++) {
    const x = rng() * TEX_W;
    const y = TEX_H * (0.15 + rng() * 0.7);
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      60 + rng() * 300,
      40 + rng() * 140,
      rng() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function buildClouds(): HTMLCanvasElement {
  const c = makeCanvas(TEX_W + TEX_PAD, TEX_H);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const rng = mulberry32(42);
  // 중위도 폭풍대·적도 수렴대에 구름 군집
  const bands = [0.5, 0.32, 0.68, 0.2, 0.8];
  for (let i = 0; i < 170; i++) {
    const band = bands[Math.floor(rng() * bands.length)];
    const cx = rng() * TEX_W;
    const cy = TEX_H * (band + (rng() - 0.5) * 0.16);
    const puffs = 3 + Math.floor(rng() * 6);
    const baseR = 14 + rng() * 55;
    const alpha = 0.08 + rng() * 0.14;
    const rot = rng() * Math.PI;
    for (let p = 0; p < puffs; p++) {
      const dx = (rng() - 0.5) * baseR * 3.2;
      const dy = (rng() - 0.5) * baseR * 1.1;
      const r = baseR * (0.5 + rng() * 0.8);
      const g = ctx.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.7, `rgba(255,255,255,${alpha * 0.5})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.translate(cx + dx, cy + dy);
      ctx.rotate(rot);
      ctx.scale(1.6, 1);
      ctx.translate(-(cx + dx), -(cy + dy));
      ctx.fillStyle = g;
      ctx.fillRect(cx + dx - r * 2, cy + dy - r, r * 4, r * 2);
      ctx.restore();
    }
  }
  // 랩어라운드 패딩 복사
  ctx.drawImage(c, 0, 0, TEX_PAD, TEX_H, TEX_W, 0, TEX_PAD, TEX_H);
  return c;
}

export function buildEarthTextures(countries: Country[] | null): EarthTextures {
  const map = makeCanvas(TEX_W + TEX_PAD, TEX_H);
  const ctx = map.getContext("2d");
  if (ctx) {
    drawOcean(ctx);
    if (countries) drawLand(ctx, countries);
    else drawFallbackLand(ctx);
    // 랩어라운드 패딩: 지도의 왼쪽 끝을 오른쪽에 복사
    ctx.drawImage(map, 0, 0, TEX_PAD, TEX_H, TEX_W, 0, TEX_PAD, TEX_H);
  }
  return { map, clouds: buildClouds() };
}
