import { EARTH_R_KM } from "./constants";
import type { OrbitParams, OwnerLoc } from "./types";

const DEG = Math.PI / 180;
/** 지구 자전 각속도(deg/s, 항성일 기준) */
const EARTH_OMEGA = 360 / 86164;

export const normLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

export type GroundPoint = { lat: number; lon: number };

/** 원궤도 지상궤적 — 시각 tMs에 줍스가 지나는 지표면 좌표 */
export function groundPoint(orbit: OrbitParams, tMs: number): GroundPoint {
  const t = (tMs - orbit.epoch) / 1000;
  const u = orbit.phase0 + (2 * Math.PI * t) / orbit.periodSec;
  const inc = orbit.incDeg * DEG;
  const lat = Math.asin(Math.sin(inc) * Math.sin(u)) / DEG;
  const lonInPlane = Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)) / DEG;
  const lon = normLon(orbit.lon0 + lonInPlane - EARTH_OMEGA * t);
  return { lat, lon };
}

export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = (lat2 - lat1) * DEG;
  const dl = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 시각 tMs에 주인 상공(coverageKm 반경) 안에 있는가 */
export function isInContact(
  orbit: OrbitParams,
  owner: OwnerLoc,
  coverageKm: number,
  tMs: number,
) {
  if (!Number.isFinite(coverageKm)) return true; // 전지구 부스터
  const g = groundPoint(orbit, tMs);
  return greatCircleKm(g.lat, g.lon, owner.lat, owner.lon) <= coverageKm;
}

export type ContactWindow = { start: number; end: number };

/**
 * fromMs 이후의 교신 창을 탐색한다(20초 스텝, 최대 horizonMs).
 * 이미 교신 중이면 start는 fromMs가 된다.
 */
export function nextContact(
  orbit: OrbitParams,
  owner: OwnerLoc,
  coverageKm: number,
  fromMs: number,
  horizonMs = 36 * 3600 * 1000,
): ContactWindow | null {
  if (!Number.isFinite(coverageKm)) {
    return { start: fromMs, end: fromMs + horizonMs };
  }
  const step = 20_000;
  const limit = fromMs + horizonMs;
  let t = fromMs;
  if (!isInContact(orbit, owner, coverageKm, t)) {
    while (t < limit && !isInContact(orbit, owner, coverageKm, t)) t += step;
    if (t >= limit) return null;
  }
  const start = t === fromMs ? fromMs : t - step / 2;
  let end = t;
  while (end < limit && isInContact(orbit, owner, coverageKm, end)) end += step;
  return { start, end };
}

/** 다가오는 교신 창 count개 */
export function contactWindows(
  orbit: OrbitParams,
  owner: OwnerLoc,
  coverageKm: number,
  fromMs: number,
  count: number,
): ContactWindow[] {
  const out: ContactWindow[] = [];
  let t = fromMs;
  for (let i = 0; i < count; i++) {
    const w = nextContact(orbit, owner, coverageKm, t);
    if (!w) break;
    out.push(w);
    t = w.end + 60_000;
    if (!Number.isFinite(coverageKm)) break;
  }
  return out;
}

/**
 * 지상궤적 좌표열 — 날짜변경선을 넘는 지점에서 세그먼트를 분리해
 * 지도에 그릴 수 있는 형태로 반환한다.
 */
export function trackSegments(
  orbit: OrbitParams,
  fromMs: number,
  toMs: number,
  stepSec = 60,
): GroundPoint[][] {
  const segs: GroundPoint[][] = [];
  let cur: GroundPoint[] = [];
  let prev: GroundPoint | null = null;
  for (let t = fromMs; t <= toMs; t += stepSec * 1000) {
    const p = groundPoint(orbit, t);
    if (prev && Math.abs(p.lon - prev.lon) > 180) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push(p);
    prev = p;
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

/** 중심점에서 radiusKm 떨어진 소원(小圓) 좌표열 — 교신 범위 표시용 */
export function circlePoints(
  lat: number,
  lon: number,
  radiusKm: number,
  n = 90,
): GroundPoint[] {
  const d = radiusKm / EARTH_R_KM;
  const p = lat * DEG;
  const l = lon * DEG;
  const pts: GroundPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const brg = (i / n) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(brg),
    );
    const lon2 =
      l +
      Math.atan2(
        Math.sin(brg) * Math.sin(d) * Math.cos(p),
        Math.cos(d) - Math.sin(p) * Math.sin(lat2),
      );
    pts.push({ lat: lat2 / DEG, lon: normLon(lon2 / DEG) });
  }
  return pts;
}

/** 태양 직하점(대략) — 주야 경계선(터미네이터) 표시용 */
export function subsolarPoint(tMs: number): GroundPoint {
  const d = new Date(tMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const dayOfYear = (tMs - start) / 86400000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours =
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lon = normLon(180 - utcHours * 15);
  return { lat: decl, lon };
}
