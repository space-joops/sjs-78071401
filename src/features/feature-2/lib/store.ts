// 줍스 영속 상태 저장소.
// - localStorage에 저장, 모듈 싱글턴 + useSyncExternalStore로 구독
// - 접속하지 않은 동안의 청소·조우·사고를 결정적 난수로 시뮬레이션 (요구사항 8)

import { useSyncExternalStore } from "react";
import { idleRates, levelFromXp, maxTierForLevel } from "./gameConfig";
import { mulberry32 } from "./rng";

const KEY = "sjs:feature-2:joops-save:v1";

export type OwnerLoc = { lat: number; lon: number; label: string };

export type SaveState = {
  v: 1;
  name: string;
  createdAt: number;
  lastSeenAt: number;
  epochMs: number; // 궤도 기준 시각 — 위치는 항상 이 값과 현재 시각으로 계산
  xp: number;
  hp: number; // 0..100
  energy: number; // 0..100 (추진 연료 = 먹이)
  snacks: number;
  quantumCapsules: number;
  quantumUntil: number; // 퀀텀 링크(전 지구 교신) 만료 시각
  shieldUntil: number;
  magnetUntil: number;
  petCooldownUntil: number;
  cleanedCount: number;
  cleanedMassKg: number;
  encounters: number;
  careNeeded: boolean;
  muted: boolean;
  introSeen: boolean;
  owner: OwnerLoc;
};

export type OfflineReport = {
  hours: number;
  cleaned: number;
  massKg: number;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  encounters: number;
  hazardHits: number;
  snacks: number;
  careNeeded: boolean;
};

let state: SaveState | null = null;
let version = 0;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): SaveState | null {
  return state;
}

export function useSave(): SaveState | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  );
  return state;
}

/** 상태 변경은 반드시 이 함수로 — 구독자 알림 + 저장 예약 */
export function mutate(fn: (s: SaveState) => void): void {
  if (!state) return;
  fn(state);
  emit();
  if (saveTimer == null) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist();
    }, 2000);
  }
}

export function persist(): void {
  if (!state || typeof window === "undefined") return;
  state.lastSeenAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 공간 부족 등 — 게임은 계속 진행
  }
}

function createNew(now: number): SaveState {
  return {
    v: 1,
    name: "줍스",
    createdAt: now,
    lastSeenAt: now,
    // 랜덤 위상에서 궤도 시작 (모두 같은 자리에서 출발하면 재미없으니까)
    epochMs: now - Math.floor(Math.random() * 5520_000),
    xp: 0,
    hp: 100,
    energy: 90,
    snacks: 3,
    quantumCapsules: 1,
    quantumUntil: 0,
    shieldUntil: 0,
    magnetUntil: 0,
    petCooldownUntil: 0,
    cleanedCount: 0,
    cleanedMassKg: 0,
    encounters: 0,
    careNeeded: false,
    muted: false,
    introSeen: false,
    owner: { lat: 37.55, lon: 126.98, label: "서울" },
  };
}

/** 부재 시간 동안의 자동 청소 시뮬레이션 (1시간 단위, 최대 72시간 반영) */
function simulateOffline(s: SaveState, now: number): OfflineReport | null {
  const elapsedMs = now - s.lastSeenAt;
  if (elapsedMs < 5 * 60_000) return null; // 5분 미만은 리포트 생략

  const hours = Math.min(elapsedMs / 3600_000, 72);
  const rng = mulberry32(Math.floor(s.lastSeenAt / 1000) % 2 ** 31);
  const levelBefore = levelFromXp(s.xp);

  let cleaned = 0;
  let mass = 0;
  let xpGain = 0;
  let encounters = 0;
  let hazardHits = 0;
  let snackGain = 0;
  let cleanedAcc = 0;

  let remaining = hours;
  while (remaining > 0) {
    const dt = Math.min(1, remaining);
    remaining -= dt;
    if (s.careNeeded) break; // 다친 줍스는 주인의 치료를 기다리며 표류

    const rates = idleRates(levelFromXp(s.xp + xpGain));
    const lowPower = s.energy <= 5;
    const rate = rates.piecesPerHour * (lowPower ? 0.2 : 1);
    if (!lowPower) s.energy = Math.max(0, s.energy - 3 * dt);

    const got = rate * dt;
    cleaned += got;
    cleanedAcc += got;
    mass += got * rates.massPerPiece;
    xpGain += got * rates.xpPerPiece;
    // 먹은 만큼 소화 에너지 회복 (완전 방전은 드물게)
    s.energy = Math.min(100, s.energy + got * 0.06);

    while (cleanedAcc >= 25) {
      cleanedAcc -= 25;
      snackGain++;
    }
    if (rng() < 0.22 * dt) {
      encounters++;
      xpGain += 40;
    }
    if (rng() < 0.06 * dt) {
      hazardHits++;
      s.hp = Math.max(5, s.hp - (8 + rng() * 18));
      if (s.hp < 25) s.careNeeded = true;
    }
  }

  s.cleanedCount += Math.round(cleaned);
  s.cleanedMassKg += mass;
  s.xp += Math.round(xpGain);
  s.encounters += encounters;
  s.snacks += snackGain;

  return {
    hours,
    cleaned: Math.round(cleaned),
    massKg: mass,
    xp: Math.round(xpGain),
    levelBefore,
    levelAfter: levelFromXp(s.xp),
    encounters,
    hazardHits,
    snacks: snackGain,
    careNeeded: s.careNeeded,
  };
}

export function loadOrCreate(): {
  isNew: boolean;
  report: OfflineReport | null;
} {
  if (state) return { isNew: false, report: null };
  const now = Date.now();
  let loaded: SaveState | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveState;
      if (parsed && parsed.v === 1) loaded = parsed;
    }
  } catch {
    loaded = null;
  }
  if (!loaded) {
    state = createNew(now);
    emit();
    persist();
    return { isNew: true, report: null };
  }
  state = loaded;
  const report = simulateOffline(state, now);
  state.lastSeenAt = now;
  emit();
  persist();
  return { isNew: false, report };
}

export function resetSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
  state = createNew(Date.now());
  state.introSeen = true;
  emit();
  persist();
}

// ---- 파생 헬퍼 ----

export function levelOf(s: SaveState): number {
  return levelFromXp(s.xp);
}

export function maxTierOf(s: SaveState): number {
  return maxTierForLevel(levelFromXp(s.xp));
}

export function isQuantumActive(s: SaveState, now: number): boolean {
  return s.quantumUntil > now;
}
