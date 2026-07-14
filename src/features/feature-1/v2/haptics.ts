// 진동 햅틱 — navigator.vibrate 래퍼.
// 미지원 환경(iOS Safari 등)에서는 조용히 무시된다.

type VibratePattern = number | readonly number[];

export const HAPTIC = {
  eatSmall: 6,
  eatBig: 16,
  comboUp: 10,
  hit: [0, 28, 40, 55],
  nearMiss: 8,
  evolve: [0, 20, 40, 20, 40, 70],
  pickup: [0, 12, 30, 12],
} as const;

export function vibrate(pattern: VibratePattern, enabled: boolean): void {
  if (!enabled) return;
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
  } catch {
    // 일부 브라우저는 사용자 제스처 없이 호출하면 던진다 — 무시
  }
}
