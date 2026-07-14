// 순수 게임 로직 — Pixi 비의존. 콤보/피버 상태기계, 웨이브, 점수, 품질 거버너.
import {
  COMBO_MILESTONE,
  COMBO_SCORE_CAP,
  COMBO_SCORE_STEP,
  COMBO_WINDOW,
  DEBRIS_TYPES,
  FEVER_HAZARD_BONUS,
  FEVER_SCORE_MULT,
  FEVER_SECONDS,
  GAUGE_COMBO_BONUS,
  GAUGE_HIT_KEEP,
  GAUGE_MAX,
  GAUGE_PER_COLLECT,
  HAZARD_TYPE_ID,
  HIT_INVULN_SECONDS,
  HIT_TIME_PENALTY,
  RUSH_SECONDS,
  WAVES,
} from "./constants";

export type RunState = {
  /** 경과 시간(웨이브 스케줄 기준 — 피격 페널티와 무관) */
  clock: number;
  timeLeft: number;
  score: number;
  collected: number;
  combo: number;
  bestCombo: number;
  comboTimer: number;
  gauge: number;
  fever: boolean;
  feverTimer: number;
  feverCount: number;
  invuln: number;
  /** 0-based 웨이브 인덱스 */
  wave: number;
};

export function newRunState(): RunState {
  return {
    clock: 0,
    timeLeft: RUSH_SECONDS,
    score: 0,
    collected: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    gauge: 0,
    fever: false,
    feverTimer: 0,
    feverCount: 0,
    invuln: 0,
    wave: 0,
  };
}

export function waveIndexAt(clock: number): number {
  let idx = 0;
  for (let i = 0; i < WAVES.length; i++) {
    if (clock >= WAVES[i].at) idx = i;
  }
  return idx;
}

const TOTAL_WEIGHT = DEBRIS_TYPES.reduce((s, d) => s + d.weight, 0);

/** 스폰할 파편 타입 추첨 — hazardRatio 확률로 위험 파편(5) */
export function pickTypeId(hazardRatio: number, rand: () => number): number {
  if (rand() < hazardRatio) return HAZARD_TYPE_ID;
  let roll = rand() * TOTAL_WEIGHT;
  for (let i = 0; i < DEBRIS_TYPES.length; i++) {
    roll -= DEBRIS_TYPES[i].weight;
    if (roll <= 0) return i;
  }
  return 0;
}

export type CollectResult = {
  gained: number;
  feverStarted: boolean;
  /** 콤보 마일스톤(8/16/24…) 도달 */
  milestone: boolean;
};

/** 파편 수거 반영. typeId 5(위험)는 피버 중에만 들어온다 */
export function applyCollect(rs: RunState, typeId: number): CollectResult {
  const base =
    typeId === HAZARD_TYPE_ID ? FEVER_HAZARD_BONUS : DEBRIS_TYPES[typeId].score;
  rs.combo += 1;
  rs.bestCombo = Math.max(rs.bestCombo, rs.combo);
  rs.comboTimer = COMBO_WINDOW;
  rs.collected += 1;

  const comboMult = 1 + Math.min(rs.combo, COMBO_SCORE_CAP) * COMBO_SCORE_STEP;
  const feverMult = rs.fever ? FEVER_SCORE_MULT : 1;
  const gained = base * comboMult * feverMult;
  rs.score += gained;

  let feverStarted = false;
  if (!rs.fever) {
    rs.gauge = Math.min(GAUGE_MAX, rs.gauge + GAUGE_PER_COLLECT + rs.combo * GAUGE_COMBO_BONUS);
    if (rs.gauge >= GAUGE_MAX) {
      rs.fever = true;
      rs.feverTimer = FEVER_SECONDS;
      rs.feverCount += 1;
      feverStarted = true;
    }
  }

  return {
    gained,
    feverStarted,
    milestone: rs.combo > 0 && rs.combo % COMBO_MILESTONE === 0,
  };
}

/** 위험 파편 피격(비피버). 호출 전에 invuln 체크할 것 */
export function applyHit(rs: RunState): void {
  rs.timeLeft -= HIT_TIME_PENALTY;
  rs.combo = 0;
  rs.comboTimer = 0;
  rs.gauge *= GAUGE_HIT_KEEP;
  rs.invuln = HIT_INVULN_SECONDS;
}

export type TickResult = {
  comboBroke: boolean;
  feverEnded: boolean;
  timeUp: boolean;
};

export function tickRun(rs: RunState, dt: number): TickResult {
  rs.clock += dt;
  rs.timeLeft -= dt;
  if (rs.invuln > 0) rs.invuln -= dt;

  let comboBroke = false;
  if (rs.combo > 0) {
    rs.comboTimer -= dt;
    if (rs.comboTimer <= 0) {
      comboBroke = rs.combo >= COMBO_MILESTONE;
      rs.combo = 0;
    }
  }

  let feverEnded = false;
  if (rs.fever) {
    rs.feverTimer -= dt;
    rs.gauge = Math.max(0, (rs.feverTimer / FEVER_SECONDS) * GAUGE_MAX);
    if (rs.feverTimer <= 0) {
      rs.fever = false;
      rs.gauge = 0;
      feverEnded = true;
    }
  }

  return { comboBroke, feverEnded, timeUp: rs.timeLeft <= 0 };
}

/**
 * 적응형 품질 거버너 — 프레임 시간 이동평균이 무거우면 파편 밀도와
 * 스파크 예산을 낮추고, 여유가 생기면 점진 복원한다 (저가 기기 60fps 방어).
 */
export class QualityGovernor {
  private avgMs = 16.7;
  densityScale = 1;
  sparkScale = 1;

  push(frameMs: number): void {
    // 60프레임 지수 이동평균
    this.avgMs += (Math.min(frameMs, 100) - this.avgMs) / 60;
    if (this.avgMs > 20) {
      this.densityScale = Math.max(0.5, this.densityScale - 0.003);
      this.sparkScale = Math.max(0.4, this.sparkScale - 0.006);
    } else if (this.avgMs < 14) {
      this.densityScale = Math.min(1, this.densityScale + 0.001);
      this.sparkScale = Math.min(1, this.sparkScale + 0.002);
    }
  }
}
