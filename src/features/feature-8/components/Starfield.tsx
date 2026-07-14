// SSR과 하이드레이션 결과가 같도록 결정적(pseudo-random) 배치를 쓴다.
const STARS = Array.from({ length: 60 }, (_, i) => ({
  left: (i * 89.7 + 13) % 100,
  top: (i * 53.3 + 7) % 100,
  size: 1 + ((i * 7) % 3),
  opacity: 0.2 + ((i * 13) % 55) / 100,
}));

export default function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-slate-200"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}
