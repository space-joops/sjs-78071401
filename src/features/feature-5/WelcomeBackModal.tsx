"use client";

import { stageIndexForTotal } from "./constants";
import { fmtDuration, fmtInt, fmtMass, josa } from "./format";
import PetAvatar from "./PetAvatar";
import type { OfflineReport } from "./useStellarPet";
import type { PetState } from "./types";

export default function WelcomeBackModal({
  pet,
  report,
  onClose,
}: {
  pet: PetState;
  report: OfflineReport;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0e22] p-6 text-center">
        <div className="mx-auto w-fit">
          <PetAvatar hue={pet.hue} stage={stageIndexForTotal(pet.totalEaten)} size={80} />
        </div>
        <h2 className="mt-3 text-lg font-bold text-white">다녀오셨어요?</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {pet.name}
          {josa(pet.name, "은", "는")} 당신이 없던{" "}
          <span className="text-white">{fmtDuration(report.awayMs)}</span> 동안에도
          <br />
          홀로 궤도를 유영하며 하늘을 청소했어요.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.05] p-3">
            <p className="text-[10px] text-white/45">수거한 파편</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-cyan-300">
              +{fmtInt(report.count)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.05] p-3">
            <p className="text-[10px] text-white/45">정화한 질량</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-cyan-300">
              +{fmtMass(report.kg)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-12 w-full rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-white/85"
        >
          쓰다듬어 주기 💫
        </button>
      </div>
    </div>
  );
}
