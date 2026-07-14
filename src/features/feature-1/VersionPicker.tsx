// 줍줍스 버전 선택 랜딩 — /features/1 진입점.
// 메인 화면의 9칸 구조를 건드리지 않고 1-1 메뉴(줍줍스2)를 노출하기 위한 화면.

import Link from "next/link";

type Version = {
  href: string;
  badge: string;
  title: string;
  tagline: string;
  points: string[];
  accent: string;
  primary?: boolean;
};

const VERSIONS: Version[] = [
  {
    href: "/features/1/v1",
    badge: "1",
    title: "줍줍스1",
    tagline: "오리지널 — 그래비티풍 지구에서의 궤도 청소",
    points: [
      "WebGL 지구 · 실시간 궤도 비행",
      "5단계 진화 · NASA풍 관제 지도",
      "다마고치식 보살핌 · 영속 플레이",
    ],
    accent: "from-cyan-300 to-emerald-300",
  },
  {
    href: "/features/1/v2",
    badge: "1-1",
    title: "줍줍스2",
    tagline: "개선판 — 손맛과 모바일 최적화에 집중",
    points: [
      "히트스톱 · 콤보 체인 · 니어미스 슬로모",
      "절차적 사운드 · 진동 햅틱",
      "손가락이 가리지 않는 상대 드래그 조작",
      "일일 미션 · 접속 스트릭",
    ],
    accent: "from-fuchsia-300 to-amber-300",
    primary: true,
  },
];

export default function VersionPicker() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_20%_10%,rgba(88,70,160,0.28),transparent_55%),radial-gradient(ellipse_at_80%_30%,rgba(30,110,140,0.22),transparent_55%)] bg-[#050a16] font-sans text-white">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4 sm:p-8">
        <header className="flex items-center gap-1 py-1">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 transition-colors hover:bg-white/10"
            aria-label="메인으로 돌아가기"
          >
            ←
          </Link>
          <span className="text-sm font-bold">줍줍스</span>
        </header>

        <div className="my-auto flex flex-col gap-4 py-6">
          <div className="text-center">
            <p className="text-3xl">🛰️</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">줍줍스</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              케슬러 신드롬의 시대, 우주쓰레기를 먹고 자라는
              <br />
              애완 생명체 줍스를 보살피고 훈련시키세요.
            </p>
            <p className="mt-3 text-xs text-white/40">플레이할 버전을 선택하세요</p>
          </div>

          {VERSIONS.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className={`group flex flex-col gap-2 rounded-2xl border p-4 transition-colors ${
                v.primary
                  ? "border-amber-300/30 bg-amber-400/[0.07] hover:bg-amber-400/[0.12]"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full bg-gradient-to-r ${v.accent} px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-900`}
                >
                  {v.badge}
                </span>
                <span className="text-lg font-bold">{v.title}</span>
                {v.primary && (
                  <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                    NEW
                  </span>
                )}
                <span className="ml-auto text-white/30 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
              <p className="text-xs text-white/60">{v.tagline}</p>
              <ul className="flex flex-col gap-1">
                {v.points.map((p) => (
                  <li key={p} className="flex gap-1.5 text-xs text-white/50">
                    <span className="text-white/30">·</span>
                    {p}
                  </li>
                ))}
              </ul>
            </Link>
          ))}

          <Link
            href="/features/1/pixel-lab"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 text-xs font-semibold text-white/60 transition-colors hover:bg-white/5"
          >
            🎨 픽셀 랩 — 16비트 에셋 보기
          </Link>

          <p className="text-center text-[11px] leading-relaxed text-white/30">
            두 버전은 저장 데이터가 분리되어 있어
            <br />
            각각의 줍스를 따로 키울 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
