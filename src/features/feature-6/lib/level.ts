import {
  BASE_HOME_RADIUS_KM,
  EVOLUTION_STAGES,
  HOME_RADIUS_PER_LEVEL_KM,
  MAX_LEVEL,
} from "../constants";
import type { EvolutionStage } from "../types";

/** 레벨 l에 도달하기 위해 필요한 누적 경험치 */
export function expForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level - 1, 1.55));
}

export function levelFromExp(exp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(level + 1)) level++;
  return level;
}

export function expProgress(exp: number): {
  level: number;
  current: number;
  needed: number;
} {
  const level = levelFromExp(exp);
  if (level >= MAX_LEVEL) return { level, current: 1, needed: 1 };
  const base = expForLevel(level);
  return { level, current: exp - base, needed: expForLevel(level + 1) - base };
}

export function stageForLevel(level: number): EvolutionStage {
  let stage = EVOLUTION_STAGES[0];
  for (const s of EVOLUTION_STAGES) {
    if (level >= s.minLevel) stage = s;
  }
  return stage;
}

export function maxHpForLevel(level: number): number {
  return 100 + (level - 1) * 10;
}

/** 진화·성장에 따라 확장되는 '내 상공' 반경(km) */
export function homeRadiusKm(level: number): number {
  return BASE_HOME_RADIUS_KM + (level - 1) * HOME_RADIUS_PER_LEVEL_KM;
}
