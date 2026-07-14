"use client";

// 관제 모드 — NASA 위성 관제 화면처럼 전개된 지구 지도 위에
// 줍스의 궤도·현재 위치·통과 국가·주인 상공 도달 시각을 보여준다 (요구사항 9).

import { useEffect, useRef, useState } from "react";
import { coverageRadiusKm, levelFromXp, QUANTUM_LINK_MINUTES } from "../lib/gameConfig";
import {
  destinationPoint,
  formatCountdown,
  formatLatLon,
  GROUND_SPEED_KMS,
  groundTrack,
  INCLINATION_DEG,
  isInRange,
  nextPassMs,
  ORBIT_ALT_KM,
  ORBIT_PERIOD_S,
  solarSubpoint,
  trackPoints,
} from "../lib/orbit";
import type { EarthTextures } from "../lib/earthTexture";
import { TEX_W, TEX_H } from "../lib/earthTexture";
import type { Country } from "../lib/geo";
import { placeNameAt } from "../lib/geo";
import { isQuantumActive, mutate, useSave } from "../lib/store";

export default function TrackerView({
  textures,
  countries,
}: {
  textures: EarthTextures;
  countries: Country[] | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const save = useSave();
  const [now, setNow] = useState(() => Date.now());
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const etaRef = useRef<{ key: string; value: number | null }>({ key: "", value: null });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ---- 지도 렌더링 ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !save) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastDraw = 0;

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      if (ts - lastDraw < 66) return; // ~15fps면 충분
      lastDraw = ts;

      const cssW = canvas.clientWidth;
      const cssH = cssW / 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = cssW;
      const h = cssH;
      const X = (lon: number) => ((lon + 180) / 360) * w;
      const Y = (lat: number) => ((90 - lat) / 180) * h;
      const tNow = Date.now();
      const anim = ts / 1000;

      ctx.drawImage(textures.map, 0, 0, TEX_W, TEX_H, 0, 0, w, h);
      ctx.fillStyle = "rgba(2,8,23,0.3)";
      ctx.fillRect(0, 0, w, h);

      // 경위선
      ctx.strokeStyle = "rgba(148,163,184,0.16)";
      ctx.lineWidth = 0.5;
      for (let lon = -150; lon <= 150; lon += 30) {
        ctx.beginPath();
        ctx.moveTo(X(lon), 0);
        ctx.lineTo(X(lon), h);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        ctx.moveTo(0, Y(lat));
        ctx.lineTo(w, Y(lat));
        ctx.stroke();
      }

      // 주야 경계 (밤 영역 음영)
      const sun = solarSubpoint(tNow);
      const d2r = Math.PI / 180;
      const sunLat = Math.abs(sun.lat) < 0.3 ? (sun.lat < 0 ? -0.3 : 0.3) : sun.lat;
      ctx.beginPath();
      for (let lon = -180; lon <= 180; lon += 3) {
        const latT =
          Math.atan(-Math.cos((lon - sun.lon) * d2r) / Math.tan(sunLat * d2r)) / d2r;
        const x = X(lon);
        const y = Y(latT);
        if (lon === -180) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // 태양 반대편 극 쪽으로 폐합
      const darkPoleY = sun.lat > 0 ? h : 0;
      ctx.lineTo(w, darkPoleY);
      ctx.lineTo(0, darkPoleY);
      ctx.closePath();
      ctx.fillStyle = "rgba(2,6,23,0.42)";
      ctx.fill();

      // 궤적 폴리라인 (경도 랩에서 분절)
      const strokeTrack = (
        pts: { lat: number; lon: number }[],
        style: string,
        width: number,
        dash: number[]
      ) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        let prevX: number | null = null;
        for (const p of pts) {
          const x = X(p.lon);
          const y = Y(p.lat);
          if (prevX !== null && Math.abs(x - prevX) > w / 2) {
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
      };
      strokeTrack(
        trackPoints(tNow - 45 * 60_000, tNow, 30, save.epochMs),
        "rgba(103,232,249,0.55)",
        1.6,
        []
      );
      strokeTrack(
        trackPoints(tNow, tNow + 90 * 60_000, 30, save.epochMs),
        "rgba(226,232,240,0.5)",
        1.2,
        [4, 5]
      );

      // 주인 위치 + 교신 반경 (요구사항 10)
      const radius = coverageRadiusKm(levelFromXp(save.xp));
      const quantum = isQuantumActive(save, tNow);
      if (quantum) {
        const a = 0.35 + 0.25 * Math.sin(anim * 3);
        ctx.strokeStyle = `rgba(52,211,153,${a})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
      } else {
        const circle = [];
        for (let az = 0; az <= 360; az += 5) {
          circle.push(destinationPoint(save.owner, radius, az));
        }
        strokeTrack(circle, "rgba(52,211,153,0.7)", 1.4, [3, 3]);
      }
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(X(save.owner.lon), Y(save.owner.lat), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(209,250,229,0.95)";
      ctx.fillText(`📍 ${save.owner.label}`, X(save.owner.lon), Y(save.owner.lat) - 8);

      // 줍스 현재 위치 (펄스 마커)
      const g = groundTrack(tNow, save.epochMs);
      const gx = X(g.lon);
      const gy = Y(g.lat);
      const pulse = (anim % 1.6) / 1.6;
      ctx.strokeStyle = `rgba(125,211,252,${1 - pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gx, gy, 5 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#e0f2fe";
      ctx.beginPath();
      ctx.arc(gx, gy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "rgba(224,242,254,0.95)";
      ctx.fillText("👾", gx, gy - 10);

      if (picking) {
        const a = 0.5 + 0.3 * Math.sin(anim * 4);
        ctx.strokeStyle = `rgba(253,224,71,${a})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [textures, save, picking]);

  if (!save) return null;

  const level = levelFromXp(save.xp);
  const radius = coverageRadiusKm(level);
  const quantum = isQuantumActive(save, now);
  const g = groundTrack(now, save.epochMs);
  const place = placeNameAt(g.lon, g.lat, countries);
  const inRange = quantum || isInRange(now, save.epochMs, save.owner, radius);

  // ETA 캐시 (지났으면 재계산)
  const etaKey = `${save.owner.lat.toFixed(2)},${save.owner.lon.toFixed(2)},${radius}`;
  if (
    etaRef.current.key !== etaKey ||
    (etaRef.current.value !== null && etaRef.current.value < now - 1000)
  ) {
    etaRef.current = {
      key: etaKey,
      value: nextPassMs(now, save.epochMs, save.owner, radius),
    };
  }
  const eta = etaRef.current.value;

  const handlePick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picking) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lon = ((e.clientX - rect.left) / rect.width) * 360 - 180;
    const lat = 90 - ((e.clientY - rect.top) / rect.height) * 180;
    const label = placeNameAt(lon, lat, countries).name;
    mutate((s) => {
      s.owner = { lat, lon, label };
    });
    etaRef.current.key = "";
    setPicking(false);
    setNotice(`주인 위치를 '${label}'(으)로 설정했어요 📍`);
    setTimeout(() => setNotice(null), 3000);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setNotice("이 브라우저에서는 위치를 가져올 수 없어요");
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude } = p.coords;
        const label = placeNameAt(longitude, latitude, countries).name;
        mutate((s) => {
          s.owner = { lat: latitude, lon: longitude, label };
        });
        etaRef.current.key = "";
        setNotice(`내 위치(${label})로 설정했어요 📍`);
        setTimeout(() => setNotice(null), 3000);
      },
      () => {
        setNotice("위치 권한을 확인해주세요");
        setTimeout(() => setNotice(null), 3000);
      }
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-3 sm:p-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <canvas
            ref={canvasRef}
            onClick={handlePick}
            className={`block aspect-[2/1] w-full ${picking ? "cursor-crosshair" : ""}`}
          />
          {quantum && (
            <span className="absolute left-2 top-2 rounded-full bg-emerald-500/80 px-2.5 py-1 text-[11px] font-semibold text-white">
              🌐 퀀텀 링크 — 전 지구 교신 중 (
              {formatCountdown(save.quantumUntil - now)} 남음)
            </span>
          )}
          {picking && (
            <span className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-yellow-400/90 px-3 py-1 text-[11px] font-semibold text-black">
              지도를 탭해서 주인 위치를 지정하세요
            </span>
          )}
        </div>

        {notice && (
          <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-center text-xs text-emerald-300">
            {notice}
          </p>
        )}

        {/* 다음 교신 카드 */}
        <div
          className={`rounded-2xl border p-4 ${
            inRange
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-white/10 bg-white/[.04]"
          }`}
        >
          {inRange ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">📡</span>
              <div>
                <p className="text-sm font-bold text-emerald-300">
                  지금 {save.name}와 교신할 수 있어요!
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  돌봄이 가능하고 플레이 경험치가 2배예요
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛰️</span>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">
                  {save.owner.label} 상공 도달까지
                </p>
                <p className="text-lg font-bold tabular-nums text-white">
                  {eta === null ? "48시간 내 없음" : formatCountdown(eta - now)}
                </p>
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            교신 반경 {radius.toLocaleString()}km · 레벨이 오르면 넓어져요
            {!quantum && save.quantumCapsules > 0 && (
              <> · 🔮 퀀텀 링크 캡슐로 {QUANTUM_LINK_MINUTES}분간 전 지구 교신 가능</>
            )}
          </p>
        </div>

        {/* 현재 상태 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <p className="text-[11px] text-slate-500">현재 상공</p>
            <p className="mt-1 text-sm font-bold text-white">
              {place.isLand ? "🌍" : "🌊"} {place.name}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-slate-400">{formatLatLon(g)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <p className="text-[11px] text-slate-500">궤도 정보</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-white">
              고도 {ORBIT_ALT_KM}km
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-slate-400">
              속도 {GROUND_SPEED_KMS}km/s · 경사 {INCLINATION_DEG}° · 주기{" "}
              {Math.round(ORBIT_PERIOD_S / 60)}분
            </p>
          </div>
        </div>

        {/* 주인 위치 설정 */}
        <div className="flex gap-2">
          <button
            onClick={useMyLocation}
            className="h-11 flex-1 rounded-xl border border-white/15 bg-white/[.06] text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[.12]"
          >
            📍 내 위치로 설정
          </button>
          <button
            onClick={() => setPicking((p) => !p)}
            className={`h-11 flex-1 rounded-xl border text-xs font-semibold transition-colors ${
              picking
                ? "border-yellow-400/60 bg-yellow-400/20 text-yellow-200"
                : "border-white/15 bg-white/[.06] text-slate-200 hover:bg-white/[.12]"
            }`}
          >
            🗺️ 지도 탭해서 설정{picking ? " (취소)" : ""}
          </button>
        </div>

        <p className="pb-2 text-center text-[11px] leading-relaxed text-slate-600">
          줍스는 접속하지 않는 동안에도 이 궤도를 따라 지구를 돌며 청소해요.
          실선은 지나온 길(45분), 점선은 앞으로 갈 길(90분)이에요.
        </p>
      </div>
    </div>
  );
}
