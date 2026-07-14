// 원궤도 지상궤적(ground track) 계산 유틸.
// 시각(wall clock)만으로 위치가 결정되는 결정론적 모델이라
// 오프라인 진행·관제 화면·플레이 화면이 항상 같은 위치를 공유한다.

import { ORBIT } from "./constants";

export type LatLon = { lat: number; lon: number };

export type OrbitParams = {
  /** 승교점(적도 북상 통과) 시각 */
  epochMs: number;
  /** 승교점 통과 시점의 경도 */
  nodeLonDeg: number;
};

const DEG = Math.PI / 180;
const EARTH_R_KM = 6371;
/** 지구 자전 각속도 (deg/s, 항성일 기준) */
const EARTH_ROT = 360 / 86164;

export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 시각 tMs에서의 지상 직하점 */
export function groundPointAt(tMs: number, orbit: OrbitParams): LatLon {
  const t = (tMs - orbit.epochMs) / 1000;
  const n = (2 * Math.PI) / ORBIT.periodSec;
  const u = n * t; // 승교점 기준 위상각
  const i = ORBIT.inclinationDeg * DEG;
  const lat = Math.asin(clamp(Math.sin(i) * Math.sin(u), -1, 1)) / DEG;
  const lonRel = Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) / DEG;
  const lon = wrapLon(orbit.nodeLonDeg + lonRel - EARTH_ROT * t);
  return { lat, lon };
}

/**
 * 첫 실행 시 줍스가 홈 상공에서 출발하도록 궤도 파라미터를 만든다.
 * (입양 직후 바로 교신이 가능해 첫 플레이 경험이 끊기지 않는다.)
 */
export function makeOrbitOverHome(home: LatLon, nowMs: number): OrbitParams {
  const i = ORBIT.inclinationDeg * DEG;
  const maxLat = ORBIT.inclinationDeg - 0.5;
  const latR = clamp(home.lat, -maxLat, maxLat) * DEG;
  const u0 = Math.asin(clamp(Math.sin(latR) / Math.sin(i), -1, 1)); // 북상 구간
  const n = (2 * Math.PI) / ORBIT.periodSec;
  const tSinceNode = u0 / n;
  const epochMs = nowMs - tSinceNode * 1000;
  const lonRel = Math.atan2(Math.cos(i) * Math.sin(u0), Math.cos(u0)) / DEG;
  const nodeLonDeg = wrapLon(home.lon - lonRel + EARTH_ROT * tSinceNode);
  return { epochMs, nodeLonDeg };
}

/** 대권 거리 (km) */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * 홈 반경(rangeKm) 안으로 들어오기까지 남은 시간(초).
 * 이미 안이면 0, 48시간 내에 없으면 null.
 */
export function nextPassEtaSec(
  nowMs: number,
  orbit: OrbitParams,
  home: LatLon,
  rangeKm: number,
): number | null {
  const stepSec = 20;
  const horizonSec = 48 * 3600;
  for (let s = 0; s <= horizonSec; s += stepSec) {
    const p = groundPointAt(nowMs + s * 1000, orbit);
    if (haversineKm(p, home) <= rangeKm) return s;
  }
  return null;
}

/** [fromSec, toSec] 구간의 지상궤적 샘플 (관제 화면용) */
export function groundTrack(
  nowMs: number,
  orbit: OrbitParams,
  fromSec: number,
  toSec: number,
  stepSec = 30,
): LatLon[] {
  const pts: LatLon[] = [];
  for (let s = fromSec; s <= toSec; s += stepSec) {
    pts.push(groundPointAt(nowMs + s * 1000, orbit));
  }
  return pts;
}

/** origin에서 bearing 방향으로 distKm 떨어진 지점 (교신 반경 원 그리기용) */
export function destinationPoint(
  origin: LatLon,
  bearingDeg: number,
  distKm: number,
): LatLon {
  const d = distKm / EARTH_R_KM;
  const br = bearingDeg * DEG;
  const lat1 = origin.lat * DEG;
  const lon1 = origin.lon * DEG;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 / DEG, lon: wrapLon(lon2 / DEG) };
}

/** 초 → "1시간 23분" / "12분" / "45초" */
export function formatEta(sec: number | null): string {
  if (sec === null) return "48시간 이내 없음";
  if (sec <= 0) return "지금";
  if (sec < 60) return `${Math.round(sec)}초 후`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 후`;
  const h = Math.floor(min / 60);
  return `${h}시간 ${min % 60}분 후`;
}

export function formatLatLon(p: LatLon): string {
  const latH = p.lat >= 0 ? "N" : "S";
  const lonH = p.lon >= 0 ? "E" : "W";
  return `${Math.abs(p.lat).toFixed(1)}°${latH} ${Math.abs(p.lon).toFixed(1)}°${lonH}`;
}
