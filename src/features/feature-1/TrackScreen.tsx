"use client";

// 관제 화면 — NASA 위성 관제 스타일의 펼친 지구 지도.
// 지상궤적(지난 1궤도 + 앞으로 1.5궤도), 줍스 현재 위치, 홈 교신 반경,
// 현재 상공 국가와 홈 상공 도달 ETA를 보여준다.

import { useEffect, useRef, useState } from "react";
import type { ArcadeToast } from "./arcade";
import { HOME_PRESETS, ORBIT } from "./constants";
import {
  destinationPoint,
  formatEta,
  formatLatLon,
  groundPointAt,
  groundTrack,
  type LatLon,
} from "./orbit";
import { drawJoops } from "./joopsSprite";
import { getJoopsStore, type Snapshot } from "./store";

const ZOOMS = [1, 2, 4, 8];

export default function TrackScreen({
  snap,
  onToast,
}: {
  snap: Snapshot;
  onToast: (t: ArcadeToast) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(2);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
    };
    img.src = "/feature-1/earth-day.jpg";
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const store = getJoopsStore();
    let raf = 0;

    const loop = () => {
      const s = store.getSnapshot();
      const cssW = wrap.clientWidth;
      const cssH = Math.round(cssW / 2);
      if (s && cssW > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pw = Math.round(cssW * dpr);
        const ph = Math.round(cssH * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) renderMap(ctx, s, cssW, cssH, dpr, zoomRef.current, imgRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      onToast({ text: "이 기기에서 위치를 사용할 수 없어요", tone: "info" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        getJoopsStore().setHome({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          label: "내 위치",
        });
        onToast({ text: "홈 위치를 내 위치로 설정했어요 📍", tone: "good" });
      },
      () => onToast({ text: "위치 권한을 확인해 주세요", tone: "info" }),
      { timeout: 8000 },
    );
  };

  const { comm } = snap;

  return (
    <div className="flex flex-col gap-3 p-3 sm:mx-auto sm:max-w-2xl sm:p-4">
      {/* 지도 */}
      <div ref={wrapRef} className="relative overflow-hidden rounded-xl border border-white/10">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ aspectRatio: "2 / 1" }}
          aria-label="줍스 궤도 관제 지도"
        />
        <div className="absolute right-2 top-2 flex gap-1">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`h-11 w-11 rounded-lg text-xs font-bold backdrop-blur transition-colors ${
                zoom === z
                  ? "bg-cyan-300/90 text-cyan-950"
                  : "border border-white/15 bg-[#08142a]/70 text-cyan-100"
              }`}
              aria-label={`${z}배 확대`}
            >
              {z}×
            </button>
          ))}
        </div>
        {comm.viaGlobalLink && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-cyan-500/25 to-transparent px-3 py-2 text-center text-xs font-semibold text-cyan-100">
            🌐 글로벌 링크 활성 — 전 지구 교신 가능
          </div>
        )}
      </div>

      {/* 실시간 상태 */}
      <div className="grid grid-cols-2 gap-3">
        <Card title="현재 위치">
          <p className="font-mono text-sm text-cyan-100">{formatLatLon(snap.pos)}</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {snap.region.name} 상공 {snap.region.isLand ? "🏙️" : "🌊"}
          </p>
          <p className="mt-1 text-xs text-white/50">
            고도 {ORBIT.altitudeKm}km · {ORBIT.groundSpeedKms}km/s
          </p>
        </Card>
        <Card title="홈 상공 도달">
          {comm.active ? (
            <p className="text-sm font-bold text-emerald-300">
              {comm.viaGlobalLink ? "🌐 글로벌 링크 교신 중" : "📡 지금 머리 위에 있어요!"}
            </p>
          ) : (
            <p className="text-sm font-bold text-amber-300">{formatEta(comm.etaSec)}</p>
          )}
          <p className="mt-1 text-xs text-white/50">
            홈과의 거리 {Math.round(comm.distanceKm).toLocaleString()}km
          </p>
          <p className="mt-1 text-xs text-white/50">
            교신 반경 {comm.rangeKm.toLocaleString()}km (진화하면 넓어져요)
          </p>
          {snap.globalLinkRemainMs > 0 && (
            <p className="mt-1 text-xs text-cyan-300">
              글로벌 링크 {Math.ceil(snap.globalLinkRemainMs / 60000)}분 남음
            </p>
          )}
        </Card>
      </div>

      {/* 궤도 정보 */}
      <Card title="궤도 정보">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-white/70">
          <span>주기 {Math.round(ORBIT.periodSec / 60)}분</span>
          <span>경사각 {ORBIT.inclinationDeg}°</span>
          <span>고도 {ORBIT.altitudeKm}km (LEO)</span>
          <span>지상속도 {ORBIT.groundSpeedKms}km/s</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          {snap.st.name}는 접속하지 않는 동안에도 이 궤도를 돌며 우주쓰레기를 청소하고 있어요.
        </p>
      </Card>

      {/* 홈 위치 설정 */}
      <Card title={`홈 위치 — ${snap.st.home.label}`}>
        <div className="flex flex-wrap gap-2">
          {HOME_PRESETS.map((h) => (
            <button
              key={h.label}
              onClick={() => {
                getJoopsStore().setHome(h);
                onToast({ text: `홈을 ${h.label}(으)로 설정했어요 📍`, tone: "good" });
              }}
              className={`h-11 rounded-full px-4 text-xs font-semibold transition-colors ${
                snap.st.home.label === h.label
                  ? "bg-cyan-300 text-cyan-950"
                  : "border border-white/15 bg-white/5 text-white/80"
              }`}
            >
              {h.label}
            </button>
          ))}
          <button
            onClick={useMyLocation}
            className="h-11 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 text-xs font-semibold text-cyan-200"
          >
            📍 내 위치 사용
          </button>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0a1526]/80 p-3">
      <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ---- 지도 렌더링 ----

function project(p: LatLon, W: number, H: number): { x: number; y: number } {
  return { x: ((p.lon + 180) / 360) * W, y: ((90 - p.lat) / 180) * H };
}

/** 경도 ±180° 경계를 넘는 구간은 선을 끊어 그린다 */
function strokeTrack(
  ctx: CanvasRenderingContext2D,
  pts: LatLon[],
  W: number,
  H: number,
): void {
  ctx.beginPath();
  let prev: { x: number; y: number } | null = null;
  for (const p of pts) {
    const q = project(p, W, H);
    if (!prev || Math.abs(q.x - prev.x) > W / 2) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
    prev = q;
  }
  ctx.stroke();
}

function renderMap(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  W: number,
  H: number,
  dpr: number,
  zoom: number,
  img: HTMLImageElement | null,
): void {
  const now = Date.now();
  const pos = groundPointAt(now, snap.st.orbit);
  const j = project(pos, W, H);

  // 줍스를 따라가는 뷰 (경계 클램프)
  const vw = W / zoom;
  const vh = H / zoom;
  const vx = Math.max(0, Math.min(W - vw, j.x - vw / 2));
  const vy = Math.max(0, Math.min(H - vh, j.y - vh / 2));
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -vx * dpr * zoom, -vy * dpr * zoom);

  // 바탕 + 지구 텍스처 (관제 콘솔풍 톤)
  ctx.fillStyle = "#040e1c";
  ctx.fillRect(0, 0, W, H);
  if (img) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(5,16,36,0.45)";
    ctx.fillRect(0, 0, W, H);
  }

  // 위경도 격자 (30°)
  ctx.lineWidth = 1 / zoom;
  for (let lon = -150; lon <= 150; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.strokeStyle = lon === 0 ? "rgba(140,200,235,0.3)" : "rgba(120,180,220,0.13)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.strokeStyle = lat === 0 ? "rgba(140,200,235,0.3)" : "rgba(120,180,220,0.13)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // 지상궤적 — 지난 1궤도(실선) + 앞으로 1.5궤도(점선)
  const past = groundTrack(now, snap.st.orbit, -ORBIT.periodSec, 0, 40);
  const future = groundTrack(now, snap.st.orbit, 0, ORBIT.periodSec * 1.5, 40);
  ctx.strokeStyle = "rgba(125,232,216,0.85)";
  ctx.lineWidth = 1.7 / zoom;
  strokeTrack(ctx, past, W, H);
  ctx.strokeStyle = "rgba(125,232,216,0.38)";
  ctx.setLineDash([6 / zoom, 5 / zoom]);
  strokeTrack(ctx, future, W, H);
  ctx.setLineDash([]);

  // 홈 + 교신 반경
  const home = snap.st.home;
  const hq = project(home, W, H);
  const ringPts: LatLon[] = [];
  for (let b = 0; b <= 360; b += 5) ringPts.push(destinationPoint(home, b, snap.comm.rangeKm));
  ctx.strokeStyle = `rgba(255,217,122,${0.55 + 0.25 * Math.sin(now / 480)})`;
  ctx.lineWidth = 1.4 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  strokeTrack(ctx, ringPts, W, H);
  ctx.setLineDash([]);

  ctx.fillStyle = "#ffd97a";
  ctx.beginPath();
  ctx.arc(hq.x, hq.y, 3.2 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,217,122,0.9)";
  ctx.lineWidth = 1.2 / zoom;
  ctx.beginPath();
  ctx.arc(hq.x, hq.y, 6.5 / zoom, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `700 ${10 / zoom}px var(--font-geist-mono), monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,225,150,0.95)";
  ctx.fillText(home.label, hq.x, hq.y - 10 / zoom);

  // 줍스 마커 (펄스 링 + 미니 줍스)
  const pulse = 8 + 3 * Math.sin(now / 320);
  ctx.strokeStyle = "rgba(125,232,216,0.7)";
  ctx.lineWidth = 1.4 / zoom;
  ctx.beginPath();
  ctx.arc(j.x, j.y, pulse / zoom, 0, Math.PI * 2);
  ctx.stroke();
  drawJoops(ctx, j.x, j.y, 8 / zoom, snap.stageIndex, now, { mood: "happy" });
  ctx.fillStyle = "rgba(190,240,255,0.95)";
  ctx.font = `700 ${10 / zoom}px var(--font-geist-mono), monospace`;
  ctx.fillText(snap.st.name, j.x, j.y - 14 / zoom);
  ctx.textAlign = "left";
}
