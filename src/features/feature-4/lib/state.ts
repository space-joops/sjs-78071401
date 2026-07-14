// 영속 게임 상태 — 저장/로드, 부재중(오프라인) 청소 시뮬레이션, 돌봄 액션.
// 줍스는 플레이어가 없어도 궤도를 돌며 청소한다(요구 8).
import {
  BOOSTER_DURATION_MS,
  CITIES,
  EXHAUSTED_HP,
  FRIEND_NAMES,
  ORBIT_INC_DEG,
  ORBIT_PERIOD_SEC,
  stageForLevel,
  xpNeeded,
} from "./constants";
import type {
  GameResult,
  OfflineReport,
  OwnerLoc,
  SaveState,
} from "./types";

export const SAVE_KEY = "sjs4:save:v1";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function defaultSave(now: number, name = "줍스", owner?: OwnerLoc): SaveState {
  return {
    version: 1,
    createdAt: now,
    lastTick: now,
    onboarded: false,
    joops: {
      name,
      level: 1,
      xp: 0,
      hp: 100,
      satiety: 80,
      mood: 80,
      resting: false,
    },
    // 체험용 스타터 아이템: 회복 캡슐 2, 전지구 부스터 1
    items: { medkit: 2, booster: 1 },
    boosterUntil: 0,
    cleanCarry: 0,
    owner: owner ?? CITIES[0],
    // 생성 시각에 서울 상공 부근을 지나도록 위상을 잡는다
    orbit: {
      epoch: now,
      periodSec: ORBIT_PERIOD_SEC,
      incDeg: ORBIT_INC_DEG,
      lon0: 89.6,
      phase0: 0.888,
    },
    stats: {
      cleaned: 0,
      byTier: [0, 0, 0, 0, 0, 0],
      friendsMet: 0,
      bestCombo: 0,
      playSessions: 0,
      xpTotal: 0,
    },
    log: [
      {
        t: now,
        icon: "🐣",
        msg: `${name}가 배양기에서 깨어나 첫 궤도에 올랐어요!`,
      },
    ],
  };
}

export function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveState;
    if (s.version !== 1) return null;
    if (typeof s.cleanCarry !== "number") s.cleanCarry = 0;
    return s;
  } catch {
    return null;
  }
}

export function persistSave(s: SaveState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // 저장 실패(사파리 프라이빗 모드 등)는 조용히 무시
  }
}

function pushLog(s: SaveState, t: number, icon: string, msg: string) {
  s.log.unshift({ t, icon, msg });
  if (s.log.length > 30) s.log.length = 30;
}

/** XP를 더하고 레벨업/진화를 처리한다. 도달한 최고 레벨을 반환 */
function gainXp(s: SaveState, amount: number, t: number): number {
  s.stats.xpTotal += amount;
  s.joops.xp += amount;
  let leveled = 0;
  while (s.joops.xp >= xpNeeded(s.joops.level)) {
    const before = stageForLevel(s.joops.level);
    s.joops.xp -= xpNeeded(s.joops.level);
    s.joops.level += 1;
    leveled = s.joops.level;
    const after = stageForLevel(s.joops.level);
    pushLog(s, t, "🎉", `레벨 업! LV.${s.joops.level} 달성`);
    if (s.joops.level % 4 === 0) {
      s.items.medkit += 1;
      pushLog(s, t, "💊", "레벨 보상으로 회복 캡슐을 받았어요");
    }
    if (s.joops.level % 7 === 0) {
      s.items.booster += 1;
      pushLog(s, t, "🌐", "레벨 보상으로 전지구 교신 부스터를 받았어요!");
    }
    if (after.idx !== before.idx) {
      pushLog(s, t, "✨", `진화! ${before.name} → ${after.name}`);
    }
  }
  return leveled;
}

export const boosterActive = (s: SaveState, now: number) => s.boosterUntil > now;

/** 현재 교신 반경(km). 부스터 중이면 Infinity(전지구) */
export function coverageKmOf(s: SaveState, now: number): number {
  if (boosterActive(s, now)) return Infinity;
  return stageForLevel(s.joops.level).coverageKm;
}

export const isExhausted = (s: SaveState) => s.joops.hp <= EXHAUSTED_HP;

/**
 * lastTick 이후 흐른 시간만큼 줍스의 자율 청소를 시뮬레이션한다.
 * 10분 단위 청크로 진행하며, 최대 7일까지만 계산한다.
 */
export function applyOffline(prev: SaveState, now: number): {
  save: SaveState;
  report: OfflineReport | null;
} {
  const elapsed = now - prev.lastTick;
  if (elapsed < 1000) {
    return { save: prev, report: null };
  }
  const s: SaveState = structuredClone(prev);
  const simMs = Math.min(elapsed, 7 * 24 * 3600 * 1000);
  const CHUNK = 10 * 60 * 1000;

  const rep: OfflineReport = {
    elapsedMs: elapsed,
    cleaned: 0,
    xpGained: 0,
    friendsMet: 0,
    collisions: 0,
    leveledTo: null,
  };
  let done = 0;
  while (done < simMs) {
    const step = Math.min(CHUNK, simMs - done);
    done += step;
    const t = prev.lastTick + done;
    const hours = step / 3600000;
    const j = s.joops;

    if (j.resting) {
      // 휴식: 회복에 전념
      j.hp = clamp(j.hp + 9 * hours);
      j.satiety = clamp(j.satiety - 1.2 * hours);
      j.mood = clamp(j.mood + 2 * hours);
      continue;
    }
    if (j.hp <= EXHAUSTED_HP) {
      // 지침: 청소 불가, 서서히 시무룩
      j.mood = clamp(j.mood - 2.5 * hours);
      j.satiety = clamp(j.satiety - 0.8 * hours);
      continue;
    }
    if (j.satiety <= 0) {
      // 배고픔: 추진력이 없어 표류
      j.mood = clamp(j.mood - 3 * hours);
      continue;
    }

    // 자율 청소
    const stage = stageForLevel(j.level);
    s.cleanCarry += (6 + j.level * 1.5) * hours * (0.7 + j.mood / 250);
    const cleaned = Math.floor(s.cleanCarry);
    s.cleanCarry -= cleaned;
    if (cleaned > 0) {
      s.stats.cleaned += cleaned;
      const tier = Math.min(stage.maxTier, 5);
      s.stats.byTier[Math.max(0, tier - 1)] += cleaned;
      const xp = Math.round(cleaned * (1.4 + stage.idx * 0.7));
      rep.cleaned += cleaned;
      rep.xpGained += xp;
      const lv = gainXp(s, xp, t);
      if (lv) rep.leveledTo = lv;
    }
    j.satiety = clamp(j.satiety - 2.6 * hours);
    j.mood = clamp(j.mood - 0.8 * hours);

    // 확률 이벤트: 처리 불가 물체와의 충돌(요구 5)
    if (Math.random() < 0.05 * hours) {
      const dmg = 8 + Math.round(Math.random() * 8);
      j.hp = clamp(j.hp - dmg);
      rep.collisions += 1;
      pushLog(s, t, "💥", `운용 위성 파편을 피하다 부딪혔어요 (HP -${dmg})`);
      if (j.hp <= EXHAUSTED_HP) {
        pushLog(s, t, "😵", `${j.name}가 지쳐서 청소를 멈췄어요. 보살핌이 필요해요!`);
      }
    }
    // 확률 이벤트: 떠돌이 줍스와 조우(요구 7)
    if (Math.random() < 0.06 * hours) {
      const friend = FRIEND_NAMES[Math.floor(Math.random() * FRIEND_NAMES.length)];
      s.stats.friendsMet += 1;
      rep.friendsMet += 1;
      rep.xpGained += 15;
      const lv = gainXp(s, 15, t);
      if (lv) rep.leveledTo = lv;
      pushLog(s, t, "💞", `떠돌이 줍스 '${friend}'를 만나 인사했어요 (+15 XP)`);
    }
  }

  s.lastTick = now;
  const meaningful =
    elapsed > 10 * 60 * 1000 &&
    (rep.cleaned > 0 || rep.collisions > 0 || rep.friendsMet > 0);
  return { save: s, report: meaningful ? rep : null };
}

// ---------- 돌봄(다마고치) 액션 — 교신 중일 때만 호출된다 ----------

export function careFeed(prev: SaveState, now: number): SaveState {
  const s = structuredClone(prev);
  s.joops.satiety = clamp(s.joops.satiety + 26);
  s.joops.mood = clamp(s.joops.mood + 4);
  pushLog(s, now, "🍬", `${s.joops.name}에게 우주 간식을 보냈어요`);
  return s;
}

export function carePet(prev: SaveState, now: number): SaveState {
  const s = structuredClone(prev);
  s.joops.mood = clamp(s.joops.mood + 12);
  gainXp(s, 2, now);
  pushLog(s, now, "💗", `${s.joops.name}를 원격 촉수로 쓰다듬었어요`);
  return s;
}

export function careHeal(prev: SaveState, now: number): SaveState {
  if (prev.items.medkit <= 0) return prev;
  const s = structuredClone(prev);
  s.items.medkit -= 1;
  s.joops.hp = clamp(s.joops.hp + 45);
  pushLog(s, now, "💊", "회복 캡슐을 전송했어요 (HP +45)");
  return s;
}

export function toggleRest(prev: SaveState, now: number): SaveState {
  const s = structuredClone(prev);
  s.joops.resting = !s.joops.resting;
  pushLog(
    s,
    now,
    s.joops.resting ? "😴" : "🧹",
    s.joops.resting
      ? `${s.joops.name}가 궤도 요람에서 휴식에 들어갔어요`
      : `${s.joops.name}가 다시 청소를 시작했어요!`,
  );
  return s;
}

export function useBooster(prev: SaveState, now: number): SaveState {
  if (prev.items.booster <= 0 || boosterActive(prev, now)) return prev;
  const s = structuredClone(prev);
  s.items.booster -= 1;
  s.boosterUntil = now + BOOSTER_DURATION_MS;
  pushLog(s, now, "🌐", "전지구 교신 부스터 가동! 1시간 동안 어디서나 교신할 수 있어요");
  return s;
}

export function renameJoops(prev: SaveState, now: number, name: string): SaveState {
  const s = structuredClone(prev);
  const trimmed = name.trim().slice(0, 10);
  if (!trimmed) return prev;
  pushLog(s, now, "✏️", `이름을 '${s.joops.name}' → '${trimmed}'로 바꿨어요`);
  s.joops.name = trimmed;
  return s;
}

export function setOwnerCity(prev: SaveState, now: number, owner: OwnerLoc): SaveState {
  const s = structuredClone(prev);
  s.owner = owner;
  pushLog(s, now, "📡", `관제소를 '${owner.city}'로 옮겼어요`);
  return s;
}

/** 조종 훈련(미니게임) 결과 반영 */
export function applyGameResult(prev: SaveState, now: number, r: GameResult): SaveState {
  const s = structuredClone(prev);
  s.stats.playSessions += 1;
  s.stats.cleaned += r.cleaned;
  for (let i = 0; i < 6; i++) s.stats.byTier[i] += r.cleanedByTier[i] ?? 0;
  s.stats.friendsMet += r.friendsMet;
  s.stats.bestCombo = Math.max(s.stats.bestCombo, r.bestCombo);
  s.joops.hp = clamp(s.joops.hp + r.hpDelta);
  s.joops.satiety = clamp(s.joops.satiety + r.satietyGain);
  s.joops.mood = clamp(s.joops.mood + 6);
  s.items.booster += r.boostersFound;
  if (r.boostersFound > 0) {
    pushLog(s, now, "🌟", "비행 중 전지구 교신 부스터를 주웠어요!");
  }
  gainXp(s, r.xp, now);
  pushLog(
    s,
    now,
    "🎮",
    `조종 훈련 완료 — 쓰레기 ${r.cleaned}개, +${r.xp} XP`,
  );
  if (s.joops.hp <= EXHAUSTED_HP) {
    pushLog(s, now, "😵", `${s.joops.name}가 지쳤어요. 회복 캡슐이나 휴식이 필요해요`);
  }
  return s;
}

/** 성과 자랑 문구(요구 2-1 공유) */
export function shareText(s: SaveState): string {
  const stage = stageForLevel(s.joops.level);
  return (
    `🛰️ 내 줍스 '${s.joops.name}' (LV.${s.joops.level} ${stage.name})가 ` +
    `우주쓰레기 ${s.stats.cleaned.toLocaleString()}개를 청소했어요! ` +
    `#SpaceJoops #케슬러신드롬 #우주쓰레기청소`
  );
}

export const LOG_TIME_FMT = (t: number) =>
  new Date(t).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
