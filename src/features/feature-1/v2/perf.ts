// 품질 티어 — 기기 성능에 맞춰 이펙트 예산을 조절한다.
// 정적 추정으로 시작해, 실제 프레임 시간을 보고 한 방향(다운그레이드)으로만 보정한다.
// (올렸다 내렸다 하면 품질이 진동하므로 이력현상을 둔다)

export type Quality = "low" | "med" | "high";

export type QualityBudget = {
  dpr: number;
  earthDpr: number;
  particles: number;
  dust: number;
  /** 비네트·줌펀치·트랙터빔 등 부가 이펙트 */
  effects: boolean;
  /** 화면 흔들림 배율 */
  shake: number;
};

export const BUDGETS: Record<Quality, QualityBudget> = {
  low: { dpr: 1, earthDpr: 1, particles: 60, dust: 0, effects: false, shake: 0.5 },
  med: { dpr: 1.5, earthDpr: 1.5, particles: 160, dust: 6, effects: true, shake: 1 },
  high: { dpr: 2, earthDpr: 1.75, particles: 288, dust: 10, effects: true, shake: 1 },
};

type NavigatorWithHints = Navigator & { deviceMemory?: number };

/** 초기 추정 — 틀려도 PerfWatch가 보정한다 */
export function guessQuality(): Quality {
  if (typeof navigator === "undefined") return "med";
  const nav = navigator as NavigatorWithHints;
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return "low";
  const coarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return coarse ? "med" : "high";
}

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 프레임 시간을 감시해 느리면 한 단계 낮춘다 */
export class PerfWatch {
  private slowMs = 0;
  quality: Quality;

  constructor(initial: Quality) {
    this.quality = initial;
  }

  get budget(): QualityBudget {
    return BUDGETS[this.quality];
  }

  /** 매 프레임 호출. 22ms(≒45fps) 초과가 2초 이어지면 강등 */
  sample(dtMs: number): void {
    if (this.quality === "low") return;
    if (dtMs > 22) {
      this.slowMs += dtMs;
      if (this.slowMs > 2000) {
        this.quality = this.quality === "high" ? "med" : "low";
        this.slowMs = 0;
      }
    } else {
      this.slowMs = Math.max(0, this.slowMs - dtMs * 0.5);
    }
  }
}
