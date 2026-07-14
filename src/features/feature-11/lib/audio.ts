// 절차적 WebAudio 사운드 — 오디오 에셋 0바이트, 오실레이터/노이즈 합성.
// feature-1 v2의 Sfx 관례(첫 제스처 unlock, gate 스로틀, 마스터 게인+컴프레서)를 따른다.

/** C 메이저 펜타토닉 사다리 — 콤보가 오를수록 수거음이 상승한다 */
const LADDER = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5, 1568.0, 1760.0];

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastAt = new Map<string, number>();

  /** 첫 사용자 제스처에서 호출 — iOS AudioContext 잠금 해제 */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** 탭이 백그라운드로 갈 때 배터리 절약 */
  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      return null;
    }
  }

  /** kind별 최소 간격(ms) 스로틀 — 통과하면 true */
  private gate(kind: string, minMs: number): boolean {
    const now = performance.now();
    const last = this.lastAt.get(kind) ?? -Infinity;
    if (now - last < minMs) return false;
    this.lastAt.set(kind, now);
    return true;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted || ctx.state !== "running") return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, peak: number, filterFreq = 1600, delay = 0): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted || ctx.state !== "running") return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  /** 수거 "톡" — 콤보가 오를수록 펜타토닉 상승 */
  collect(combo: number): void {
    if (!this.gate("collect", 30)) return;
    const idx = Math.min(Math.floor(combo / 4), LADDER.length - 1);
    const jitter = 1 + (Math.random() - 0.5) * 0.02;
    this.tone(LADDER[idx] * jitter, 0.07, "square", 0.045);
  }

  /** 콤보 마일스톤(8/16/24…) */
  comboUp(): void {
    if (!this.gate("comboUp", 200)) return;
    this.tone(659.25, 0.08, "triangle", 0.06);
    this.tone(987.77, 0.1, "triangle", 0.06, undefined, 0.07);
  }

  /** 웨이브 전환 차임 */
  wave(): void {
    if (!this.gate("wave", 500)) return;
    this.tone(440, 0.12, "sine", 0.05);
    this.tone(660, 0.16, "sine", 0.05, undefined, 0.1);
  }

  feverStart(): void {
    if (!this.gate("feverStart", 500)) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.12, "square", 0.05, undefined, i * 0.06));
    this.noise(0.35, 0.03, 4000);
  }

  /** 피버 중 주기적 반짝임 */
  feverTick(): void {
    if (!this.gate("feverTick", 1500)) return;
    this.tone(1568, 0.06, "triangle", 0.03);
  }

  hit(): void {
    if (!this.gate("hit", 150)) return;
    this.noise(0.16, 0.09, 900);
    this.tone(110, 0.22, "sawtooth", 0.08, 55);
  }

  gameOver(): void {
    if (!this.gate("gameOver", 500)) return;
    this.tone(392, 0.18, "sine", 0.07);
    this.tone(311.13, 0.2, "sine", 0.07, undefined, 0.16);
    this.tone(233.08, 0.34, "sine", 0.07, undefined, 0.32);
  }

  evolve(): void {
    if (!this.gate("evolve", 500)) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone(f, 0.16, "triangle", 0.06, undefined, i * 0.09));
  }

  uiTap(): void {
    if (!this.gate("uiTap", 60)) return;
    this.tone(660, 0.05, "sine", 0.04);
  }
}

let singleton: Sfx | null = null;

export function getSfx(): Sfx {
  if (!singleton) singleton = new Sfx();
  return singleton;
}
