// 파편 고정 풀 — SoA 평행 배열, 게임 중 런타임 할당 0 (feature-1 v2 pool 철학).
// Particle 슬롯과 1:1로 바인딩되고, 죽은 슬롯은 화면 밖(-9999)에 파킹한다.
import type { Particle } from "pixi.js";

export class DebrisPool {
  readonly cap: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly rot: Float32Array;
  readonly vr: Float32Array;
  readonly radius: Float32Array;
  readonly typeId: Uint8Array;
  readonly alive: Uint8Array;
  particles: Particle[] = [];
  aliveCount = 0;
  private free: number[];

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.rot = new Float32Array(cap);
    this.vr = new Float32Array(cap);
    this.radius = new Float32Array(cap);
    this.typeId = new Uint8Array(cap);
    this.alive = new Uint8Array(cap);
    this.free = [];
    for (let i = cap - 1; i >= 0; i--) this.free.push(i);
  }

  /** 미리 생성된 Particle 배열(cap개)과 결합. 파티클은 파킹 상태로 시작해야 한다 */
  bind(particles: Particle[]): void {
    this.particles = particles;
  }

  /** 빈 슬롯 인덱스를 예약. 가득 차면 -1 */
  acquire(): number {
    const i = this.free.pop();
    if (i === undefined) return -1;
    this.alive[i] = 1;
    this.aliveCount++;
    return i;
  }

  /** 슬롯 해제 + 파티클 파킹 */
  kill(i: number): void {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.aliveCount--;
    this.free.push(i);
    const p = this.particles[i];
    if (p) {
      p.x = -9999;
      p.y = -9999;
      p.alpha = 0;
    }
  }

  killAll(): void {
    for (let i = 0; i < this.cap; i++) {
      if (this.alive[i]) this.kill(i);
    }
  }
}

/** 수거 이펙트용 스파크 풀 — 수명/속도만 있는 초경량 SoA */
export class SparkPool {
  readonly cap: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly size: Float32Array;
  readonly alive: Uint8Array;
  particles: Particle[] = [];
  private cursor = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.alive = new Uint8Array(cap);
  }

  bind(particles: Particle[]): void {
    this.particles = particles;
  }

  /** 링 버퍼 방식 — 가득 차면 가장 오래된 스파크를 덮어쓴다 */
  emit(x: number, y: number, vx: number, vy: number, life: number, size: number, tint: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.alive[i] = 1;
    const p = this.particles[i];
    if (p) p.tint = tint;
  }

  update(dt: number): void {
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      const p = this.particles[i];
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        if (p) {
          p.x = -9999;
          p.alpha = 0;
        }
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.vx[i] *= 1 - 2.4 * dt;
      this.vy[i] *= 1 - 2.4 * dt;
      if (p) {
        const t = this.life[i] / this.maxLife[i];
        p.x = this.x[i];
        p.y = this.y[i];
        p.alpha = t;
        const sc = this.size[i] * (0.5 + t * 0.5);
        p.scaleX = sc;
        p.scaleY = sc;
      }
    }
  }
}
