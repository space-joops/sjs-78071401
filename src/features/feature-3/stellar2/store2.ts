// 줍스의 영속 상태 저장소.
// - localStorage에 저장되어 플레이하지 않는 동안에도 줍스는 궤도를 돌며 청소한다.
// - 다시 접속하면 부재 시간을 시뮬레이션해 "부재 중 보고서"를 만든다.
// - React(useSyncExternalStore)와 아케이드 엔진이 같은 스토어를 공유한다.

import {
  CARE,
  GLOBAL_LINK_MS,
  STORAGE_KEY,
  DEBRIS_TIERS,
  BRANCHES,
  BRANCH_LEVEL,
  HATCH_TAPS,
  FORGE_TIERS,
  TECHNO_TIERS,
  TRAIN,
  SHOWER,
  DAILY,
  levelForXp,
  stageForLevel,
  stageIndexForLevel,
  xpForLevel,
  type StageDef,
  type BranchId,
  type BranchDef,
} from "./balance";
import {
  groundPointAt,
  haversineKm,
  makeOrbitOverHome,
  nextPassEtaSec,
  type LatLon,
  type OrbitParams,
} from "../orbit";
import { regionAt, type Region } from "../countries";
import { setMuted } from "./audio";

export type PersistedState = {
  version: 1;
  name: string;
  bornAt: number;
  lastSimAt: number;
  xp: number;
  health: number; // 10~100
  energy: number; // 0~100
  mood: number; // 0~100
  debrisCleaned: number;
  cleanedByTier: number[];
  encounters: number;
  collisions: number;
  globalLinkUntil: number;
  orbit: OrbitParams;
  home: { lat: number; lon: number; label: string };
  careLog: { feedAt: number; repairAt: number; petAt: number };
  /** 알 부화 여부 — 부화 전에는 성장·감소·오프라인 진행이 멈춰 있다 */
  hatched: boolean;
  hatchTaps: number;
  /** 진화 분기 (성체 도달 시 결정) */
  branch: BranchId;
  /** 효과음 음소거 */
  muted: boolean;
  /** 회피 훈련 통계 */
  training: { bestScore: number; count: number; lastAt: number };
  /** 일일 보상을 마지막으로 받은 로컬 날짜 (YYYY-M-D) */
  lastDailyYmd: string;
};

export type AwayReport = {
  awayMs: number;
  debris: number;
  xp: number;
  encounters: number;
  collisions: number;
  healthLost: number;
};

export type CommState = {
  active: boolean;
  viaGlobalLink: boolean;
  distanceKm: number;
  etaSec: number | null;
  rangeKm: number;
};

export type Snapshot = {
  st: PersistedState;
  now: number;
  level: number;
  stageIndex: number;
  stage: StageDef;
  xpInLevel: number;
  xpNeeded: number;
  pos: LatLon;
  region: Region;
  comm: CommState;
  globalLinkRemainMs: number;
  hatched: boolean;
  branch: BranchId;
  branchDef: BranchDef | null;
  muted: boolean;
  showerRemainMs: number;
  hasDaily: boolean;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const localYmd = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export class Stellar2Store {
  private st: PersistedState | null = null;
  private snap: Snapshot | null = null;
  private listeners = new Set<() => void>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;
  awayReport: AwayReport | null = null;
  /** 분기 진화 알림 — UI가 1회 표시 후 ackBranchNotice() */
  branchNotice: BranchDef | null = null;
  /** 일일 보급 수령 대기 여부 */
  pendingDaily = false;
  /** 파편 소나기 종료 시각 (in-memory) */
  private showerUntil = 0;

  /** 클라이언트에서 1회 호출. 저장분이 있으면 부재 시뮬레이션까지 수행. */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed && parsed.version === 1 && parsed.orbit) {
          // 초기 클론 세이브 호환: 부화/분기 필드 기본값 보강
          parsed.hatched = parsed.hatched ?? true;
          parsed.hatchTaps = parsed.hatchTaps ?? HATCH_TAPS;
          parsed.branch = parsed.branch ?? "none";
          parsed.muted = parsed.muted ?? false;
          parsed.training = parsed.training ?? { bestScore: 0, count: 0, lastAt: 0 };
          parsed.lastDailyYmd = parsed.lastDailyYmd ?? "";
          setMuted(parsed.muted);
          this.st = parsed;
          this.awayReport = this.simulateAway(Date.now());
        }
      }
    } catch {
      this.st = null;
    }
    if (this.st) {
      this.startTicking();
      this.checkDaily();
    }
    this.notify();
  }

  hasPet(): boolean {
    return this.st !== null;
  }

  create(name: string, home: { lat: number; lon: number; label: string }): void {
    const now = Date.now();
    this.st = {
      version: 1,
      name: name.trim() || "줍스",
      bornAt: now,
      lastSimAt: now,
      xp: 0,
      health: 100,
      energy: 80,
      mood: 90,
      debrisCleaned: 0,
      cleanedByTier: [0, 0, 0, 0, 0],
      encounters: 0,
      collisions: 0,
      globalLinkUntil: 0,
      orbit: makeOrbitOverHome(home, now),
      home,
      careLog: { feedAt: 0, repairAt: 0, petAt: 0 },
      hatched: false,
      hatchTaps: 0,
      branch: "none",
      muted: false,
      training: { bestScore: 0, count: 0, lastAt: 0 },
      lastDailyYmd: "",
    };
    setMuted(false);
    this.awayReport = null;
    this.save();
    this.startTicking();
    this.notify();
  }

  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.st = null;
    this.awayReport = null;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.notify();
  }

  dismissAwayReport(): void {
    this.awayReport = null;
    this.notify();
  }

  ackBranchNotice(): void {
    this.branchNotice = null;
    this.notify();
  }

  toggleMuted(): void {
    if (!this.st) return;
    this.st.muted = !this.st.muted;
    setMuted(this.st.muted);
    this.scheduleSave();
    this.notify();
  }

  /** 회피 훈련 결과 반영 — 성적이 스탯·성장에 반영된다 */
  applyTraining(score: number): { xpGained: number; isBest: boolean } {
    if (!this.st || !this.st.hatched) return { xpGained: 0, isBest: false };
    const gained = Math.round(score * TRAIN.xpPerScore * this.xpMult());
    this.st.xp += gained;
    this.st.mood = clamp(this.st.mood + TRAIN.moodGain, 0, 100);
    this.st.energy = clamp(this.st.energy - TRAIN.energyCost, 5, 100);
    const isBest = score > this.st.training.bestScore;
    if (isBest) this.st.training.bestScore = score;
    this.st.training.count += 1;
    this.st.training.lastAt = Date.now();
    this.checkBranch();
    this.scheduleSave();
    this.notify();
    return { xpGained: gained, isBest };
  }

  trainCooldownRemainMs(now: number): number {
    if (!this.st) return 0;
    return Math.max(0, TRAIN.cooldownMs - (now - this.st.training.lastAt));
  }

  /** 알 두드리기 — HATCH_TAPS회 채우면 부화 */
  tapEgg(): void {
    if (!this.st || this.st.hatched) return;
    this.st.hatchTaps += 1;
    if (this.st.hatchTaps >= HATCH_TAPS) {
      this.st.hatched = true;
      this.st.mood = 100;
      this.st.energy = Math.max(this.st.energy, 80);
      this.checkDaily();
    }
    this.scheduleSave();
    this.notify();
  }

  /** 날짜가 바뀐 뒤 첫 접속이면 일일 보급 대기 상태로 */
  private checkDaily(): void {
    if (!this.st || !this.st.hatched) return;
    if (localYmd(Date.now()) !== this.st.lastDailyYmd) this.pendingDaily = true;
  }

  /** 일일 보급 수령 */
  claimDaily(): { energy: number; xp: number; globalLinkMin: number } | null {
    if (!this.st || !this.pendingDaily) return null;
    const now = Date.now();
    this.st.energy = clamp(this.st.energy + DAILY.energy, 0, 100);
    this.st.xp += DAILY.xp;
    this.st.globalLinkUntil = Math.max(this.st.globalLinkUntil, now + DAILY.globalLinkMs);
    this.st.lastDailyYmd = localYmd(now);
    this.pendingDaily = false;
    this.checkBranch();
    this.scheduleSave();
    this.notify();
    return {
      energy: DAILY.energy,
      xp: DAILY.xp,
      globalLinkMin: Math.round(DAILY.globalLinkMs / 60000),
    };
  }

  /** 파편 소나기 시작 (아케이드 엔진이 호출) */
  startShower(): void {
    this.showerUntil = Date.now() + SHOWER.durationSec * 1000;
    this.notify();
  }

  // ---- React 바인딩 ----
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): Snapshot | null => this.snap;

  // ---- 게임 이벤트 (아케이드 엔진에서 호출) ----

  /** 쓰레기 흡수. 실제 획득 XP를 돌려준다 (교신 중 ×2). */
  eatDebris(tier: number): number {
    if (!this.st || !this.st.hatched) return 0;
    const def = DEBRIS_TIERS[tier - 1];
    if (!def) return 0;
    const mult = this.currentComm().active ? 2 : 1;
    const showerMult = Date.now() < this.showerUntil ? SHOWER.xpMult : 1;
    const gained = Math.round(def.xp * mult * this.xpMult() * showerMult);
    this.st.xp += gained;
    this.st.energy = clamp(this.st.energy + def.energy, 0, 100);
    this.st.mood = clamp(this.st.mood + 1, 0, 100);
    this.st.debrisCleaned += 1;
    this.st.cleanedByTier[tier - 1] = (this.st.cleanedByTier[tier - 1] ?? 0) + 1;
    this.checkBranch();
    this.scheduleSave();
    this.notify();
    return gained;
  }

  /** 처리 불가 물체·위성과 충돌 */
  collide(damage: number): void {
    if (!this.st || !this.st.hatched) return;
    const mult = this.st.branch !== "none" ? BRANCHES[this.st.branch].collideMult : 1;
    this.st.health = clamp(this.st.health - Math.round(damage * mult), 10, 100);
    this.st.mood = clamp(this.st.mood - 6, 0, 100);
    this.st.collisions += 1;
    this.scheduleSave();
    this.notify();
  }

  /** 다른 줍스와 조우 */
  encounter(): number {
    if (!this.st || !this.st.hatched) return 0;
    const mult = this.currentComm().active ? 2 : 1;
    const gained = Math.round(25 * mult * this.xpMult());
    this.st.xp += gained;
    this.st.mood = clamp(this.st.mood + 12, 0, 100);
    this.st.encounters += 1;
    this.checkBranch();
    this.scheduleSave();
    this.notify();
    return gained;
  }

  /** 글로벌 링크 코어 획득 → 일정 시간 전 지구 교신 */
  pickGlobalItem(): void {
    if (!this.st) return;
    this.st.globalLinkUntil = Date.now() + GLOBAL_LINK_MS;
    this.scheduleSave();
    this.notify();
  }

  // ---- 보살핌 (교신 중에만 가능) ----

  care(kind: "feed" | "repair" | "pet"): { ok: boolean; reason?: string } {
    if (!this.st) return { ok: false, reason: "줍스가 없어요" };
    if (!this.currentComm().active)
      return { ok: false, reason: "교신 범위 밖이에요" };
    const now = Date.now();
    const log = this.st.careLog;
    const def = CARE[kind];
    const lastAt =
      kind === "feed" ? log.feedAt : kind === "repair" ? log.repairAt : log.petAt;
    if (now - lastAt < def.cooldownMs) return { ok: false, reason: "잠시 후에 다시" };

    if (kind === "feed") {
      this.st.energy = clamp(this.st.energy + CARE.feed.energy, 0, 100);
      log.feedAt = now;
    } else if (kind === "repair") {
      this.st.health = clamp(this.st.health + CARE.repair.health, 10, 100);
      log.repairAt = now;
    } else {
      this.st.mood = clamp(this.st.mood + CARE.pet.mood, 0, 100);
      log.petAt = now;
    }
    this.st.xp += def.xp;
    this.checkBranch();
    this.scheduleSave();
    this.notify();
    return { ok: true };
  }

  careCooldownRemainMs(kind: "feed" | "repair" | "pet", now: number): number {
    if (!this.st) return 0;
    const log = this.st.careLog;
    const lastAt =
      kind === "feed" ? log.feedAt : kind === "repair" ? log.repairAt : log.petAt;
    return Math.max(0, CARE[kind].cooldownMs - (now - lastAt));
  }

  saveNow(): void {
    this.save();
  }

  // ---- 내부 ----

  private startTicking(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  /** 1초마다: 완만한 상태 변화 + 스냅샷 갱신 */
  private xpMult(): number {
    if (!this.st || this.st.branch === "none") return 1;
    return BRANCHES[this.st.branch].xpMult;
  }

  /** 성체(BRANCH_LEVEL) 도달 시 먹은 쓰레기 재질 비율로 진화 분기 */
  private checkBranch(): void {
    const st = this.st;
    if (!st || st.branch !== "none" || !st.hatched) return;
    if (levelForXp(st.xp) < BRANCH_LEVEL) return;
    const sum = (tiers: number[]) =>
      tiers.reduce((acc, t) => acc + (st.cleanedByTier[t - 1] ?? 0), 0);
    const branch = sum(FORGE_TIERS) >= sum(TECHNO_TIERS) ? "forge" : "techno";
    st.branch = branch;
    this.branchNotice = BRANCHES[branch];
  }

  private tick(): void {
    if (!this.st) return;
    if (!this.st.hatched) {
      // 알은 시간이 흘러도 지치지 않는다
      this.st.lastSimAt = Date.now();
      this.notify();
      return;
    }
    const dtH = 1 / 3600;
    this.st.energy = clamp(this.st.energy - 4 * dtH, 5, 100);
    this.st.mood = clamp(this.st.mood - 3 * dtH, 10, 100);
    if (this.st.energy > 60) this.st.health = clamp(this.st.health + 6 * dtH, 10, 100);
    this.st.lastSimAt = Date.now();
    this.scheduleSave(15_000);
    this.notify();
  }

  /** 부재 중 자율 청소 시뮬레이션 */
  private simulateAway(nowMs: number): AwayReport | null {
    if (!this.st) return null;
    if (!this.st.hatched) {
      this.st.lastSimAt = nowMs;
      return null;
    }
    const awayMs = Math.max(0, nowMs - this.st.lastSimAt);
    this.st.lastSimAt = nowMs;
    if (awayMs < 5 * 60 * 1000) return null; // 5분 미만이면 보고서 생략

    const hours = Math.min(awayMs / 3_600_000, 72); // 72시간까지만 적립
    const level = levelForXp(this.st.xp);
    const vigor = 0.5 + this.st.energy / 200; // 에너지가 높을수록 부지런히 청소
    const debris = Math.floor(hours * (5 + level * 1.2) * vigor);
    const xp = debris * 6;
    const encounters = Math.floor(hours * 0.35 + Math.random() * 0.9);
    const collisions = Math.floor(hours * 0.12 + Math.random() * 0.6);
    const healthLost = Math.min(collisions * 7, Math.max(0, this.st.health - 15));

    this.st.debrisCleaned += debris;
    // 자율 비행은 낮은 등급 위주로 청소
    this.st.cleanedByTier[0] += Math.ceil(debris * 0.5);
    this.st.cleanedByTier[1] += Math.floor(debris * 0.3);
    this.st.cleanedByTier[2] += Math.floor(debris * 0.2);
    this.st.xp += xp + encounters * 25;
    this.st.encounters += encounters;
    this.st.collisions += collisions;
    this.st.health = clamp(this.st.health - healthLost, 15, 100);
    this.st.energy = clamp(this.st.energy - hours * 4 + debris * 0.35, 15, 100);
    this.st.mood = clamp(this.st.mood - hours * 2, 20, 100);
    this.save();

    return {
      awayMs,
      debris,
      xp: xp + encounters * 25,
      encounters,
      collisions,
      healthLost,
    };
  }

  private currentComm(): CommState {
    const now = Date.now();
    if (!this.st) {
      return { active: false, viaGlobalLink: false, distanceKm: 0, etaSec: null, rangeKm: 0 };
    }
    const stage = stageForLevel(levelForXp(this.st.xp));
    const pos = groundPointAt(now, this.st.orbit);
    const dist = haversineKm(pos, this.st.home);
    const viaGlobalLink = this.st.globalLinkUntil > now;
    const inRange = dist <= stage.rangeKm;
    const active = inRange || viaGlobalLink;
    return {
      active,
      viaGlobalLink: viaGlobalLink && !inRange,
      distanceKm: dist,
      etaSec: active ? 0 : nextPassEtaSec(now, this.st.orbit, this.st.home, stage.rangeKm),
      rangeKm: stage.rangeKm,
    };
  }

  private notify(): void {
    this.snap = this.computeSnapshot();
    for (const fn of this.listeners) fn();
  }

  private computeSnapshot(): Snapshot | null {
    if (!this.st) return null;
    const now = Date.now();
    const level = levelForXp(this.st.xp);
    const stage = stageForLevel(level);
    const pos = groundPointAt(now, this.st.orbit);
    return {
      st: this.st,
      now,
      level,
      stageIndex: stageIndexForLevel(level),
      stage,
      xpInLevel: this.st.xp - xpForLevel(level),
      xpNeeded: xpForLevel(level + 1) - xpForLevel(level),
      pos,
      region: regionAt(pos.lat, pos.lon),
      comm: this.currentComm(),
      globalLinkRemainMs: Math.max(0, this.st.globalLinkUntil - now),
      hatched: this.st.hatched,
      branch: this.st.branch,
      branchDef: this.st.branch !== "none" ? BRANCHES[this.st.branch] : null,
      muted: this.st.muted,
      showerRemainMs: Math.max(0, this.showerUntil - now),
      hasDaily: this.pendingDaily,
    };
  }

  private scheduleSave(delayMs = 2000): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, delayMs);
  }

  private save(): void {
    if (!this.st) return;
    this.st.lastSimAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.st));
    } catch {}
  }
}

let singleton: Stellar2Store | null = null;

export function getStellar2Store(): Stellar2Store {
  if (!singleton) singleton = new Stellar2Store();
  return singleton;
}
