"use client";
// 관제 센터 — NASA 위성 관제 화면처럼 펼친 지구 지도 위에
// 줍스의 실시간 위치·궤적·상공 국가·주인 상공 도달 시각을 보여준다(요구 9).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { ORBIT_ALT_KM, ORBIT_INC_DEG, ORBIT_SPEED_KMS, stageForLevel } from "../lib/constants";
import { buildEarthTexture } from "../lib/earthTexture";
import { loadWorld, placeLabel, type WorldData } from "../lib/geo";
import { joopsDataUrl } from "../lib/joopsArt";
import {
  contactWindows,
  groundPoint,
  isInContact,
  subsolarPoint,
  trackSegments,
  type GroundPoint,
} from "../lib/orbit";
import { boosterActive, coverageKmOf } from "../lib/state";
import { circlePoints } from "../lib/orbit";
import type { SaveState } from "../lib/types";
import SpaceBackdrop from "./SpaceBackdrop";

const MW = 1440;
const MH = 720;
const X = (lon: number) => ((lon + 180) / 360) * MW;
const Y = (lat: number) => ((90 - lat) / 180) * MH;
const DEG = Math.PI / 180;

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
const fmtClock = (t: number) =>
  new Date(t).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

/** 경도 연속화(날짜변경선 점프 제거) */
function unwrapLon(pts: GroundPoint[]): { lat: number; lon: number }[] {
  if (!pts.length) return [];
  const out: { lat: number; lon: number }[] = [];
  let prev = pts[0].lon;
  let offset = 0;
  for (const p of pts) {
    let lon = p.lon + offset;
    while (lon - prev > 180) {
      offset -= 360;
      lon -= 360;
    }
    while (prev - lon > 180) {
      offset += 360;
      lon += 360;
    }
    out.push({ lat: p.lat, lon });
    prev = lon;
  }
  return out;
}

function drawNight(ctx: CanvasRenderingContext2D, tMs: number) {
  const ss = subsolarPoint(tMs);
  const decl = Math.abs(ss.lat) < 0.5 ? (ss.lat >= 0 ? 0.5 : -0.5) : ss.lat;
  ctx.beginPath();
  let first = true;
  for (let lon = -180; lon <= 180; lon += 3) {
    const H = (lon - ss.lon) * DEG;
    const latT = Math.atan(-Math.cos(H) / Math.tan(decl * DEG)) / DEG;
    if (first) {
      ctx.moveTo(X(lon), Y(latT));
      first = false;
    } else {
      ctx.lineTo(X(lon), Y(latT));
    }
  }
  // 밤 반구 쪽 가장자리로 닫는다 (δ>0 → 남쪽이 밤 포함)
  const edgeY = decl > 0 ? MH : 0;
  ctx.lineTo(MW, edgeY);
  ctx.lineTo(0, edgeY);
  ctx.closePath();
  ctx.fillStyle = "rgba(1,4,12,0.55)";
  ctx.fill();
}

export default function TrackingScreen() {
  const { save, ready } = useGameState();
  const [now, setNow] = useState(() => Date.now());
  const [world, setWorld] = useState<WorldData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const joopsImgRef = useRef<HTMLImageElement | null>(null);
  const saveRef = useRef<SaveState | null>(null);
  saveRef.current = save;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    loadWorld().then((w) => {
      setWorld(w);
      baseRef.current = buildEarthTexture(w, MW, MH, "console");
    });
  }, []);

  const stageIdx = save ? stageForLevel(save.joops.level).idx : 0;
  useEffect(() => {
    const img = new Image();
    img.src = joopsDataUrl({ stage: stageIdx, mood: "happy" });
    joopsImgRef.current = img;
  }, [stageIdx]);

  // 지도 렌더 루프 — 캔버스는 ready && onboarded 이후에야 마운트된다
  const mapActive = ready && !!save?.onboarded;
  useEffect(() => {
    if (!mapActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = saveRef.current;
      const t = Date.now();
      ctx.clearRect(0, 0, MW, MH);
      if (baseRef.current) {
        ctx.drawImage(baseRef.current, 0, 0);
      } else {
        ctx.fillStyle = "#040d1c";
        ctx.fillRect(0, 0, MW, MH);
      }
      drawNight(ctx, t);
      if (!s || !s.onboarded) return;

      const booster = boosterActive(s, t);
      const coverage = coverageKmOf(s, t);

      // 교신 범위
      if (booster) {
        ctx.fillStyle = "rgba(126,242,216,0.05)";
        ctx.fillRect(0, 0, MW, MH);
        ctx.strokeStyle = "rgba(126,242,216,0.5)";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, MW - 4, MH - 4);
      } else {
        const circle = unwrapLon(circlePoints(s.owner.lat, s.owner.lon, coverage));
        for (const shift of [-360, 0, 360]) {
          ctx.beginPath();
          circle.forEach((p, i) => {
            const px = X(p.lon + shift);
            const py = Y(p.lat);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.fillStyle = "rgba(126,242,216,0.07)";
          ctx.fill();
          ctx.strokeStyle = "rgba(126,242,216,0.45)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 지상 궤적: 지난 45분(실선) + 앞으로 90분(점선)
      const past = trackSegments(s.orbit, t - 45 * 60_000, t, 40);
      const future = trackSegments(s.orbit, t, t + 90 * 60_000, 40);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(126,242,216,0.85)";
      for (const seg of past) {
        ctx.beginPath();
        seg.forEach((p, i) => {
          if (i === 0) ctx.moveTo(X(p.lon), Y(p.lat));
          else ctx.lineTo(X(p.lon), Y(p.lat));
        });
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(126,242,216,0.35)";
      ctx.setLineDash([7, 7]);
      for (const seg of future) {
        ctx.beginPath();
        seg.forEach((p, i) => {
          if (i === 0) ctx.moveTo(X(p.lon), Y(p.lat));
          else ctx.lineTo(X(p.lon), Y(p.lat));
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 주인 관제소 마커
      const ox = X(s.owner.lon);
      const oy = Y(s.owner.lat);
      ctx.font = "22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("📡", ox, oy + 7);
      ctx.font = "bold 15px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(s.owner.city, ox, oy + 26);

      // 줍스 마커 (펄스 링 + 캐릭터)
      const g = groundPoint(s.orbit, t);
      const jx = X(g.lon);
      const jy = Y(g.lat);
      const pulse = ((t % 2000) / 2000) * 26;
      ctx.strokeStyle = `rgba(255,217,94,${1 - pulse / 26})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(jx, jy, 8 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffd95e";
      ctx.beginPath();
      ctx.arc(jx, jy, 4, 0, Math.PI * 2);
      ctx.fill();
      const img = joopsImgRef.current;
      if (img?.complete) ctx.drawImage(img, jx - 16, jy - 44, 32, 35);
      ctx.font = "bold 15px monospace";
      ctx.fillStyle = "#ffd95e";
      ctx.fillText(s.joops.name, jx, jy + 24);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mapActive]);

  // 교신 창 계산(30초마다 갱신)
  const winBucket = Math.floor(now / 30_000);
  const windows = useMemo(() => {
    if (!save?.onboarded) return [];
    return contactWindows(
      save.orbit,
      save.owner,
      coverageKmOf(save, now),
      now,
      3,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.orbit.epoch, save?.owner.city, save?.boosterUntil, save?.joops.level, winBucket]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-white/60">
        <SpaceBackdrop />
        <span className="animate-pulse">관제 콘솔 부팅 중…</span>
      </div>
    );
  }
  if (!save || !save.onboarded) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center text-white">
        <SpaceBackdrop />
        <div className="text-5xl">🐣</div>
        <p className="text-sm text-white/70">아직 줍스가 없어요. 먼저 줍스를 깨워주세요!</p>
        <Link
          href="/features/4"
          className="flex min-h-11 items-center rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold"
        >
          ← 관제소로 돌아가기
        </Link>
      </div>
    );
  }

  const g = groundPoint(save.orbit, now);
  const place = placeLabel(world, g.lon, g.lat);
  const booster = boosterActive(save, now);
  const coverage = coverageKmOf(save, now);
  const inContact = isInContact(save.orbit, save.owner, coverage, now);
  const nextWin = windows[0] ?? null;
  const latStr = `${Math.abs(g.lat).toFixed(1)}°${g.lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(g.lon).toFixed(1)}°${g.lon >= 0 ? "E" : "W"}`;

  return (
    <div className="flex min-h-dvh flex-col bg-[#02060f] text-white">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-[#02060f]/85 px-3 py-2.5 backdrop-blur">
        <Link
          href="/features/4"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg transition hover:bg-white/10"
          aria-label="관제소로 돌아가기"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-mono text-sm font-bold tracking-wider">
            MISSION CONTROL · 관제 센터
          </h1>
          <p className="truncate font-mono text-[10px] text-teal-300/70">
            JOOPS-01 &quot;{save.joops.name}&quot; · LEO {ORBIT_ALT_KM}km · INC{" "}
            {ORBIT_INC_DEG}°
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold ${
            inContact
              ? "border-teal-300/50 bg-teal-300/15 text-teal-200"
              : "border-white/15 bg-white/5 text-white/50"
          }`}
        >
          {inContact ? "● LINK" : "○ NO LINK"}
        </span>
      </header>

      <main className="flex flex-1 flex-col">
        {/* 지도 */}
        <div className="relative w-full border-b border-white/10">
          <canvas
            ref={canvasRef}
            width={MW}
            height={MH}
            className="block w-full"
            style={{ aspectRatio: "2 / 1" }}
          />
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-teal-200/90">
            UTC {new Date(now).toISOString().slice(11, 19)}
          </div>
        </div>

        {/* 정보 패널 */}
        <div className="mx-auto grid w-full max-w-lg gap-3 p-4 pb-10 sm:max-w-2xl sm:grid-cols-2">
          {/* 도달 카운트다운 — 가장 중요한 정보 */}
          <div
            className={`rounded-2xl border p-4 sm:col-span-2 ${
              inContact
                ? "border-teal-300/40 bg-teal-300/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            {booster ? (
              <>
                <div className="text-xs text-amber-200">🌐 전지구 교신 부스터 가동 중</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {fmtCountdown(save.boosterUntil - now)}
                </div>
                <div className="text-[11px] text-white/50">
                  남은 시간 동안 어디서든 교신·돌봄이 가능해요
                </div>
              </>
            ) : inContact && nextWin ? (
              <>
                <div className="text-xs text-teal-200">
                  📡 지금 {save.owner.city} 상공 — 교신 중!
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                  {fmtCountdown(nextWin.end - now)}
                </div>
                <div className="text-[11px] text-white/50">교신 종료까지 남은 시간</div>
              </>
            ) : nextWin ? (
              <>
                <div className="text-xs text-white/60">
                  🛰️ {save.owner.city} 상공 도달까지
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-teal-200">
                  T-{fmtCountdown(nextWin.start - now)}
                </div>
                <div className="text-[11px] text-white/50">
                  도착 예정 {fmtClock(nextWin.start)} · 교신 반경{" "}
                  {Math.round(coverage).toLocaleString()}km
                </div>
              </>
            ) : (
              <div className="text-sm text-white/60">교신 창 계산 중…</div>
            )}
          </div>

          {/* 현재 위치 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] text-white/50">현재 상공</div>
            <div className="mt-1 text-lg font-bold">{place}</div>
            <div className="mt-1 font-mono text-xs text-white/60">
              {latStr} {lonStr}
            </div>
          </div>

          {/* 궤도 정보 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-xs">
            <div className="text-[11px] font-sans text-white/50">궤도 정보</div>
            <div className="mt-1.5 space-y-1 text-white/75">
              <div>ALT {ORBIT_ALT_KM} km · VEL {ORBIT_SPEED_KMS} km/s</div>
              <div>PERIOD 92m 48s · INC {ORBIT_INC_DEG}°</div>
              <div>
                REV{" "}
                {Math.floor(
                  (now - save.orbit.epoch) / (save.orbit.periodSec * 1000),
                ).toLocaleString()}{" "}
                회 공전
              </div>
            </div>
          </div>

          {/* 통과 일정 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
            <div className="text-[11px] text-white/50">
              {save.owner.city} 상공 통과 일정
            </div>
            {booster ? (
              <p className="mt-2 text-sm text-amber-200">
                부스터 가동 중에는 항상 교신 가능해요 🌐
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 font-mono text-xs text-white/75">
                {windows.map((wdw, i) => (
                  <li key={wdw.start} className="flex justify-between tabular-nums">
                    <span>
                      PASS {i + 1} · {fmtClock(wdw.start)} → {fmtClock(wdw.end)}
                    </span>
                    <span className="text-teal-300/80">
                      {Math.max(1, Math.round((wdw.end - wdw.start) / 60000))}분
                    </span>
                  </li>
                ))}
                {windows.length === 0 && <li>36시간 내 통과 없음</li>}
              </ul>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-white/35 sm:col-span-2">
            <span className="text-teal-300/70">─</span> 지난 45분 궤적 ·{" "}
            <span className="text-teal-300/40">┄</span> 앞으로 90분 예상 궤적 · 점선
            원은 교신 가능 범위, 어두운 영역은 밤인 지역이에요. 진화할수록 교신
            반경이 넓어져요.
          </p>
        </div>
      </main>
    </div>
  );
}
