// 줍줍스2 스토어 — v1 JoopsStore를 포크해 콤보·니어미스·일일 미션·스트릭을 얹었다.
//
// v1과의 격리: storageKey를 생성자로 주입하고(STORAGE_KEY_V2) version을 2로 올린다.
// 두 게임의 세이브가 구조적으로 섞일 수 없다.

import {
  CARE,
  DEBRIS_TIERS,
  GLOBAL_LINK_MS,
  STORAGE_KEY_V2,
  STREAK,
  V2_SETTINGS_DEFAULT,
  levelForXp,
  stageForLevel,
  stageIndexForLevel,
  xpForLevel,
  type StageDef,
} from "./constants";
import {
  groundPointAt,
  haversineKm,
  makeOrbitOverHome,
  nextPassEtaSec,
  type LatLon,
  type OrbitParams,
} from "../orbit";
import { regionAt, type Region } from "../countries";
import { bumpMission, dayKeyOf, rollMissions, type DailyMission } from "./missions";

export type V2Settings = typeof V2_SETTINGS_DEFAULT;

export type PersistedStateV2 = {
  version: 2;
  name: string;
  bornAt: number;
  lastSimAt: number;
  xp: number;
  health: number;
  energy: number;
  mood: number;
  debrisCleaned: number;
  cleanedByTier: number[];
  encounters: number;
  collisions: number;
  globalLinkUntil: number;
  orbit: OrbitParams;
  home: { lat: number; lon: number; label: string };
  careLog: { feedAt: number; repairAt: number; petAt: number };
  // ---- v2 신규 ----
  bestCombo: number;
  nearMisses: number;
  streak: { count: number; best: number; lastDayKey: string };
  daily: { dayKey: string; missions: DailyMission[] };
  settings: V2Settings;
};

export type AwayReportV2 = {
  awayMs: number;
  debris: number;
  xp: number;
  encounters: number;
  collisions: number;
  healthLost: number;
  streakDelta: number;
  streakCount: number;
  giftedLink: boolean;
};

export type CommState = {
  active: boolean;
  viaGlobalLink: boolean;
  distanceKm: number;
  etaSec: number | null;
  rangeKm: number;
};

export type SnapshotV2 = {
  st: PersistedStateV2;
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
  /** 접속 스트릭 XP 배수 */
  streakMult: number;
  missionsDone: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class JoopsStoreV2 {
  private st: PersistedStateV2 | null = null;
  private snap: SnapshotV2 | null = null;
  private listeners = new Set<() => void>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;
  awayReport: AwayReportV2 | null = null;
  /** 이번 세션에 완료된 미션 (토스트용) */
  justCompleted: DailyMission[] = [];

  constructor(private readonly storageKey: string = STORAGE_KEY_V2) {}

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedStateV2;
        if (parsed && parsed.version === 2 && parsed.orbit) {
          this.st = parsed;
          // 구버전에서 넘어온 필드 보정
          this.st.settings = { ...V2_SETTINGS_DEFAULT, ...(parsed.settings ?? {}) };
          this.awayReport = this.simulateAway(Date.now());
        }
      }
    } catch {
      this.st = null;
    }
    if (this.st) this.startTicking();
    this.notify();
  }

  hasPet(): boolean {
    return this.st !== null;
  }

  create(name: string, home: { lat: number; lon: number; label: string }): void {
    const now = Date.now();
    const dayKey = dayKeyOf(now);
    this.st = {
      version: 2,
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
      bestCombo: 0,
      nearMisses: 0,
      streak: { count: 1, best: 1, lastDayKey: dayKey },
      daily: { dayKey, missions: rollMissions(dayKey) },
      settings: { ...V2_SETTINGS_DEFAULT },
    };
    this.awayReport = null;
    this.save();
    this.startTicking();
    this.notify();
  }

  reset(): void {
    try {
      localStorage.removeItem(this.storageKey);
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

  // ---- React 바인딩 ----
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SnapshotV2 | null => this.snap;

  // ---- 설정 ----
  setSetting<K extends keyof V2Settings>(key: K, value: V2Settings[K]): void {
    if (!this.st) return;
    this.st.settings = { ...this.st.settings, [key]: value };
    this.scheduleSave();
    this.notify();
  }

  getSettings(): V2Settings {
    return this.st?.settings ?? V2_SETTINGS_DEFAULT;
  }

  // ---- 게임 이벤트 ----

  /** 쓰레기 흡수. 교신(×2) · 콤보 배수 · 스트릭 배수를 모두 곱해 획득 XP를 돌려준다. */
  eatDebris(tier: number, comboMult = 1): number {
    if (!this.st) return 0;
    const def = DEBRIS_TIERS[tier - 1];
    if (!def) return 0;
    const commMult = this.currentComm().active ? 2 : 1;
    const gained = Math.round(def.xp * commMult * comboMult * this.streakMult());
    this.st.xp += gained;
    this.st.energy = clamp(this.st.energy + def.energy, 0, 100);
    this.st.mood = clamp(this.st.mood + 1, 0, 100);
    this.st.debrisCleaned += 1;
    this.st.cleanedByTier[tier - 1] = (this.st.cleanedByTier[tier - 1] ?? 0) + 1;

    this.bump("eat", 1);
    if (tier >= 3) this.bump("tier", 1);

    this.scheduleSave();
    this.notify();
    return gained;
  }

  collide(damage: number): void {
    if (!this.st) return;
    this.st.health = clamp(this.st.health - damage, 10, 100);
    this.st.mood = clamp(this.st.mood - 6, 0, 100);
    this.st.collisions += 1;
    this.scheduleSave();
    this.notify();
  }

  encounter(): number {
    if (!this.st) return 0;
    const mult = this.currentComm().active ? 2 : 1;
    const gained = Math.round(25 * mult * this.streakMult());
    this.st.xp += gained;
    this.st.mood = clamp(this.st.mood + 12, 0, 100);
    this.st.encounters += 1;
    this.scheduleSave();
    this.notify();
    return gained;
  }

  /** 위성을 충돌 없이 아슬아슬하게 스침 */
  noteNearMiss(xp: number): number {
    if (!this.st) return 0;
    const mult = this.currentComm().active ? 2 : 1;
    const gained = Math.round(xp * mult * this.streakMult());
    this.st.xp += gained;
    this.st.nearMisses += 1;
    this.bump("nearMiss", 1);
    this.scheduleSave();
    this.notify();
    return gained;
  }

  /** 콤보 최고치 기록 */
  noteCombo(combo: number): void {
    if (!this.st) return;
    if (combo > this.st.bestCombo) this.st.bestCombo = combo;
    this.bump("combo", combo, true);
    this.scheduleSave();
    this.notify();
  }

  pickGlobalItem(): void {
    if (!this.st) return;
    this.st.globalLinkUntil = Date.now() + GLOBAL_LINK_MS;
    this.scheduleSave();
    this.notify();
  }

  // ---- 보살핌 ----

  care(kind: "feed" | "repair" | "pet"): { ok: boolean; reason?: string } {
    if (!this.st) return { ok: false, reason: "줍스가 없어요" };
    if (!this.currentComm().active) return { ok: false, reason: "교신 범위 밖이에요" };
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
    this.bump("care", 1);
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

  setHome(home: { lat: number; lon: number; label: string }): void {
    if (!this.st) return;
    this.st.home = home;
    this.scheduleSave();
    this.notify();
  }

  /** 완료된 미션 보상 수령 */
  claimMission(id: string): number {
    if (!this.st) return 0;
    const m = this.st.daily.missions.find((x) => x.id === id);
    if (!m || !m.done || m.claimed) return 0;
    m.claimed = true;
    this.st.xp += m.rewardXp;
    this.scheduleSave();
    this.notify();
    return m.rewardXp;
  }

  takeJustCompleted(): DailyMission[] {
    const out = this.justCompleted;
    this.justCompleted = [];
    return out;
  }

  saveNow(): void {
    this.save();
  }

  // ---- 내부 ----

  private bump(id: DailyMission["id"], amount: number, absolute = false): void {
    if (!this.st) return;
    const done = bumpMission(this.st.daily.missions, id, amount, absolute);
    if (done) this.justCompleted.push(done);
  }

  private streakMult(): number {
    if (!this.st) return 1;
    return Math.min(
      STREAK.maxMult,
      1 + (this.st.streak.count - 1) * STREAK.multPerDay,
    );
  }

  private startTicking(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    if (!this.st) return;
    const dtH = 1 / 3600;
    this.st.energy = clamp(this.st.energy - 4 * dtH, 5, 100);
    this.st.mood = clamp(this.st.mood - 3 * dtH, 10, 100);
    if (this.st.energy > 60) this.st.health = clamp(this.st.health + 6 * dtH, 10, 100);
    this.st.lastSimAt = Date.now();
    this.rollDailyIfNeeded(Date.now());
    this.scheduleSave(15_000);
    this.notify();
  }

  /** 자정을 넘겼으면 미션을 새로 뽑는다 */
  private rollDailyIfNeeded(nowMs: number): boolean {
    if (!this.st) return false;
    const key = dayKeyOf(nowMs);
    if (this.st.daily.dayKey === key) return false;
    this.st.daily = { dayKey: key, missions: rollMissions(key) };
    return true;
  }

  /** 접속 스트릭 갱신. 늘어난 일수를 돌려준다 */
  private updateStreak(nowMs: number): { delta: number; gifted: boolean } {
    if (!this.st) return { delta: 0, gifted: false };
    const today = dayKeyOf(nowMs);
    const s = this.st.streak;
    if (s.lastDayKey === today) return { delta: 0, gifted: false };

    const yesterday = dayKeyOf(nowMs - 86_400_000);
    s.count = s.lastDayKey === yesterday ? s.count + 1 : 1;
    s.best = Math.max(s.best, s.count);
    s.lastDayKey = today;

    // 일정 일수마다 글로벌 링크 코어 선물
    const gifted = s.count > 1 && s.count % STREAK.giftEveryDays === 0;
    if (gifted) this.st.globalLinkUntil = nowMs + GLOBAL_LINK_MS;
    return { delta: 1, gifted };
  }

  /** 부재 중 자율 청소 시뮬레이션 */
  private simulateAway(nowMs: number): AwayReportV2 | null {
    if (!this.st) return null;
    const awayMs = Math.max(0, nowMs - this.st.lastSimAt);
    this.st.lastSimAt = nowMs;

    this.rollDailyIfNeeded(nowMs);
    const streak = this.updateStreak(nowMs);

    if (awayMs < 5 * 60 * 1000 && streak.delta === 0) return null;

    const hours = Math.min(awayMs / 3_600_000, 72);
    const level = levelForXp(this.st.xp);
    const vigor = 0.5 + this.st.energy / 200;
    const debris = Math.floor(hours * (5 + level * 1.2) * vigor);
    const xp = debris * 6;
    const encounters = Math.floor(hours * 0.35 + Math.random() * 0.9);
    const collisions = Math.floor(hours * 0.12 + Math.random() * 0.6);
    const healthLost = Math.min(collisions * 7, Math.max(0, this.st.health - 15));

    this.st.debrisCleaned += debris;
    this.st.cleanedByTier[0] += Math.ceil(debris * 0.5);
    this.st.cleanedByTier[1] += Math.floor(debris * 0.3);
    this.st.cleanedByTier[2] += Math.floor(debris * 0.2);
    this.st.xp += xp + encounters * 25;
    this.st.encounters += encounters;
    this.st.collisions += collisions;
    this.st.health = clamp(this.st.health - healthLost, 15, 100);
    this.st.energy = clamp(this.st.energy - hours * 4 + debris * 0.35, 15, 100);
    this.st.mood = clamp(this.st.mood - hours * 2, 20, 100);

    // 부재 중 청소는 "흡수" 미션에만, 그것도 목표의 절반까지만 기여시킨다.
    // (그러지 않으면 접속하자마자 미션이 끝나 플레이 동기가 사라진다)
    const eatMission = this.st.daily.missions.find((m) => m.id === "eat");
    if (eatMission && !eatMission.done) {
      const cap = Math.floor(eatMission.goal * 0.5);
      this.bump("eat", Math.min(debris, Math.max(0, cap - eatMission.progress)));
    }

    this.save();

    return {
      awayMs,
      debris,
      xp: xp + encounters * 25,
      encounters,
      collisions,
      healthLost,
      streakDelta: streak.delta,
      streakCount: this.st.streak.count,
      giftedLink: streak.gifted,
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

  private computeSnapshot(): SnapshotV2 | null {
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
      streakMult: this.streakMult(),
      missionsDone: this.st.daily.missions.filter((m) => m.done).length,
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
      localStorage.setItem(this.storageKey, JSON.stringify(this.st));
    } catch {}
  }
}

let singleton: JoopsStoreV2 | null = null;

export function getJoopsStoreV2(): JoopsStoreV2 {
  if (!singleton) singleton = new JoopsStoreV2();
  return singleton;
}
