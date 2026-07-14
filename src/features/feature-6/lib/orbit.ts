import {
  ORBIT_EPOCH_MS,
  ORBIT_INCLINATION_DEG,
  ORBIT_PERIOD_MS,
  ORBIT_WESTWARD_DRIFT_DEG,
} from "../constants";
import type { GeoPoint } from "../types";

export const EARTH_RADIUS_KM = 6371;

export function wrapLng(lng: number): number {
  let x = ((lng + 180) % 360 + 360) % 360;
  x -= 180;
  return x;
}

/**
 * 시각 t(ms)의 줍스 지면 궤적 위치.
 * 절대 시각의 순수 함수이므로 오프라인 중에도 위치가 이어진다(영속성).
 */
export function joopsPositionAt(t: number): GeoPoint {
  const dt = t - ORBIT_EPOCH_MS;
  const orbits = dt / ORBIT_PERIOD_MS;
  const phase = orbits * 2 * Math.PI;
  const lat = ORBIT_INCLINATION_DEG * Math.sin(phase);
  // 궤도 진행(동쪽) - 지구 자전에 의한 서향 표류
  const lng = wrapLng(orbits * 360 - orbits * ORBIT_WESTWARD_DRIFT_DEG);
  return { lat, lng };
}

/** 하버사인 거리(km) */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function isOverHome(
  t: number,
  home: GeoPoint | null,
  radiusKm: number
): boolean {
  if (!home) return false;
  return distanceKm(joopsPositionAt(t), home) <= radiusKm;
}

/**
 * 다음 '내 상공' 진입까지 남은 시간(ms).
 * 현재 상공 안이면 0. 24시간 내 진입이 없으면 null.
 */
export function etaToHomeMs(
  now: number,
  home: GeoPoint | null,
  radiusKm: number
): number | null {
  if (!home) return null;
  if (isOverHome(now, home, radiusKm)) return 0;
  const stepMs = 5000;
  const horizonMs = 24 * 60 * 60 * 1000;
  for (let dt = stepMs; dt <= horizonMs; dt += stepMs) {
    if (isOverHome(now + dt, home, radiusKm)) {
      // 5초 스텝 안에서 이분 탐색으로 정밀화
      let lo = dt - stepMs;
      let hi = dt;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (isOverHome(now + mid, home, radiusKm)) hi = mid;
        else lo = mid;
      }
      return Math.round(hi);
    }
  }
  return null;
}

/** 지면 궤적 샘플(경도 점프 처리는 그리는 쪽에서) */
export function groundTrack(
  from: number,
  durationMs: number,
  samples: number
): GeoPoint[] {
  const pts: GeoPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    pts.push(joopsPositionAt(from + (durationMs * i) / samples));
  }
  return pts;
}

export function formatEta(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
