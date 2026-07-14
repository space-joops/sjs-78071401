// 파티클·플로팅 텍스트 풀.
//
// v1은 이벤트마다 객체를 push하고 죽으면 splice로 지웠다 — 할당과 배열 시프트가
// 매 히트마다 발생해 GC 히칭을 만든다. 고정 크기 풀에서 슬롯을 재사용하면
// 런타임 할당이 0이 된다. 풀이 꽉 차면 가장 오래된 것을 재활용한다(드롭하지 않음).

export type ParticleKind = "spark" | "heart" | "ring" | "puff" | "debrisChunk";

export type Particle = {
  alive: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
};

export type FloatText = {
  alive: boolean;
  x: number;
  y: number;
  life: number;
  ttl: number;
  text: string;
  color: string;
  size: number;
};

export class Pool<T extends { alive: boolean }> {
  readonly items: T[];
  private cursor = 0;

  constructor(size: number, make: () => T) {
    this.items = Array.from({ length: size }, make);
  }

  /** 빈 슬롯을 찾아 반환. 없으면 가장 오래된 슬롯을 재활용 */
  take(): T {
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const it = this.items[idx];
      if (!it.alive) {
        this.cursor = (idx + 1) % n;
        it.alive = true;
        return it;
      }
    }
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % n;
    it.alive = true;
    return it;
  }

  get used(): number {
    let n = 0;
    for (const it of this.items) if (it.alive) n++;
    return n;
  }

  clear(): void {
    for (const it of this.items) it.alive = false;
  }
}

export function makeParticlePool(size: number): Pool<Particle> {
  return new Pool<Particle>(size, () => ({
    alive: false,
    kind: "spark",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    ttl: 0,
    size: 0,
    color: "#fff",
  }));
}

export function makeTextPool(size: number): Pool<FloatText> {
  return new Pool<FloatText>(size, () => ({
    alive: false,
    x: 0,
    y: 0,
    life: 0,
    ttl: 0,
    text: "",
    color: "#fff",
    size: 12,
  }));
}
