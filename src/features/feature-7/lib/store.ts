// 기능 7: 도감 진행 상태 — localStorage 영속화 + 스캔(발견) 로직
import { CATALOG, RARITY_META, type JunkItem, type Rarity } from "../data/catalog";

const STORAGE_KEY = "sjs:feature-7:archive:v1";

export const MAX_ENERGY = 5;
export const REGEN_MS = 60_000;
export const SCAN_DURATION_MS = 2_600;

export type ArchiveState = {
  /** 발견한 아이템 id → 발견 시각(ms) */
  discovered: Record<string, number>;
  /** 발견 후 아직 상세를 열어 보지 않은 id 목록 (NEW 배지) */
  fresh: string[];
  energy: number;
  lastRegenAt: number;
};

export function createInitialState(): ArchiveState {
  return { discovered: {}, fresh: [], energy: MAX_ENERGY, lastRegenAt: 0 };
}

export function loadState(): ArchiveState {
  if (typeof window === "undefined") return createInitialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<ArchiveState>;
    const known = new Set(CATALOG.map((i) => i.id));
    const discovered: Record<string, number> = {};
    if (parsed.discovered && typeof parsed.discovered === "object") {
      for (const [id, at] of Object.entries(parsed.discovered)) {
        if (known.has(id) && typeof at === "number") discovered[id] = at;
      }
    }
    return {
      discovered,
      fresh: Array.isArray(parsed.fresh)
        ? parsed.fresh.filter((id): id is string => typeof id === "string" && id in discovered)
        : [],
      energy:
        typeof parsed.energy === "number"
          ? Math.min(Math.max(0, Math.floor(parsed.energy)), MAX_ENERGY)
          : MAX_ENERGY,
      lastRegenAt: typeof parsed.lastRegenAt === "number" ? parsed.lastRegenAt : 0,
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state: ArchiveState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패(사파리 프라이빗 모드 등)는 조용히 무시 — 세션 내 상태로만 동작
  }
}

/** 경과 시간만큼 배터리를 충전한다. 변화가 없으면 동일 참조를 반환해 리렌더를 피한다. */
export function applyRegen(state: ArchiveState, now: number): ArchiveState {
  if (state.energy >= MAX_ENERGY) return state;
  const elapsed = now - state.lastRegenAt;
  if (elapsed < REGEN_MS) return state;
  const gained = Math.floor(elapsed / REGEN_MS);
  const energy = Math.min(MAX_ENERGY, state.energy + gained);
  return {
    ...state,
    energy,
    lastRegenAt: energy >= MAX_ENERGY ? now : state.lastRegenAt + gained * REGEN_MS,
  };
}

export function consumeEnergy(state: ArchiveState, now: number): ArchiveState {
  return {
    ...state,
    energy: Math.max(0, state.energy - 1),
    // 완충 상태에서 처음 소모할 때부터 재충전 타이머 시작
    lastRegenAt: state.energy >= MAX_ENERGY ? now : state.lastRegenAt,
  };
}

/** 희귀도 가중 랜덤으로 미발견 아이템 하나를 뽑는다. 모두 발견했으면 null. */
export function pickDiscovery(state: ArchiveState): JunkItem | null {
  const undiscovered = CATALOG.filter((i) => !(i.id in state.discovered));
  if (undiscovered.length === 0) return null;

  const tiers = (Object.keys(RARITY_META) as Rarity[])
    .map((rarity) => ({
      weight: RARITY_META[rarity].weight,
      items: undiscovered.filter((i) => i.rarity === rarity),
    }))
    .filter((t) => t.items.length > 0);

  const totalWeight = tiers.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const tier of tiers) {
    roll -= tier.weight;
    if (roll <= 0) {
      return tier.items[Math.floor(Math.random() * tier.items.length)];
    }
  }
  return tiers[tiers.length - 1].items[0];
}
