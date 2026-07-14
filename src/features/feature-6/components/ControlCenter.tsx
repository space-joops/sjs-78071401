"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GLOBAL_BOOST_DURATION_MS, HOME_BOOST_MULTIPLIER, ORBIT_PERIOD_MS } from "../constants";
import { countryAt, koreanCountryName, loadWorld, project, unproject } from "../lib/geo";
import { expProgress, homeRadiusKm, stageForLevel } from "../lib/level";
import { etaToHomeMs, formatEta, groundTrack, joopsPositionAt } from "../lib/orbit";
import type { SaveData, WorldData } from "../types";

type Props = {
  save: SaveData;
  updateSave: (fn: (s: SaveData) => SaveData) => void;
  now: number;
};

const MAP_W = 1440;
const MAP_H = 720;

function buildBaseMap(world: WorldData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext("2d")!;
  // 심해 그라데이션 배경
  const bg = ctx.createLinearGradient(0, 0, 0, MAP_H);
  bg.addColorStop(0, "#0a1230");
  bg.addColorStop(0.5, "#0b1a3d");
  bg.addColorStop(1, "#0a1230");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  // 위경도 그리드
  ctx.strokeStyle = "rgba(120, 160, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let lng = -150; lng <= 150; lng += 30) {
    const [x] = project(lng, 0, MAP_W, MAP_H);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP_H);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(0, lat, MAP_W, MAP_H);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_W, y);
    ctx.stroke();
  }
  // 대륙(국가 폴리곤)
  ctx.fillStyle = "#1d3a35";
  ctx.strokeStyle = "rgba(140, 220, 190, 0.35)";
  ctx.lineWidth = 0.8;
  for (const c of world.countries) {
    for (const ring of c.r) {
      ctx.beginPath();
      ring.forEach(([lng, lat], i) => {
        const [x, y] = project(lng, lat, MAP_W, MAP_H);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // 은은한 구름 레이어
  for (let i = 0; i < 26; i++) {
    const x = ((i * 733) % MAP_W) + ((i * 191) % 60);
    const y = ((i * 397) % MAP_H) * 0.9 + 30;
    const r = 26 + ((i * 53) % 48);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export default function ControlCenter({ save, updateSave, now }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const stateRef = useRef({ save, pinMode });
  stateRef.current = { save, pinMode };

  const { level } = expProgress(save.joops.exp);
  const stage = stageForLevel(level);
  const radiusKm = homeRadiusKm(level);
  const joopsPos = joopsPositionAt(now);
  const eta = etaToHomeMs(now, save.home, radiusKm);
  const boostLeft = save.boostUntil - now;
  const countryEn = world ? countryAt(world, joopsPos) : null;

  useEffect(() => {
    let cancelled = false;
    loadWorld()
      .then((w) => {
        if (cancelled) return;
        setWorld(w);
        baseRef.current = buildBaseMap(w);
      })
      .catch(() => setGeoMsg("지도 데이터를 불러오지 못했어요."));
    return () => {
      cancelled = true;
    };
  }, []);

  // 지도 렌더 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.width * 0.5 * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      if (W === 0) return;
      const t = Date.now();
      const s = stateRef.current.save;
      const lvl = expProgress(s.joops.exp).level;
      const rKm = homeRadiusKm(lvl);

      if (baseRef.current) {
        ctx.drawImage(baseRef.current, 0, 0, W, H);
      } else {
        ctx.fillStyle = "#0b1a3d";
        ctx.fillRect(0, 0, W, H);
      }

      const toXY = (lng: number, lat: number) => project(lng, lat, W, H);

      // 지면 궤적: 다가올 한 바퀴
      const track = groundTrack(t, ORBIT_PERIOD_MS, 260);
      ctx.strokeStyle = "rgba(94, 234, 212, 0.55)";
      ctx.lineWidth = Math.max(1, W / 900);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      let prevX: number | null = null;
      for (const p of track) {
        const [x, y] = toXY(p.lng, p.lat);
        if (prevX !== null && Math.abs(x - prevX) > W / 2) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else if (prevX === null) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        prevX = x;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 지나온 궤적(3분)
      const trail = groundTrack(t - 3 * 60 * 1000, 3 * 60 * 1000, 60);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.beginPath();
      prevX = null;
      for (const p of trail) {
        const [x, y] = toXY(p.lng, p.lat);
        if (prevX !== null && Math.abs(x - prevX) > W / 2) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else if (prevX === null) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        prevX = x;
      }
      ctx.stroke();

      // 내 위치(홈) + 상공 반경
      if (s.home) {
        const [hx, hy] = toXY(s.home.lng, s.home.lat);
        const degLat = rKm / 111.32;
        const degLng =
          rKm / (111.32 * Math.max(0.2, Math.cos((s.home.lat * Math.PI) / 180)));
        const ry = (degLat / 180) * H;
        const rx = (degLng / 360) * W;
        ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
        ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
        ctx.lineWidth = Math.max(1, W / 1000);
        ctx.beginPath();
        ctx.ellipse(hx, hy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(3, W / 320), 0, Math.PI * 2);
        ctx.fill();
      }

      // 줍스 실시간 위치 (펄스)
      const jp = joopsPositionAt(t);
      const [jx, jy] = toXY(jp.lng, jp.lat);
      const pulse = (performance.now() / 600) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(125, 211, 252, 0.8)";
      ctx.lineWidth = Math.max(1, W / 800);
      ctx.beginPath();
      ctx.arc(jx, jy, (Math.sin(pulse) * 0.5 + 1) * Math.max(6, W / 110), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.arc(jx, jy, Math.max(3.5, W / 260), 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const handleMapClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!stateRef.current.pinMode) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const p = unproject(
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height
      );
      const home = {
        lat: Math.round(p.lat * 100) / 100,
        lng: Math.round(p.lng * 100) / 100,
      };
      updateSave((s) => ({ ...s, home }));
      setPinMode(false);
      setGeoMsg("지도 핀으로 내 위치를 설정했어요. 📍");
    },
    [updateSave]
  );

  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoMsg("이 기기에서는 GPS를 사용할 수 없어요. 지도 핀으로 설정해 주세요.");
      return;
    }
    setGeoMsg("GPS 위치를 확인하는 중…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const home = {
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lng: Math.round(pos.coords.longitude * 100) / 100,
        };
        updateSave((s) => ({ ...s, home }));
        setGeoMsg("GPS로 내 위치를 설정했어요. 🛰️");
      },
      () => {
        setGeoMsg("GPS 권한이 거부됐어요. 지도 핀으로 설정해 주세요.");
      },
      { timeout: 10000 }
    );
  }, [updateSave]);

  const useGlobalBoost = useCallback(() => {
    updateSave((s) => {
      if (s.items.globalBoost <= 0) return s;
      return {
        ...s,
        items: { ...s.items, globalBoost: s.items.globalBoost - 1 },
        boostUntil: Date.now() + GLOBAL_BOOST_DURATION_MS,
      };
    });
  }, [updateSave]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-3 sm:p-6">
        {/* 지도 */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between bg-white/5 px-3 py-2">
            <p className="text-xs font-bold tracking-widest text-teal-300">
              JOOPS MISSION CONTROL
            </p>
            <button
              onClick={() => setPinMode((v) => !v)}
              className={`flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors ${
                pinMode
                  ? "bg-amber-400 text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              📍 {pinMode ? "지도를 탭하세요" : "핀 찍기"}
            </button>
          </div>
          <canvas
            ref={canvasRef}
            onClick={handleMapClick}
            className={`block aspect-[2/1] w-full touch-manipulation ${
              pinMode ? "cursor-crosshair" : ""
            }`}
          />
        </div>

        {geoMsg && (
          <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
            {geoMsg}
          </p>
        )}

        {/* ETA 카드 */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          {!save.home ? (
            <>
              <p className="text-sm font-bold">내 위치가 설정되지 않았어요</p>
              <p className="mt-1 text-xs text-white/60">
                GPS 또는 지도 핀으로 위치를 설정하면, 줍스가 내 상공을 지날 때
                보상 x{HOME_BOOST_MULTIPLIER} 부스트를 받아요!
              </p>
            </>
          ) : eta === 0 ? (
            <>
              <p className="text-xs text-white/60">홈 스카이 부스트</p>
              <p className="mt-1 animate-pulse text-2xl font-bold text-amber-300">
                🏠 지금 내 상공 통과 중! x{HOME_BOOST_MULTIPLIER}
              </p>
              <p className="mt-1 text-xs text-white/60">
                지금 비행하면 보상이 {HOME_BOOST_MULTIPLIER}배!
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-white/60">내 상공 도달까지 (ETA)</p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-teal-300">
                {eta !== null ? formatEta(eta) : "--:--"}
              </p>
              {eta !== null && (
                <p className="mt-1 text-xs text-white/50">
                  다음 통과:{" "}
                  {new Date(now + eta).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              )}
            </>
          )}
        </div>

        {/* 정보 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] text-white/50">현재 상공</p>
            <p className="mt-1 truncate text-sm font-bold">
              {world ? koreanCountryName(countryEn) : "확인 중…"}
            </p>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-white/50">
              {joopsPos.lat.toFixed(1)}°, {joopsPos.lng.toFixed(1)}°
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] text-white/50">내 상공 인정 반경</p>
            <p className="mt-1 text-sm font-bold">{radiusKm.toLocaleString()} km</p>
            <p className="mt-1 text-[10px] text-white/50">
              진화·성장할수록 넓어져요
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] text-white/50">줍스 현황</p>
            <p className="mt-1 text-sm font-bold">
              {stage.emoji} {stage.name} Lv.{level}
            </p>
            <p className="mt-1 text-[10px] text-white/50">
              누적 청소 {save.joops.debrisCleaned.toLocaleString()}개 · 인사{" "}
              {save.joops.greetCount}회
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] text-white/50">전 지구적 상공 효과</p>
            {boostLeft > 0 ? (
              <p className="mt-1 text-sm font-bold text-amber-300">
                발동 중 {formatEta(boostLeft)}
              </p>
            ) : (
              <button
                onClick={useGlobalBoost}
                disabled={save.items.globalBoost <= 0}
                className="mt-1 h-11 w-full rounded-xl bg-amber-400/90 text-xs font-bold text-black transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
              >
                🌐 사용 ({save.items.globalBoost}개 보유)
              </button>
            )}
            <p className="mt-1 text-[10px] text-white/50">
              10분간 어디서든 x{HOME_BOOST_MULTIPLIER} 부스트
            </p>
          </div>
        </div>

        {/* 위치 설정 */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-bold">📍 내 위치 (Home Location)</p>
          <p className="mt-1 text-xs text-white/60">
            {save.home
              ? `설정됨: ${save.home.lat}°, ${save.home.lng}°`
              : "아직 설정되지 않았어요."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleGps}
              className="h-12 flex-1 rounded-xl bg-sky-500 text-sm font-bold transition-colors hover:bg-sky-400"
            >
              🛰️ GPS로 설정
            </button>
            <button
              onClick={() => setPinMode(true)}
              className="h-12 flex-1 rounded-xl bg-white/10 text-sm font-bold transition-colors hover:bg-white/20"
            >
              📍 지도에 핀 찍기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
