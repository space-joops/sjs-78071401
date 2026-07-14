// WebAudio 신디사이저 효과음 — 에셋 없이 가벼운 블립/차임

let audioCtx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function tone(
  freq: number,
  durS: number,
  type: OscillatorType,
  gainV: number,
  delayS = 0,
  slideTo?: number
) {
  if (muted) return;
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + delayS;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + durS);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainV, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0004, t0 + durS);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durS + 0.05);
}

export const sfx = {
  eat(tier: number) {
    tone(520 + tier * 90, 0.09, "triangle", 0.05, 0, 900 + tier * 120);
  },
  hurt() {
    tone(300, 0.28, "sawtooth", 0.05, 0, 90);
  },
  levelUp() {
    tone(523, 0.12, "sine", 0.06);
    tone(659, 0.12, "sine", 0.06, 0.1);
    tone(784, 0.22, "sine", 0.06, 0.2);
  },
  friend() {
    tone(880, 0.1, "sine", 0.05);
    tone(1175, 0.16, "sine", 0.05, 0.09);
  },
  item() {
    tone(700, 0.08, "square", 0.035, 0, 1400);
  },
  heal() {
    tone(392, 0.14, "sine", 0.05);
    tone(523, 0.2, "sine", 0.05, 0.12);
  },
  pet() {
    tone(660, 0.1, "sine", 0.04, 0, 720);
  },
};
