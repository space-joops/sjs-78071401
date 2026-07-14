// localStorage 저장 — 스키마 v1. 실패(사파리 프라이빗 모드 등)는 조용히 무시한다.
import { EVOLUTION_THRESHOLDS, type RunStats } from "./constants";

const KEY = "sjs:feature-11:swarm:v1";

export type SwarmSave = {
  v: 1;
  best: number;
  totalCollected: number;
  bestCombo: number;
  plays: number;
  muted: boolean;
  updatedAt: number;
};

const DEFAULT_SAVE: SwarmSave = {
  v: 1,
  best: 0,
  totalCollected: 0,
  bestCombo: 0,
  plays: 0,
  muted: false,
  updatedAt: 0,
};

export function loadSave(): SwarmSave {
  if (typeof window === "undefined") return { ...DEFAULT_SAVE };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<SwarmSave> | null;
    if (!parsed || parsed.v !== 1) return { ...DEFAULT_SAVE };
    return {
      v: 1,
      best: toNum(parsed.best),
      totalCollected: toNum(parsed.totalCollected),
      bestCombo: toNum(parsed.bestCombo),
      plays: toNum(parsed.plays),
      muted: parsed.muted === true,
      updatedAt: toNum(parsed.updatedAt),
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

function toNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function persist(save: SwarmSave): void {
  try {
    save.updatedAt = Date.now();
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // 저장 불가 환경 — 게임은 계속 진행
  }
}

/** 누적 수거량 → 진화 단계(0~3) */
export function stageFor(total: number): number {
  let stage = 0;
  for (let i = 0; i < EVOLUTION_THRESHOLDS.length; i++) {
    if (total >= EVOLUTION_THRESHOLDS[i]) stage = i;
  }
  return stage;
}

/** 다음 진화까지 남은 수거량. 최종 단계면 null */
export function nextEvolutionAt(total: number): number | null {
  const stage = stageFor(total);
  if (stage >= EVOLUTION_THRESHOLDS.length - 1) return null;
  return EVOLUTION_THRESHOLDS[stage + 1];
}

/** 판 도중 이탈(pagehide) 시 수거량만 중간 플러시 */
export function addCollected(n: number): void {
  if (n <= 0) return;
  const save = loadSave();
  save.totalCollected += n;
  persist(save);
}

export function saveMuted(muted: boolean): void {
  const save = loadSave();
  save.muted = muted;
  persist(save);
}

export type RunMergeResult = {
  save: SwarmSave;
  isRecord: boolean;
  /** 이번 판 시작 시점의 진화 단계 */
  evolvedFrom: number;
  /** 병합 후 진화 단계 */
  evolvedTo: number;
};

/**
 * 게임오버 시 런 결과를 저장에 병합한다.
 * alreadyFlushed: pagehide로 이미 반영된 이번 판 수거량(이중 합산 방지).
 */
export function mergeRun(stats: RunStats, alreadyFlushed: number): RunMergeResult {
  const save = loadSave();
  const isRecord = stats.score > save.best && stats.score > 0;
  save.best = Math.max(save.best, stats.score);
  save.bestCombo = Math.max(save.bestCombo, stats.bestCombo);
  save.plays += 1;
  save.totalCollected += Math.max(0, stats.collected - alreadyFlushed);
  persist(save);
  // 판 시작 시점 누적 = 최종 누적 - 이번 판 전체 수거량
  const evolvedFrom = stageFor(save.totalCollected - stats.collected);
  const evolvedTo = stageFor(save.totalCollected);
  return { save, isRecord, evolvedFrom, evolvedTo };
}
