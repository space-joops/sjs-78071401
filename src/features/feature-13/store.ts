// 최고기록 영속 — 런 자체는 휘발성이고, 누적 기록만 localStorage에 남는다.
// feature-1/store.ts의 useSyncExternalStore 패턴을 따른다.

import { STORAGE_KEY } from "./constants";

export type Records = {
  version: 1;
  bestScore: number;
  bestLevel: number;
  bestCombo: number;
  totalDebris: number;
  totalRuns: number;
};

const EMPTY: Records = {
  version: 1,
  bestScore: 0,
  bestLevel: 1,
  bestCombo: 0,
  totalDebris: 0,
  totalRuns: 0,
};

export type RunResult = {
  score: number;
  level: number;
  bestCombo: number;
  debris: number;
};

class RecordStore {
  private rec: Records = EMPTY;
  private listeners = new Set<() => void>();
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Records;
        if (parsed && parsed.version === 1) this.rec = { ...EMPTY, ...parsed };
      }
    } catch {
      this.rec = EMPTY;
    }
    this.notify();
  }

  /** 런 종료 — 신기록이면 true */
  submit(run: RunResult): boolean {
    const isBest = run.score > this.rec.bestScore;
    this.rec = {
      version: 1,
      bestScore: Math.max(this.rec.bestScore, run.score),
      bestLevel: Math.max(this.rec.bestLevel, run.level),
      bestCombo: Math.max(this.rec.bestCombo, run.bestCombo),
      totalDebris: this.rec.totalDebris + run.debris,
      totalRuns: this.rec.totalRuns + 1,
    };
    this.save();
    this.notify();
    return isBest;
  }

  reset(): void {
    this.rec = EMPTY;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.notify();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): Records => this.rec;

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rec));
    } catch {}
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

let singleton: RecordStore | null = null;

export function getRecordStore(): RecordStore {
  if (!singleton) singleton = new RecordStore();
  return singleton;
}

export const EMPTY_RECORDS = EMPTY;
