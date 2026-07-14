// 줍스(Joops) 코어 게임 규칙 — 상수·타입·순수 로직.
// UI와 분리해 두어 오프라인(부재중) 시뮬레이션과 실시간 틱이 같은 수식을 쓴다.

export const ORBIT_PERIOD_MS = 120_000; // 궤도 한 바퀴 = 2분 (MVP 테스트용 배속)
export const DEG_PER_MS = 360 / ORBIT_PERIOD_MS;
export const HOME_HALF_WINDOW_DEG = 20; // '내 상공' 판정 반경 (±도)
export const COLLISION_RATE_PER_MS = 1 / 180_000; // 평균 3분 비행마다 잔해 충돌 1회
export const IDLE_EXP_TICK_MS = 5_000; // 방치 EXP 판정 주기
export const IDLE_EXP_CHANCE = 0.35;
export const IDLE_EXP_AMOUNT = 3;
export const ACTION_DURATION_MS = 45_000; // 상공 액션(미니게임) 길이
export const ACTION_EXP_PER_TRASH = 6;
export const HEAL_TAPS_REQUIRED = 5;
export const MAX_HP = 100;
export const OFFLINE_REPORT_MIN_MS = 30_000; // 이보다 짧은 부재는 보고 생략

export type JoopsSave = {
  v: 1;
  homeAngle: number | null; // '내 상공' 각도. null이면 아직 미지정(설정 단계)
  angle: number; // 현재 궤도 각도 (0 ≤ angle < 360, 12시 방향이 0도, 시계 방향)
  level: number;
  exp: number; // 현재 레벨 내 진행 EXP
  hp: number;
  stopped: boolean; // 충돌로 궤도 이동이 멈춘 상태
  orbits: number; // 누적 완주 바퀴 수
  savedAt: number; // epoch ms — 부재중 시뮬레이션의 기준 시각
};

export type OfflineReport = {
  awayMs: number;
  expGained: number;
  levelUps: number;
  orbitsCompleted: number;
  collided: boolean;
};

export function defaultSave(now: number): JoopsSave {
  return {
    v: 1,
    homeAngle: null,
    angle: 0,
    level: 1,
    exp: 0,
    hp: MAX_HP,
    stopped: false,
    orbits: 0,
    savedAt: now,
  };
}

export function expForLevel(level: number): number {
  return 60 + (level - 1) * 30;
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function angularDistance(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, 360 - d);
}

export function isInHomeWindow(angle: number, homeAngle: number): boolean {
  return angularDistance(angle, homeAngle) <= HOME_HALF_WINDOW_DEG;
}

/** 상공 창 진입 지점까지 남은 시간. 이미 창 안이면 0. */
export function etaToHomeMs(angle: number, homeAngle: number): number {
  if (isInHomeWindow(angle, homeAngle)) return 0;
  const entry = normalizeAngle(homeAngle - HOME_HALF_WINDOW_DEG);
  return normalizeAngle(entry - angle) / DEG_PER_MS;
}

export function applyExp(
  level: number,
  exp: number,
  gain: number,
): { level: number; exp: number; levelUps: number } {
  let l = level;
  let e = exp + gain;
  let ups = 0;
  while (e >= expForLevel(l)) {
    e -= expForLevel(l);
    l += 1;
    ups += 1;
  }
  return { level: l, exp: e, levelUps: ups };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}분 ${String(s).padStart(2, "0")}초`;
}

export function formatAway(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return `${Math.max(1, Math.floor(ms / 1000))}초`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

/**
 * 부재중(Time Delta) 시뮬레이션.
 * 충돌 시점은 지수 분포로 샘플링해, 충돌했다면 그 시점까지만 비행한 것으로 처리한다.
 */
export function simulateOffline(
  save: JoopsSave,
  now: number,
): { save: JoopsSave; report: OfflineReport | null } {
  const awayMs = Math.max(0, now - save.savedAt);
  const base = { ...save, savedAt: now };

  if (save.homeAngle === null || save.stopped || awayMs < 1000) {
    return { save: base, report: null };
  }

  const collisionAt = -Math.log(1 - Math.random()) / COLLISION_RATE_PER_MS;
  const collided = collisionAt < awayMs;
  const flightMs = collided ? collisionAt : awayMs;

  const advanceDeg = flightMs * DEG_PER_MS;
  const orbitsCompleted = Math.floor((save.angle + advanceDeg) / 360);

  const attempts = Math.floor(flightMs / IDLE_EXP_TICK_MS);
  let expGained = 0;
  if (attempts <= 400) {
    for (let i = 0; i < attempts; i += 1) {
      if (Math.random() < IDLE_EXP_CHANCE) expGained += IDLE_EXP_AMOUNT;
    }
  } else {
    // 긴 부재는 기대값 근사 (±15% 변동)
    const mean = attempts * IDLE_EXP_CHANCE * IDLE_EXP_AMOUNT;
    expGained = Math.round(mean * (0.85 + Math.random() * 0.3));
  }

  const grown = applyExp(save.level, save.exp, expGained);

  const next: JoopsSave = {
    ...base,
    angle: normalizeAngle(save.angle + advanceDeg),
    level: grown.level,
    exp: grown.exp,
    hp: collided ? 0 : save.hp,
    stopped: collided,
    orbits: save.orbits + orbitsCompleted,
  };

  const report: OfflineReport | null =
    awayMs >= OFFLINE_REPORT_MIN_MS
      ? {
          awayMs,
          expGained,
          levelUps: grown.levelUps,
          orbitsCompleted,
          collided,
        }
      : null;

  return { save: next, report };
}
