/** 숫자를 한국어 로캘 천 단위 구분으로 */
export function fmtInt(n: number): string {
  return Math.floor(n).toLocaleString("ko-KR");
}

/** 질량을 g / kg / t 단위로 읽기 좋게 */
export function fmtMass(kg: number): string {
  if (kg < 1) return `${Math.max(1, Math.round(kg * 1000)).toLocaleString("ko-KR")} g`;
  if (kg < 1000) return `${kg.toFixed(1)} kg`;
  return `${(kg / 1000).toFixed(1)} t`;
}

/** ms 단위 시간을 "n일 n시간 n분" 꼴로 */
export function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}분`);
  return parts.join(" ");
}

/** "YYYY-MM-DD" → "YYYY. M. D." */
export function fmtDateISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}

/** epoch ms → "YYYY. M. D." */
export function fmtDateMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** 받침 유무에 따라 조사를 골라 붙인다. josa(name, "은", "는") */
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    return (last - 0xac00) % 28 > 0 ? withBatchim : without;
  }
  return without;
}

/** 로컬 기준 오늘 날짜 키 */
export function localDayKey(d: Date = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 결정적 의사난수 — 데모 데이터 생성용 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
