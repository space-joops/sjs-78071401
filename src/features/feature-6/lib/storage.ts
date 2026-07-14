import {
  OFFLINE_BASE_PER_MIN,
  OFFLINE_CAP_MS,
  OFFLINE_EXP_PER_DEBRIS,
  OFFLINE_PER_LEVEL_PER_MIN,
  OFFLINE_REPORT_MIN_MS,
  SAVE_KEY,
} from "../constants";
import type { OfflineReport, SaveData } from "../types";
import { levelFromExp, maxHpForLevel } from "./level";

export function createNewSave(now: number): SaveData {
  return {
    version: 1,
    createdAt: now,
    lastSeenAt: now,
    joops: {
      name: "줍스",
      exp: 0,
      hp: maxHpForLevel(1),
      stress: 10,
      debrisCleaned: 0,
      greetCount: 0,
    },
    care: null,
    home: null,
    items: { capsules: 3, globalBoost: 1 },
    boostUntil: 0,
  };
}

export function loadSave(now: number): SaveData {
  if (typeof window === "undefined") return createNewSave(now);
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return createNewSave(now);
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1 || !parsed.joops) return createNewSave(now);
    return parsed;
  } catch {
    return createNewSave(now);
  }
}

export function persistSave(save: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 저장 공간 부족 등은 조용히 무시 (게임 진행에는 지장 없음)
  }
}

/**
 * 오프라인(방치) 진행 정산.
 * 앱이 꺼져 있어도 줍스는 궤도를 돌며 청소를 계속한다 — 단, 기능 정지(care) 상태면 제외.
 * 반환값의 report는 표시할 필요가 없을 만큼 짧은 부재면 null.
 */
export function settleOffline(
  save: SaveData,
  now: number
): { save: SaveData; report: OfflineReport | null } {
  const elapsed = Math.max(0, now - save.lastSeenAt);
  const touched: SaveData = { ...save, lastSeenAt: now };
  if (save.care !== null || elapsed < OFFLINE_REPORT_MIN_MS) {
    return { save: touched, report: null };
  }
  const effective = Math.min(elapsed, OFFLINE_CAP_MS);
  const level = levelFromExp(save.joops.exp);
  const perMin = OFFLINE_BASE_PER_MIN + level * OFFLINE_PER_LEVEL_PER_MIN;
  const debris = Math.floor((effective / 60000) * perMin);
  const exp = debris * OFFLINE_EXP_PER_DEBRIS;
  const next: SaveData = {
    ...touched,
    joops: {
      ...save.joops,
      exp: save.joops.exp + exp,
      debrisCleaned: save.joops.debrisCleaned + debris,
    },
  };
  return {
    save: next,
    report: { elapsedMs: elapsed, debrisCleaned: debris, expGained: exp },
  };
}
