// 절차적 사운드 — 외부 오디오 에셋 0바이트.
// WebAudio 오실레이터와 노이즈 버퍼만으로 효과음을 합성한다.
//
// iOS는 사용자 제스처 안에서만 AudioContext가 시작되므로 첫 pointerdown에서 unlock()을 부른다.

/** 펜타토닉 사다리 — 콤보가 오를수록 음이 올라간다 (연속 밟기 효과음의 원리) */
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];

export class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastAt = new Map<string, number>();
  enabled = true;

  /** 사용자 제스처 안에서 호출해야 한다 */
  unlock(): void {
    if (this.ac) {
      if (this.ac.state === "suspended") void this.ac.resume();
      return;
    }
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? w.webkitAudioContext;
    if (!AC) return;
    try {
      const ac = new AC();
      const master = ac.createGain();
      master.gain.value = 0.22;
      // 여러 소리가 겹칠 때 클리핑 방지
      const comp = ac.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ac.destination);

      const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this.ac = ac;
      this.master = master;
      this.noise = buf;
    } catch {
      this.ac = null;
    }
  }

  suspend(): void {
    void this.ac?.suspend();
  }

  /** 같은 종류가 너무 촘촘히 울리면 뭉개지므로 최소 간격을 둔다 */
  private gate(key: string, minMs: number): AudioContext | null {
    if (!this.enabled || !this.ac || !this.master) return null;
    if (this.ac.state !== "running") return null;
    const now = this.ac.currentTime * 1000;
    const last = this.lastAt.get(key) ?? -1e9;
    if (now - last < minMs) return null;
    this.lastAt.set(key, now);
    return this.ac;
  }

  private tone(
    ac: AudioContext,
    type: OscillatorType,
    f0: number,
    f1: number,
    peak: number,
    dur: number,
    delay = 0,
  ): void {
    if (!this.master) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006); // 빠른 어택 = "톡"
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(
    ac: AudioContext,
    fromHz: number,
    toHz: number,
    peak: number,
    dur: number,
    q = 1.2,
  ): void {
    if (!this.master || !this.noise) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(fromHz, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** 쓰레기 흡수 — 콤보가 오를수록 반음씩 상승 */
  eat(tier: number, combo: number): void {
    const ac = this.gate("eat", 28);
    if (!ac) return;
    const semi = LADDER[Math.min(combo, LADDER.length - 1)];
    const f0 = 233 * Math.pow(2, semi / 12);
    this.tone(ac, "square", f0, f0 * 2.1, 0.55, 0.1);
    if (tier >= 3) {
      // 큰 쓰레기는 저역 "쿵"을 덧댄다
      this.tone(ac, "sine", f0 / 2, f0 / 3, 0.35 + tier * 0.05, 0.2);
    }
  }

  /** 콤보 단계 상승 */
  comboUp(step: number): void {
    const ac = this.gate("comboUp", 90);
    if (!ac) return;
    const base = 523 * Math.pow(2, step / 12);
    this.tone(ac, "triangle", base, base * 1.5, 0.4, 0.12);
    this.tone(ac, "triangle", base * 1.5, base * 2, 0.32, 0.14, 0.07);
  }

  comboBreak(): void {
    const ac = this.gate("comboBreak", 200);
    if (!ac) return;
    this.tone(ac, "square", 466, 440, 0.3, 0.08);
    this.tone(ac, "square", 311, 290, 0.3, 0.12, 0.08);
  }

  /** 충돌 — 노이즈 버스트 + 저역 톱니 */
  hit(heavy: boolean): void {
    const ac = this.gate("hit", 120);
    if (!ac) return;
    this.burst(ac, heavy ? 1600 : 1100, 160, heavy ? 0.7 : 0.45, heavy ? 0.35 : 0.24);
    this.tone(ac, "sawtooth", 170, 55, 0.4, 0.24);
  }

  /** 니어미스 — 스쳐 지나가는 바람소리 */
  whoosh(): void {
    const ac = this.gate("whoosh", 160);
    if (!ac) return;
    this.burst(ac, 400, 2600, 0.14, 0.16, 2.4);
    this.burst(ac, 2600, 500, 0.12, 0.18, 2.4);
  }

  /** 진화 — 아르페지오 */
  evolve(): void {
    const ac = this.gate("evolve", 900);
    if (!ac) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(ac, "triangle", f, f, 0.42, 0.22, i * 0.09));
    this.tone(ac, "triangle", 1319, 1319, 0.3, 0.5, 0.36);
    this.burst(ac, 3000, 6000, 0.08, 0.6, 3);
  }

  /** 아이템·친구 조우 */
  pickup(): void {
    const ac = this.gate("pickup", 150);
    if (!ac) return;
    [440, 587, 880].forEach((f, i) => this.tone(ac, "triangle", f, f * 1.2, 0.4, 0.12, i * 0.06));
  }

  /** 레벨업 */
  levelUp(): void {
    const ac = this.gate("levelUp", 400);
    if (!ac) return;
    [523, 784].forEach((f, i) => this.tone(ac, "square", f, f * 1.3, 0.3, 0.14, i * 0.08));
  }
}

let singleton: Sfx | null = null;

export function getSfx(): Sfx {
  if (!singleton) singleton = new Sfx();
  return singleton;
}
