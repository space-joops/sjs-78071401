// 외부 오디오 에셋 없이 WebAudio 오실레이터로 만드는 초소형 효과음.
// 모바일 자동재생 정책상 첫 호출은 반드시 사용자 제스처 이후여야 한다
// (타이틀 화면의 "터치해서 시작"이 그 제스처 역할을 한다).

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOpts = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
};

function tone({ freq, dur, type = "sine", gain = 0.04, delay = 0, slideTo }: ToneOpts): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  start(): void {
    tone({ freq: 440, dur: 0.12, type: "triangle" });
    tone({ freq: 660, dur: 0.16, delay: 0.1, type: "triangle" });
  },
  collect(combo: number): void {
    tone({ freq: 520 + combo * 90, dur: 0.09, type: "triangle", gain: 0.05 });
  },
  power(): void {
    tone({ freq: 392, dur: 0.1, type: "square", gain: 0.03 });
    tone({ freq: 588, dur: 0.12, delay: 0.09, type: "square", gain: 0.03 });
  },
  shieldBreak(): void {
    tone({ freq: 300, dur: 0.15, type: "sawtooth", gain: 0.04, slideTo: 120 });
  },
  hit(): void {
    tone({ freq: 160, dur: 0.25, type: "sawtooth", gain: 0.06, slideTo: 60 });
  },
  levelUp(): void {
    [523, 659, 784].forEach((f, i) =>
      tone({ freq: f, dur: 0.12, delay: i * 0.09, type: "triangle" })
    );
  },
  over(): void {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, dur: 0.22, delay: i * 0.16, type: "triangle", gain: 0.05 })
    );
  },
};
