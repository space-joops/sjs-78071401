// 최고 기록 저장 — 사파리 프라이빗 모드 등 localStorage 접근 실패에 대비해 try/catch.

const BEST_KEY = "sjs-f10-best";

export function loadBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** 점수가 기존 기록을 넘으면 저장하고, 신기록 여부를 반환 */
export function saveBest(score: number): boolean {
  const best = loadBest();
  if (score <= best) return false;
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // 저장 실패해도 게임 진행에는 영향 없음
  }
  return true;
}
