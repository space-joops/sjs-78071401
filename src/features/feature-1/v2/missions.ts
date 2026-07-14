// 일일 미션 — 날짜 키로 결정론적으로 3개를 뽑는다.
// 서버 없이 순수 함수로 동작하므로 새로고침해도 같은 미션이 유지된다.

export type MissionId = "eat" | "combo" | "nearMiss" | "tier" | "care";

export type DailyMission = {
  id: MissionId;
  goal: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  rewardXp: number;
  label: string;
  emoji: string;
};

type MissionDef = Omit<DailyMission, "progress" | "done" | "claimed">;

const POOL: MissionDef[] = [
  { id: "eat", goal: 60, rewardXp: 150, label: "우주쓰레기 60개 흡수", emoji: "🧹" },
  { id: "combo", goal: 8, rewardXp: 120, label: "콤보 8 달성", emoji: "🔥" },
  { id: "nearMiss", goal: 4, rewardXp: 130, label: "위성 아슬아슬하게 스치기 4회", emoji: "💨" },
  { id: "tier", goal: 6, rewardXp: 140, label: "3등급 이상 쓰레기 6개 처리", emoji: "🛰️" },
  { id: "care", goal: 3, rewardXp: 80, label: "줍스 보살피기 3회", emoji: "💚" },
];

/** 로컬 날짜 키 ("2026-07-14") — 자정에 롤오버 */
export function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 날짜 키에서 결정론적으로 3개 선택 */
export function rollMissions(dayKey: string): DailyMission[] {
  const seed = hash(dayKey);
  const pool = [...POOL];
  const picked: MissionDef[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = (seed >>> (i * 5)) % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.map((m) => ({ ...m, progress: 0, done: false, claimed: false }));
}

/** 미션 진행도 가산. 변화가 있으면 true */
export function bumpMission(
  missions: DailyMission[],
  id: MissionId,
  amount: number,
  /** 절대값 설정(콤보 최고치처럼 누적이 아닌 것) */
  absolute = false,
): DailyMission | null {
  const m = missions.find((x) => x.id === id);
  if (!m || m.done) return null;
  const next = absolute ? Math.max(m.progress, amount) : m.progress + amount;
  if (next === m.progress) return null;
  m.progress = Math.min(m.goal, next);
  if (m.progress >= m.goal) {
    m.done = true;
    return m;
  }
  return null;
}
