// 실제 대륙 데이터로 지구 텍스처(등장방형)를 오프스크린 캔버스에 그린다.
// style "game": 그래비티풍 몽환적 지구 / "console": NASA 관제 화면풍
import type { WorldData } from "./geo";
import { mulberry32 } from "./rng";

export type EarthStyle = "game" | "console";

const X = (lon: number, w: number) => ((lon + 180) / 360) * w;
const Y = (lat: number, h: number) => ((90 - lat) / 180) * h;

function traceLand(ctx: CanvasRenderingContext2D, world: WorldData, w: number, h: number) {
  ctx.beginPath();
  for (const c of world.countries) {
    for (const r of c.rings) {
      const f = r.flat;
      ctx.moveTo(X(f[0], w), Y(f[1], h));
      for (let i = 2; i < f.length; i += 2) {
        ctx.lineTo(X(f[i], w), Y(f[i + 1], h));
      }
      ctx.closePath();
    }
  }
}

export function buildEarthTexture(
  world: WorldData | null,
  w: number,
  h: number,
  style: EarthStyle,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  if (style === "game") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1c4f86");
    g.addColorStop(0.35, "#2e6ea8");
    g.addColorStop(0.55, "#2a7fb0");
    g.addColorStop(0.8, "#1c5588");
    g.addColorStop(1, "#dfeefc");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (world) {
      traceLand(ctx, world, w, h);
      ctx.fillStyle = "#5cb37e";
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(28,70,52,0.55)";
      ctx.lineWidth = Math.max(1, w / 1600);
      ctx.stroke();
      // 고위도는 눈 덮인 톤으로
      const ice = ctx.createLinearGradient(0, 0, 0, h);
      ice.addColorStop(0, "rgba(240,250,255,0.85)");
      ice.addColorStop(0.09, "rgba(240,250,255,0)");
      ice.addColorStop(0.9, "rgba(240,250,255,0)");
      ice.addColorStop(1, "rgba(240,250,255,0.9)");
      ctx.fillStyle = ice;
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillStyle = "#040d1c";
    ctx.fillRect(0, 0, w, h);
    // 격자(위경도 30°)
    ctx.strokeStyle = "rgba(90,140,200,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = -150; lon <= 150; lon += 30) {
      ctx.moveTo(X(lon, w), 0);
      ctx.lineTo(X(lon, w), h);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.moveTo(0, Y(lat, h));
      ctx.lineTo(w, Y(lat, h));
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(90,140,200,0.3)";
    ctx.beginPath();
    ctx.moveTo(0, Y(0, h));
    ctx.lineTo(w, Y(0, h));
    ctx.stroke();
    if (world) {
      traceLand(ctx, world, w, h);
      ctx.fillStyle = "#0d2f2c";
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(72,228,196,0.75)";
      ctx.lineWidth = Math.max(1, w / 1800);
      ctx.stroke();
    }
  }
  return c;
}

/** 은은하게 흐르는 구름 레이어(시드 고정) */
export function buildCloudTexture(w: number, h: number, seed = 42): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(seed);
  const clusters = Math.round((w * h) / 26000);
  for (let i = 0; i < clusters; i++) {
    const cx = rnd() * w;
    // 구름은 중위도에 몰리도록
    const cy = h * (0.5 + (rnd() - 0.5) * 0.85);
    const blobs = 4 + Math.floor(rnd() * 8);
    const baseR = 10 + rnd() * 34;
    for (let b = 0; b < blobs; b++) {
      const bx = cx + (rnd() - 0.5) * baseR * 3.2;
      const by = cy + (rnd() - 0.5) * baseR * 1.1;
      const r = baseR * (0.4 + rnd() * 0.8);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      const a = 0.05 + rnd() * 0.1;
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}
