// 스텔라펫2 효과음: 웹오디오 신스 (오디오 에셋 없음, 개선 지시서 Phase 1-4)
// 브라우저 정책상 첫 사용자 제스처에서 unlock()을 호출해야 소리가 난다.

let ctx: AudioContext | null = null;
let mutedFlag = false;

export function setMuted(muted: boolean): void {
  mutedFlag = muted;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  durSec: number,
  opts: { type?: OscillatorType; vol?: number; delaySec?: number; slideTo?: number } = {},
): void {
  if (mutedFlag) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + (opts.delaySec ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + durSec);
  const vol = opts.vol ?? 0.1;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + durSec);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.05);
}

export const sfx = {
  /** 첫 사용자 제스처에서 호출해 오디오 컨텍스트 잠금 해제 */
  unlock(): void {
    ensureCtx();
  },
  suspend(): void {
    if (ctx && ctx.state === "running") void ctx.suspend();
  },
  resume(): void {
    if (ctx && ctx.state === "suspended") void ctx.resume();
  },
  /** 쓰레기 흡수 — 등급이 높을수록 높은 음 */
  eat(tier: number): void {
    const base = 480 + tier * 120;
    tone(base, 0.09, { type: "square", vol: 0.05, slideTo: base * 1.8 });
    tone(base * 1.5, 0.13, { vol: 0.07, delaySec: 0.045 });
  },
  hurt(): void {
    tone(150, 0.22, { type: "sawtooth", vol: 0.09, slideTo: 65 });
  },
  levelUp(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.14, { type: "triangle", vol: 0.08, delaySec: i * 0.09 }),
    );
  },
  encounter(): void {
    tone(880, 0.1, { vol: 0.07 });
    tone(1175, 0.16, { vol: 0.07, delaySec: 0.09 });
  },
  hatch(): void {
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.16, { type: "triangle", vol: 0.09, delaySec: i * 0.08 }),
    );
  },
  tap(): void {
    tone(300, 0.06, { type: "square", vol: 0.045, slideTo: 400 });
  },
  item(): void {
    tone(700, 0.1, { vol: 0.08, slideTo: 1400 });
    tone(1400, 0.2, { vol: 0.06, delaySec: 0.1 });
  },
  care(): void {
    tone(587, 0.1, { type: "triangle", vol: 0.08 });
    tone(880, 0.14, { type: "triangle", vol: 0.07, delaySec: 0.08 });
  },
};
