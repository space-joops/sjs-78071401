// 줍스의 궤도 역학 — 위치가 시간의 순수 함수라서 접속하지 않아도 궤도를 돈다 (요구사항 8, 9)

export const EARTH_RADIUS_KM = 6371;
export const ORBIT_ALT_KM = 420;
export const ORBIT_PERIOD_S = 5520; // 92분 (ISS급 저궤도)
export const INCLINATION_DEG = 51.6;
export const GROUND_SPEED_KMS = 7.66;
const SIDEREAL_DAY_S = 86164;

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type GroundPoint = { lat: number; lon: number };

export function normalizeLon(lon: number): number {
  let l = ((lon + 180) % 360 + 360) % 360 - 180;
  if (l === -180) l = 180;
  return l;
}

/** t(ms) 시점의 지상 궤적점(위도/경도, deg). 원형 경사 궤도 + 지구 자전 반영 */
export function groundTrack(tMs: number, epochMs: number): GroundPoint {
  const t = (tMs - epochMs) / 1000;
  const th = (2 * Math.PI * t) / ORBIT_PERIOD_S;
  const inc = INCLINATION_DEG * D2R;
  const lat = Math.asin(Math.sin(inc) * Math.sin(th)) * R2D;
  const lonInertial = Math.atan2(Math.cos(inc) * Math.sin(th), Math.cos(th)) * R2D;
  const lon = normalizeLon(lonInertial - (360 * t) / SIDEREAL_DAY_S);
  return { lat, lon };
}

/** 대권 거리(km) */
export function greatCircleKm(a: GroundPoint, b: GroundPoint): number {
  const φ1 = a.lat * D2R;
  const φ2 = b.lat * D2R;
  const dφ = (b.lat - a.lat) * D2R;
  const dλ = (b.lon - a.lon) * D2R;
  const h =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInRange(
  tMs: number,
  epochMs: number,
  owner: GroundPoint,
  radiusKm: number
): boolean {
  return greatCircleKm(groundTrack(tMs, epochMs), owner) <= radiusKm;
}

/**
 * 다음 주인 상공 도달 시각(ms). 이미 상공이면 현재 시각 반환.
 * 30초 간격으로 최대 48시간 탐색 후 1초 정밀도로 보정.
 */
export function nextPassMs(
  nowMs: number,
  epochMs: number,
  owner: GroundPoint,
  radiusKm: number
): number | null {
  if (isInRange(nowMs, epochMs, owner, radiusKm)) return nowMs;
  const stepMs = 30_000;
  const horizon = 48 * 3600_000;
  for (let dt = stepMs; dt <= horizon; dt += stepMs) {
    if (isInRange(nowMs + dt, epochMs, owner, radiusKm)) {
      // [dt - step, dt] 구간을 1초 단위로 좁힘
      for (let fine = dt - stepMs; fine <= dt; fine += 1000) {
        if (isInRange(nowMs + fine, epochMs, owner, radiusKm)) return nowMs + fine;
      }
      return nowMs + dt;
    }
  }
  return null;
}

/** 지상 궤적 폴리라인 샘플 (관제 화면용) */
export function trackPoints(
  fromMs: number,
  toMs: number,
  stepS: number,
  epochMs: number
): GroundPoint[] {
  const pts: GroundPoint[] = [];
  for (let t = fromMs; t <= toMs; t += stepS * 1000) {
    pts.push(groundTrack(t, epochMs));
  }
  return pts;
}

/** 태양 직하점 근사 (주야 경계선용) */
export function solarSubpoint(tMs: number): GroundPoint {
  const d = new Date(tMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const dayOfYear = (tMs - start) / 86400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours =
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lon = normalizeLon(180 - utcHours * 15);
  return { lat: decl, lon };
}

/** 주인 기준 az 방위각으로 각거리 δ만큼 떨어진 점 (교신 반경 원 그리기용) */
export function destinationPoint(
  origin: GroundPoint,
  distanceKm: number,
  azimuthDeg: number
): GroundPoint {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = azimuthDeg * D2R;
  const φ1 = origin.lat * D2R;
  const λ1 = origin.lon * D2R;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return { lat: φ2 * R2D, lon: normalizeLon(λ2 * R2D) };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "지금";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${sec.toString().padStart(2, "0")}초`;
  return `${sec}초`;
}

export function formatLatLon(p: GroundPoint): string {
  const lat = `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}
