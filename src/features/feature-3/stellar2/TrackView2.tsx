"use client";

// 관제 센터: 나사(NASA) 위성 관제 스타일의 펼친 지구 지도 위에
// 줍스의 지상궤적·현재 위치·홈 교신 반경·다른 줍스를 실시간 표시한다.

import { useEffect, useRef } from "react";
import { getStellar2Store, type Snapshot } from "./store2";
import {
  groundPointAt,
  groundTrack,
  destinationPoint,
  formatEta,
  formatLatLon,
  type LatLon,
  type OrbitParams,
} from "../orbit";
import { ORBIT } from "./balance";

type Props = { snap: Snapshot; onBack: () => void };

// 이웃 줍스들 (결정론적 궤도 — 모든 플레이어에게 동일하게 보인다)
const FRIEND_EPOCH = 1767225600000; // 2026-01-01T00:00:00Z
const FRIENDS: { name: string; orbit: OrbitParams; color: string }[] = [
  { name: "모모", orbit: { epochMs: FRIEND_EPOCH, nodeLonDeg: 40 }, color: "#f9a8d4" },
  { name: "루루", orbit: { epochMs: FRIEND_EPOCH + 1_723_456, nodeLonDeg: -100 }, color: "#c4b5fd" },
];

function project(p: LatLon, w: number, h: number): { x: number; y: number } {
  return { x: ((p.lon + 180) / 360) * w, y: ((90 - p.lat) / 180) * h };
}

/** 날짜변경선을 넘는 구간을 끊어 그리는 폴리라인 */
function strokeWrapped(
  ctx: CanvasRenderingContext2D,
  pts: LatLon[],
  w: number,
  h: number,
): void {
  ctx.beginPath();
  let prev: { x: number; y: number } | null = null;
  for (const p of pts) {
    const q = project(p, w, h);
    if (!prev || Math.abs(q.x - prev.x) > w / 2) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
    prev = q;
  }
  ctx.stroke();
}

export default function TrackView({ snap, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const store = getStellar2Store();
    const img = new Image();
    let imgReady = false;
    img.onload = () => (imgReady = true);
    img.src = "/feature-3/earth-day.jpg";

    let w = 0;
    let h = 0;
    const resize = () => {
      const r = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    let raf = 0;
    const draw = () => {
      const s = store.getSnapshot();
      if (!s) return;
      const now = Date.now();
      const orbit = s.st.orbit;
      const home = s.st.home;

      // 배경 지도
      ctx.clearRect(0, 0, w, h);
      if (imgReady) {
        ctx.drawImage(img, 0, 0, w, h);
        ctx.fillStyle = "rgba(2,8,23,0.52)";
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#04101f";
        ctx.fillRect(0, 0, w, h);
      }

      // 위경도 격자
      ctx.strokeStyle = "rgba(148,163,184,0.14)";
      ctx.lineWidth = 1;
      for (let lon = -150; lon <= 150; lon += 30) {
        const x = ((lon + 180) / 360) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = ((90 - lat) / 180) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // 적도 강조
      ctx.strokeStyle = "rgba(148,163,184,0.28)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // 교신 반경 (진화할수록 넓어짐)
      const circle: LatLon[] = [];
      for (let b = 0; b <= 360; b += 5) {
        circle.push(destinationPoint(home, b, s.comm.rangeKm));
      }
      ctx.strokeStyle =
        s.globalLinkRemainMs > 0 ? "rgba(251,191,36,0.75)" : "rgba(52,211,153,0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      strokeWrapped(ctx, circle, w, h);
      ctx.setLineDash([]);

      // 지상궤적: 과거 반 바퀴(점선) + 미래 한 바퀴(실선)
      const past = groundTrack(now, orbit, -ORBIT.periodSec / 2, 0, 30);
      const future = groundTrack(now, orbit, 0, ORBIT.periodSec, 30);
      ctx.strokeStyle = "rgba(94,234,212,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      strokeWrapped(ctx, past, w, h);
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(94,234,212,0.9)";
      strokeWrapped(ctx, future, w, h);

      // 이웃 줍스
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      for (const f of FRIENDS) {
        const p = project(groundPointAt(now, f.orbit), w, h);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(f.name, p.x + 6, p.y + 3);
      }

      // 홈 마커
      const hp = project(home, w, h);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hp.x - 7, hp.y);
      ctx.lineTo(hp.x + 7, hp.y);
      ctx.moveTo(hp.x, hp.y - 7);
      ctx.lineTo(hp.x, hp.y + 7);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillText(`⌂ ${home.label}`, hp.x + 8, hp.y - 6);

      // 줍스 현재 위치 (펄스)
      const jp = project(groundPointAt(now, orbit), w, h);
      const pulse = (now % 1800) / 1800;
      ctx.strokeStyle = `rgba(94,234,212,${0.8 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(jp.x, jp.y, 5 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#5eead4";
      ctx.shadowColor = "#5eead4";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(jp.x, jp.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText(s.st.name, jp.x + 9, jp.y + 4);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const comm = snap.comm;
  const glMs = snap.globalLinkRemainMs;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 헤더 */}
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          aria-label="플레이 화면으로 돌아가기"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-lg"
        >
          ←
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold leading-tight">관제 센터</h2>
          <p className="text-[10px] tracking-[0.25em] text-teal-300/70">
            JOOPS MISSION CONTROL
          </p>
        </div>
        <time className="text-xs tabular-nums text-white/50">
          {new Date(snap.now).toLocaleTimeString("ko-KR", { hour12: false })}
        </time>
      </header>

      {/* 지도 */}
      <div ref={boxRef} className="relative w-full shrink-0 aspect-2/1 max-h-[46dvh] bg-[#04101f]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* 범례 */}
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-[10px] text-white/45 border-b border-white/10">
        <span className="text-teal-300">— 예정 궤적</span>
        <span>┄ 지나온 궤적</span>
        <span className={glMs > 0 ? "text-amber-300" : "text-emerald-300"}>
          ◌ 교신 반경
        </span>
        <span>⌂ 보호자 위치</span>
      </div>

      {/* 정보 카드 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-2 gap-2 sm:max-w-2xl sm:mx-auto">
          <div className="rounded-2xl bg-white/[.05] p-3.5">
            <p className="text-[10px] text-white/45">현재 위치</p>
            <p className="mt-1 font-bold tabular-nums">{formatLatLon(snap.pos)}</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              고도 {ORBIT.altitudeKm}km · {ORBIT.groundSpeedKms}km/s
            </p>
          </div>
          <div className="rounded-2xl bg-white/[.05] p-3.5">
            <p className="text-[10px] text-white/45">지금 지나는 곳</p>
            <p className="mt-1 font-bold">{snap.region.name}</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              {snap.region.isLand ? "육지 상공 통과 중" : "해상 통과 중"}
            </p>
          </div>
          <div
            className={`rounded-2xl p-3.5 ${
              comm.active
                ? "bg-emerald-400/10 border border-emerald-300/30"
                : "bg-white/[.05]"
            }`}
          >
            <p className="text-[10px] text-white/45">
              {snap.st.home.label} 상공 도달
            </p>
            <p className={`mt-1 font-bold ${comm.active ? "text-emerald-300" : ""}`}>
              {comm.active ? "지금 교신 중!" : formatEta(comm.etaSec)}
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              현재 거리 {Math.round(comm.distanceKm).toLocaleString()}km
            </p>
          </div>
          <div className="rounded-2xl bg-white/[.05] p-3.5">
            <p className="text-[10px] text-white/45">교신 반경</p>
            <p className={`mt-1 font-bold ${glMs > 0 ? "text-amber-300" : ""}`}>
              {glMs > 0 ? "전 지구" : `${comm.rangeKm.toLocaleString()}km`}
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              {glMs > 0
                ? `글로벌 링크 ${Math.ceil(glMs / 60000)}분 남음`
                : `${snap.branchDef?.name ?? snap.stage.name} · 진화하면 넓어져요`}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[.05] p-3.5">
            <p className="text-[10px] text-white/45">청소 실적</p>
            <p className="mt-1 font-bold text-teal-300">
              {snap.st.debrisCleaned.toLocaleString()}개
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              조우 {snap.st.encounters}회 · 충돌 {snap.st.collisions}회
            </p>
          </div>
          <div className="rounded-2xl bg-white/[.05] p-3.5">
            <p className="text-[10px] text-white/45">궤도 정보</p>
            <p className="mt-1 font-bold">주기 {Math.round(ORBIT.periodSec / 60)}분</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              경사각 {ORBIT.inclinationDeg}° 원궤도
            </p>
          </div>
        </div>
        <p className="mt-3 pb-2 text-center text-[11px] text-white/35">
          접속하지 않는 동안에도 {snap.st.name}는 이 궤도를 돌며 청소를 계속해요 🛰️
        </p>
      </div>
    </div>
  );
}
