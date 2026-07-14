"use client";

import { KESSLER_DATE, LORE_TIMELINE, WORLD_STATS } from "./constants";
import { fmtInt } from "./format";

export default function LoreView({ onGoSwim }: { onGoSwim: () => void }) {
  const kesslerDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(`${KESSLER_DATE}T00:00:00`).getTime()) / 86400000)
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-8">
        <header className="rounded-2xl border border-white/10 bg-gradient-to-b from-indigo-950/80 to-white/[.03] p-5">
          <p className="font-mono text-[10px] tracking-widest text-cyan-300">
            케슬러의 밤으로부터 D+{kesslerDays}
          </p>
          <h2 className="mt-2 text-xl font-bold leading-snug text-white">
            케슬러의 밤 이후,
            <br />
            인류는 하늘을 돌려받기로 했다
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-white/60">
            로켓도, 위성도, 별 보러 가는 꿈도 멈춰버린 시대. 하지만 인류는 포기하는 대신
            조금 이상하고 아주 사랑스러운 해답을 골랐다 — 우주쓰레기를 먹고 자라는 펫,
            스텔라펫.
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-white/40">
            연대기
          </h3>
          {LORE_TIMELINE.map((ev) => (
            <article
              key={ev.date}
              className="rounded-2xl border border-white/10 bg-white/[.04] p-4"
            >
              <p className="font-mono text-[10px] text-cyan-300/80">{ev.date}</p>
              <h4 className="mt-1 text-sm font-bold text-white">{ev.title}</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">{ev.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h3 className="text-sm font-bold text-white">스텔라펫이란?</h3>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-white/60">
            <li>
              🧬 궤도 파편을 영양분으로 삼도록 설계된 인공 공생 생명체. 금속과 복합소재를
              소화해 몸을 키운다.
            </li>
            <li>
              💎 다 소화하지 못한 자원은 몸속에서 재결정화되어 &lsquo;스타코어&rsquo;가
              된다. 스타코어는 회수 캡슐에 실려 지구로 돌아와 재활용된다.
            </li>
            <li>
              🛰️ 많이 먹을수록 진화한다. 알에서 시작해 궤도의 고래, 그리고 전설의
              보이드 리바이어던까지.
            </li>
            <li>
              💤 주인이 잠든 사이에도 스텔라펫은 초속 7.8km로 지구를 돌며 묵묵히
              하늘을 청소한다.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h3 className="text-sm font-bold text-white">함께하는 방법</h3>
          <ol className="mt-2 space-y-2 text-xs leading-relaxed text-white/60">
            <li>
              <span className="font-mono text-cyan-300/80">01</span> 가까운 분양소에서
              스타더스트 알을 입양한다.
            </li>
            <li>
              <span className="font-mono text-cyan-300/80">02</span> 협약 발사장의 초소형
              발사체에 알을 실어 보낸다. 나로, 쿠루, 말린디, 마히아… 지구 어디서든.
            </li>
            <li>
              <span className="font-mono text-cyan-300/80">03</span> 이름을 지어주고,
              가끔 들여다보고, 함께 유영한다. 그거면 충분하다.
            </li>
          </ol>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
            <p className="text-[10px] text-white/45">참여 인류</p>
            <p className="mt-0.5 font-mono text-base font-semibold text-white">
              {fmtInt(WORLD_STATS.participants)}명
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
            <p className="text-[10px] text-white/45">활동 중인 스텔라펫</p>
            <p className="mt-0.5 font-mono text-base font-semibold text-white">
              {fmtInt(WORLD_STATS.activePets)}마리
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
            <p className="text-[10px] text-white/45">누적 정화 질량</p>
            <p className="mt-0.5 font-mono text-base font-semibold text-white">
              {fmtInt(WORLD_STATS.clearedTons)} t
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
            <p className="text-[10px] text-white/45">남은 위험 파편</p>
            <p className="mt-0.5 font-mono text-base font-semibold text-white">
              {fmtInt(WORLD_STATS.remainingDebris)}개
            </p>
          </div>
        </section>

        <blockquote className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.06] to-transparent p-5 text-center">
          <p className="text-sm leading-relaxed text-white/80">
            “하늘은 모두의 것이다.”
          </p>
          <footer className="mt-2 text-[10px] text-white/40">
            — 오르비타 협약 제1조 1항
          </footer>
        </blockquote>

        <button
          type="button"
          onClick={onGoSwim}
          className="h-12 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-white/85"
        >
          내 스텔라펫 보러 가기 🪐
        </button>
      </div>
    </div>
  );
}
